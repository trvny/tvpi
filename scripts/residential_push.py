#!/usr/bin/env python3
"""Residential-IP push for tvpi.

Run this on a machine with a Polish residential IP. It fetches each channel's
live HLS URL directly from TVP's API, validates a media segment behind each HLS
master, normalizes relative playlist references, and pushes the fresh URL into
the Worker's cache/D1/R2 fallback stores.

The last working HLS candidate index is cached locally. Later runs validate that
candidate first and only scan every alternative when it stops working, cutting
normal network and CPU work without giving up the full fallback scan.

Set TVPI_MANIFEST_DIR to also write normalized manifests locally for testing
players that mishandle redirects, relative audio playlists, or default audio.

Env:
  TVPI_PUSH_TOKEN   shared secret, must match the Worker's PUSH_TOKEN secret
  TVPI_MANIFEST_DIR optional output directory for normalized .m3u8 manifests
  TVPI_STATE_FILE   optional candidate-cache path

Usage:
  TVPI_PUSH_TOKEN=... python3 residential_push.py
"""
import http.client
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

HLS_ACCEPT = "application/vnd.apple.mpegurl, application/x-mpegURL, */*"
URI_ATTRIBUTE_RE = re.compile(r'URI="([^"]+)"', re.IGNORECASE)
GROUP_ID_RE = re.compile(r'(?:^|,)GROUP-ID="([^"]+)"', re.IGNORECASE)
BANDWIDTH_RE = re.compile(r'(?:^|,)BANDWIDTH=(\d+)', re.IGNORECASE)


def set_attribute(line: str, name: str, value: str) -> str:
    pattern = re.compile(rf"(?i)(?:^|,){re.escape(name)}=[^,]*")
    match = pattern.search(line)
    replacement = f"{name}={value}"
    if match:
        prefix = "," if match.group(0).startswith(",") else ""
        return line[: match.start()] + prefix + replacement + line[match.end() :]
    return line + "," + replacement


def normalize_manifest(url: str, body: str) -> str:
    """Make child URIs absolute and choose one default per audio group."""
    raw_lines = body.splitlines()
    audio_groups: dict[str, list[int]] = {}

    for index, line in enumerate(raw_lines):
        upper = line.upper()
        if not (
            upper.startswith("#EXT-X-MEDIA:")
            and "TYPE=AUDIO" in upper
            and "URI=" in upper
        ):
            continue
        group_match = GROUP_ID_RE.search(line)
        group = group_match.group(1) if group_match else f"__ungrouped_{index}"
        audio_groups.setdefault(group, []).append(index)

    preferred_audio: set[int] = set()
    for indexes in audio_groups.values():
        preferred = next(
            (
                index
                for index in indexes
                if 'LANGUAGE="POL"' in raw_lines[index].upper()
                or 'LANGUAGE="PL"' in raw_lines[index].upper()
                or "POLSK" in raw_lines[index].upper()
            ),
            None,
        )
        if preferred is None:
            preferred = next(
                (
                    index
                    for index in indexes
                    if "DEFAULT=YES" in raw_lines[index].upper()
                ),
                indexes[0],
            )
        preferred_audio.add(preferred)

    audio_indexes = {index for indexes in audio_groups.values() for index in indexes}
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
                    "YES" if index in preferred_audio else "NO",
                )
                rewritten = set_attribute(rewritten, "AUTOSELECT", "YES")
            normalized.append(rewritten)
        else:
            normalized.append(urllib.parse.urljoin(url, stripped))

    return "\n".join(normalized) + "\n"


def default_audio_urls(base_url: str, body: str) -> list[str]:
    urls: list[str] = []
    for line in body.splitlines():
        upper = line.upper()
        if not (
            upper.startswith("#EXT-X-MEDIA:")
            and "TYPE=AUDIO" in upper
            and "DEFAULT=YES" in upper
        ):
            continue
        match = URI_ATTRIBUTE_RE.search(line)
        if match:
            urls.append(urllib.parse.urljoin(base_url, match.group(1)))
    return urls


def fetch_manifest(url: str) -> tuple[str, str] | None:
    headers = {**TVP_HEADERS, "Accept": HLS_ACCEPT}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            return res.geturl(), res.read().decode("utf-8", errors="replace")
    except (
        urllib.error.URLError,
        TimeoutError,
        http.client.IncompleteRead,
    ) as exc:
        print(f"manifest rejected: {exc}", file=sys.stderr)
        return None


def variant_urls(base_url: str, raw_lines: list[str]) -> list[str]:
    variants: list[tuple[int, str]] = []
    pending_bandwidth: int | None = None

    for line in raw_lines:
        upper = line.upper()
        if upper.startswith("#EXT-X-STREAM-INF:"):
            match = BANDWIDTH_RE.search(line)
            pending_bandwidth = int(match.group(1)) if match else 0
            continue
        if pending_bandwidth is None or not line or line.startswith("#"):
            continue
        variants.append((pending_bandwidth, urllib.parse.urljoin(base_url, line)))
        pending_bandwidth = None

    variants.sort(reverse=True)
    return [url for _, url in variants]


def first_segment_url(base_url: str, raw_lines: list[str]) -> str | None:
    for line in raw_lines:
        if line and not line.startswith("#"):
            return urllib.parse.urljoin(base_url, line)
    return None


def init_segment_url(base_url: str, raw_lines: list[str]) -> str | None:
    for line in raw_lines:
        if not line.upper().startswith("#EXT-X-MAP:"):
            continue
        match = URI_ATTRIBUTE_RE.search(line)
        if match:
            return urllib.parse.urljoin(base_url, match.group(1))
    return None


def probe_resource(url: str) -> bool:
    headers = {**TVP_HEADERS, "Accept": "*/*", "Range": "bytes=0-0"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            return bool(res.read(1))
    except (
        urllib.error.URLError,
        TimeoutError,
        http.client.IncompleteRead,
    ) as exc:
        print(f"media probe rejected: {exc}", file=sys.stderr)
        return False


def probe_playlist(url: str, body: str | None = None, depth: int = 0) -> bool:
    final_url = url
    if body is None:
        fetched = fetch_manifest(url)
        if not fetched:
            return False
        final_url, body = fetched

    if not body.lstrip().startswith("#EXTM3U"):
        print("manifest rejected: response is not HLS", file=sys.stderr)
        return False

    raw_lines = [line.strip() for line in body.splitlines()]
    variants = variant_urls(final_url, raw_lines)
    if variants:
        if depth >= 2:
            print("manifest rejected: nested master is too deep", file=sys.stderr)
            return False
        for variant in variants:
            if probe_playlist(variant, depth=depth + 1):
                return True
        print("manifest rejected: no variant reaches a media segment", file=sys.stderr)
        return False

    segment = first_segment_url(final_url, raw_lines)
    if not segment:
        print("manifest rejected: media playlist has no segment", file=sys.stderr)
        return False

    init_segment = init_segment_url(final_url, raw_lines)
    if init_segment and not probe_resource(init_segment):
        return False
    return probe_resource(segment)


def inspect_manifest(url: str) -> tuple[int, str, str] | None:
    fetched = fetch_manifest(url)
    if not fetched:
        return None
    final_url, body = fetched

    if not body.lstrip().startswith("#EXTM3U"):
        print("manifest rejected: response is not HLS", file=sys.stderr)
        return None

    raw_lines = [line.strip() for line in body.splitlines()]
    lines = [line.upper() for line in raw_lines]
    stream_lines = [line for line in lines if line.startswith("#EXT-X-STREAM-INF")]
    media_lines = [line for line in lines if line.startswith("#EXT-X-MEDIA")]
    uri_lines = [line for line in raw_lines if line and not line.startswith("#")]
    segments = sum(line.startswith("#EXTINF:") for line in lines)
    if not uri_lines or (not stream_lines and segments == 0):
        print("manifest rejected: no playable entries", file=sys.stderr)
        return None

    if not probe_playlist(final_url, body):
        return None

    normalized = normalize_manifest(final_url, body)
    for audio_url in default_audio_urls(final_url, normalized):
        if not probe_playlist(audio_url):
            print("manifest rejected: default audio is not playable", file=sys.stderr)
            return None

    audio_codecs = ("MP4A", "AAC", "AC-3", "EC-3")
    muxed_audio = any(
        any(codec in line for codec in audio_codecs) and "AUDIO=" not in line
        for line in stream_lines
    )
    separate_audio = any(
        "TYPE=AUDIO" in line and "URI=" in line for line in media_lines
    )
    default_audio = any(
        "TYPE=AUDIO" in line and "DEFAULT=YES" in line for line in media_lines
    )
    variants = len(stream_lines)

    if muxed_audio:
        score, label = 400, "declared muxed audio"
    elif separate_audio and default_audio:
        score, label = 300, "default alternate audio"
    elif separate_audio:
        score, label = 250, "alternate audio normalized"
    else:
        score, label = 100, "audio unknown"

    return score + variants + min(segments, 20), f"{label}; media verified", normalized


def source_candidates(sources: list[object]) -> list[tuple[int, str]]:
    candidates: list[tuple[int, str]] = []
    seen: set[str] = set()
    for index, source in enumerate(sources, start=1):
        url = source.get("src") if isinstance(source, dict) else None
        if not isinstance(url, str) or not url.startswith("https://") or url in seen:
            continue
        seen.add(url)
        candidates.append((index, url))
    return candidates


def fetch_hls(
    channel_id: str, preferred_index: int | None
) -> tuple[str, str, int] | None:
    req = urllib.request.Request(TVP_API_URL.format(id=channel_id), headers=TVP_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.load(res)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"[{channel_id}] fetch failed: {exc}", file=sys.stderr)
        return None

    try:
        sources = data["sources"]["HLS"]
        if not isinstance(sources, list):
            raise TypeError("HLS sources are not a list")
    except (KeyError, TypeError):
        print(f"[{channel_id}] unexpected response shape: {data}", file=sys.stderr)
        return None

    available = source_candidates(sources)
    preferred = next((item for item in available if item[0] == preferred_index), None)
    if preferred:
        index, url = preferred
        inspected = inspect_manifest(url)
        if inspected:
            _, label, manifest = inspected
            print(f"[{channel_id}] reused HLS {index}/{len(sources)} ({label})")
            return url, manifest, index
        print(f"[{channel_id}] cached HLS {index} failed; rescanning", file=sys.stderr)

    inspected_candidates: list[tuple[int, str, str, str, int]] = []
    for index, url in available:
        if preferred and index == preferred[0]:
            continue
        inspected = inspect_manifest(url)
        if inspected:
            score, label, manifest = inspected
            inspected_candidates.append((score, url, label, manifest, index))

    if not inspected_candidates:
        print(f"[{channel_id}] no playable HLS manifest", file=sys.stderr)
        return None

    _, url, label, manifest, index = max(inspected_candidates)
    print(f"[{channel_id}] selected HLS {index}/{len(sources)} ({label})")
    return url, manifest, index


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


def configured_manifest_dir() -> Path | None:
    value = os.environ.get("TVPI_MANIFEST_DIR")
    if not value:
        return None

    directory = Path(value)
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"local manifests disabled: {exc}", file=sys.stderr)
        return None
    return directory


def write_local_manifest(directory: Path | None, slug: str, manifest: str) -> None:
    if not directory:
        return
    output = directory / f"{slug}.m3u8"
    try:
        output.write_text(manifest, encoding="utf-8")
        print(f"[{slug}] wrote {output}")
    except OSError as exc:
        print(f"[{slug}] local manifest write failed: {exc}", file=sys.stderr)


def configured_state_file() -> Path:
    value = os.environ.get("TVPI_STATE_FILE")
    if value:
        return Path(value)
    return Path(__file__).with_name(".residential_push_state.json")


def load_preferences(path: Path) -> dict[str, int]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {
        slug: index
        for slug, index in data.items()
        if slug in CHANNELS and isinstance(index, int) and index > 0
    }


def save_preferences(path: Path, preferences: dict[str, int]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(preferences, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    except OSError as exc:
        print(f"candidate cache write failed: {exc}", file=sys.stderr)


def main() -> int:
    token = os.environ.get("TVPI_PUSH_TOKEN")
    if not token:
        print("TVPI_PUSH_TOKEN not set", file=sys.stderr)
        return 1

    manifest_dir = configured_manifest_dir()
    state_file = configured_state_file()
    preferences = load_preferences(state_file)
    preferences_changed = False
    ok = 0
    for slug, channel_id in CHANNELS.items():
        resolved = fetch_hls(channel_id, preferences.get(slug))
        if not resolved:
            continue
        url, manifest, source_index = resolved
        write_local_manifest(manifest_dir, slug, manifest)
        if push(slug, url, manifest, token):
            ok += 1
            if preferences.get(slug) != source_index:
                preferences[slug] = source_index
                preferences_changed = True

    if preferences_changed:
        save_preferences(state_file, preferences)

    print(f"pushed {ok}/{len(CHANNELS)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
