#!/usr/bin/env python3
"""Residential-IP push for tvpi.

Run this on a machine with a Polish residential IP. It fetches each channel's
live HLS URL directly from TVP's API, validates the available HLS masters,
normalizes relative playlist references, and pushes the fresh URL into the
Worker's cache/D1/R2 fallback stores.

The normalized manifests are also written locally. They are useful for testing
players that mishandle redirects, relative audio playlists, or an HLS master
without an explicitly selected default audio rendition.

Env:
  TVPI_PUSH_TOKEN   shared secret, must match the Worker's PUSH_TOKEN secret
  TVPI_MANIFEST_DIR optional output directory for normalized .m3u8 manifests

Usage:
  TVPI_PUSH_TOKEN=... python3 residential_push.py
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WORKER_BASE = "https://tvpi.travny.workers.dev"

CHANNELS = {
    "tvp1": "399697",
    "tvp2": "399698",
    "tvpinfo": "399699",
    "tvpsport": "399702",
    "tvpdokument": "399721",
    "tvpnauka": "399722",
    "tvprozrywka": "399724",
    "tvphistoria": "399703",
    "tvpmuzyka": "2999109",
}

TVP_API_URL = (
    "https://vod.tvp.pl/api/products/{id}/videos/playlist"
    "?platform=BROWSER&videoType=LIVE"
)

TVP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://vod.tvp.pl/",
    "Accept": "application/json, */*",
}

URI_ATTRIBUTE_RE = re.compile(r'URI="([^"]+)"', re.IGNORECASE)


def set_attribute(line: str, name: str, value: str) -> str:
    pattern = re.compile(rf"(?i)(?:^|,){re.escape(name)}=[^,]*")
    match = pattern.search(line)
    replacement = f"{name}={value}"
    if match:
        prefix = "," if match.group(0).startswith(",") else ""
        return line[: match.start()] + prefix + replacement + line[match.end() :]
    return line + "," + replacement


def normalize_manifest(url: str, body: str) -> str:
    """Make child URIs absolute and choose one default audio rendition."""
    raw_lines = body.splitlines()
    audio_indexes = [
        index
        for index, line in enumerate(raw_lines)
        if line.upper().startswith("#EXT-X-MEDIA:")
        and "TYPE=AUDIO" in line.upper()
        and "URI=" in line.upper()
    ]

    preferred_audio = None
    for index in audio_indexes:
        upper = raw_lines[index].upper()
        if 'LANGUAGE="POL"' in upper or 'LANGUAGE="PL"' in upper or "POLSK" in upper:
            preferred_audio = index
            break
    if preferred_audio is None and audio_indexes:
        preferred_audio = audio_indexes[0]

    normalized: list[str] = []
    for index, line in enumerate(raw_lines):
        stripped = line.strip()
        if not stripped:
            normalized.append("")
            continue

        if stripped.startswith("#"):

            def replace_uri(match: re.Match[str]) -> str:
                return f'URI="{urllib.parse.urljoin(url, match.group(1))}"'

            rewritten = URI_ATTRIBUTE_RE.sub(replace_uri, stripped)
            if index in audio_indexes:
                rewritten = set_attribute(
                    rewritten,
                    "DEFAULT",
                    "YES" if index == preferred_audio else "NO",
                )
                rewritten = set_attribute(rewritten, "AUTOSELECT", "YES")
            normalized.append(rewritten)
        else:
            normalized.append(urllib.parse.urljoin(url, stripped))

    return "\n".join(normalized) + "\n"


def inspect_manifest(url: str) -> tuple[int, str, str] | None:
    headers = {
        **TVP_HEADERS,
        "Accept": "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            final_url = res.geturl()
            body = res.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"manifest rejected: {exc}", file=sys.stderr)
        return None

    if not body.lstrip().startswith("#EXTM3U"):
        print("manifest rejected: response is not HLS", file=sys.stderr)
        return None

    lines = [line.strip().upper() for line in body.splitlines()]
    stream_lines = [line for line in lines if line.startswith("#EXT-X-STREAM-INF")]
    media_lines = [line for line in lines if line.startswith("#EXT-X-MEDIA")]
    audio_codecs = ("MP4A", "AAC", "AC-3", "EC-3")
    muxed_audio = any(
        any(codec in line for codec in audio_codecs) and "AUDIO=" not in line
        for line in stream_lines
    )
    separate_audio = any("TYPE=AUDIO" in line and "URI=" in line for line in media_lines)
    default_audio = any(
        "TYPE=AUDIO" in line and "DEFAULT=YES" in line for line in media_lines
    )
    variants = len(stream_lines)
    segments = sum(line.startswith("#EXTINF:") for line in lines)

    if muxed_audio:
        score, label = 400, "declared muxed audio"
    elif separate_audio and default_audio:
        score, label = 300, "default alternate audio"
    elif separate_audio:
        score, label = 250, "alternate audio normalized"
    else:
        score, label = 100, "audio unknown"

    normalized = normalize_manifest(final_url, body)
    return score + variants + min(segments, 20), label, normalized


def fetch_hls(channel_id: str) -> tuple[str, str] | None:
    req = urllib.request.Request(TVP_API_URL.format(id=channel_id), headers=TVP_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.load(res)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[{channel_id}] fetch failed: {exc}", file=sys.stderr)
        return None

    try:
        sources = data["sources"]["HLS"]
    except (KeyError, TypeError):
        print(f"[{channel_id}] unexpected response shape: {data}", file=sys.stderr)
        return None

    candidates: list[tuple[int, str, str, str, int]] = []
    seen: set[str] = set()
    for index, source in enumerate(sources, start=1):
        url = source.get("src") if isinstance(source, dict) else None
        if not isinstance(url, str) or not url.startswith("https://") or url in seen:
            continue
        seen.add(url)
        inspected = inspect_manifest(url)
        if inspected:
            score, label, manifest = inspected
            candidates.append((score, url, label, manifest, index))

    if not candidates:
        print(f"[{channel_id}] no playable HLS manifest", file=sys.stderr)
        return None

    _, url, label, manifest, index = max(candidates)
    print(f"[{channel_id}] selected HLS {index}/{len(sources)} ({label})")
    return url, manifest


def push(slug: str, url: str, manifest: str, token: str) -> bool:
    req = urllib.request.Request(
        f"{WORKER_BASE}/push/{slug}",
        data=json.dumps({"url": url, "manifest": manifest}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": TVP_HEADERS["User-Agent"],
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status == 200
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        print(f"[{slug}] push rejected: {exc.code} {body}", file=sys.stderr)
        return False
    except urllib.error.URLError as exc:
        print(f"[{slug}] push failed: {exc}", file=sys.stderr)
        return False


def main() -> int:
    token = os.environ.get("TVPI_PUSH_TOKEN")
    if not token:
        print("TVPI_PUSH_TOKEN not set", file=sys.stderr)
        return 1

    default_dir = Path(__file__).resolve().parent / "manifests"
    manifest_dir = Path(os.environ.get("TVPI_MANIFEST_DIR", default_dir))
    manifest_dir.mkdir(parents=True, exist_ok=True)

    ok = 0
    for slug, channel_id in CHANNELS.items():
        resolved = fetch_hls(channel_id)
        if not resolved:
            continue
        url, manifest = resolved
        output = manifest_dir / f"{slug}.m3u8"
        output.write_text(manifest, encoding="utf-8")
        print(f"[{slug}] wrote {output}")
        if push(slug, url, manifest, token):
            ok += 1

    print(f"pushed {ok}/{len(CHANNELS)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
