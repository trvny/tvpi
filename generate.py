#!/usr/bin/env python3
"""
TVP M3U generator — runs in GitHub Actions
Writes files to the streams/ directory:
  streams/playlist.m3u  ← combined (all channels)
  streams/tvp1.m3u, streams/tvp2.m3u, streams/tvpinfo.m3u,
  streams/tvpdokument.m3u, streams/tvpsport.m3u,
  streams/tvpnauka.m3u, streams/tvprozrywka.m3u, streams/tvphistoria.m3u

A transient fetch failure no longer wipes a channel: the previous
last-known-good URL is reused so the channel stays up until either a
fresh URL is fetched or there is genuinely nothing to fall back on.
"""

import json
import os
import sys
import urllib.request

STREAMS_DIR = "streams"

# ---------------------------------------------------------------------------
# TVP channels — fetched from the TVP API
# ---------------------------------------------------------------------------

TVP_CHANNELS = [
    {
        "id":    "399697",
        "slug":  "tvp1",
        "name":  "TVP 1 HD",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399698",
        "slug":  "tvp2",
        "name":  "TVP 2 HD",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399699",
        "slug":  "tvpinfo",
        "name":  "TVP Info",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399702",
        "slug":  "tvpsport",
        "name":  "TVP Sport",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399721",
        "slug":  "tvpdokument",
        "name":  "TVP Dokument",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399722",
        "slug":  "tvpnauka",
        "name":  "TVP Nauka",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399724",
        "slug":  "tvprozrywka",
        "name":  "TVP Rozrywka",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
    {
        "id":    "399703",
        "slug":  "tvphistoria",
        "name":  "TVP Historia",
        "logo":  "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png",
        "group": "Polska",
    },
]

# ---------------------------------------------------------------------------
# TVP API
# ---------------------------------------------------------------------------

TVP_API_URL = (
    "https://vod.tvp.pl/api/products/{id}/videos/playlist"
    "?platform=BROWSER&videoType=LIVE"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://vod.tvp.pl/",
    "Accept": "application/json, */*",
}


def get_tvp_stream_url(channel_id):
    url = TVP_API_URL.format(id=channel_id)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        hls_list = data.get("sources", {}).get("HLS", [])
        if hls_list:
            return hls_list[0]["src"]
    except Exception as e:
        print(f"  [!] {channel_id}: {e}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# M3U helpers
# ---------------------------------------------------------------------------

def extinf(ch):
    # Use tvg-id if present (TVP channels), otherwise fall back to slug
    tvg_id = ch.get("id", ch["slug"])
    return (
        f'#EXTINF:-1 tvg-id="{tvg_id}" '
        f'tvg-name="{ch["name"]}" '
        f'tvg-logo="{ch["logo"]}" '
        f'group-title="{ch["group"]}",{ch["name"]}'
    )


def write_m3u(filename, entries):
    lines = ["#EXTM3U"]
    for ch, url in entries:
        lines.append(f"{extinf(ch)}\n{url}")
    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n\n".join(lines) + "\n")
    print(f"  → {filename}", file=sys.stderr)


def write_placeholder(filename, channel_name):
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"#EXTM3U\n# {channel_name} stream unavailable — will retry next run\n")


def read_existing_url(filename):
    """
    Return the last-known-good stream URL already written for this channel,
    or None if the file is missing / only contains a placeholder.

    This lets a transient API failure fall back to the previous URL instead
    of clobbering a still-valid playlist with a placeholder.
    """
    try:
        with open(filename, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("http"):
                    return line
    except FileNotFoundError:
        pass
    return None


def resolve_url(fresh_url, filename):
    """
    Pick the best available URL for a channel:
      1. a freshly fetched URL, if we got one;
      2. otherwise the last-known-good URL on disk.
    Returns (url_or_None, is_fresh).
    """
    if fresh_url:
        return fresh_url, True
    return read_existing_url(filename), False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs(STREAMS_DIR, exist_ok=True)
    all_ok_entries = []
    reused = 0

    for ch in TVP_CHANNELS:
        filename = f"{STREAMS_DIR}/{ch['slug']}.m3u"
        print(f"Fetching {ch['name']} (id={ch['id']}) …", file=sys.stderr)

        fresh = get_tvp_stream_url(ch["id"])
        url, is_fresh = resolve_url(fresh, filename)

        if url and is_fresh:
            print(f"  ✓ {url[:80]}…", file=sys.stderr)
            all_ok_entries.append((ch, url))
            write_m3u(filename, [(ch, url)])
        elif url:
            print("  ~ fetch failed — reusing last-known-good URL", file=sys.stderr)
            all_ok_entries.append((ch, url))
            reused += 1
            # Leave the existing file untouched (it already holds this URL).
        else:
            print("  ✗ no fresh or cached URL — writing placeholder", file=sys.stderr)
            write_placeholder(filename, ch["name"])

    # Combined playlist
    write_m3u(f"{STREAMS_DIR}/playlist.m3u", all_ok_entries)

    total = len(TVP_CHANNELS)
    print(
        f"\nDone: {len(all_ok_entries)}/{total} streams available "
        f"({reused} reused from last-known-good).",
        file=sys.stderr,
    )
    if len(all_ok_entries) == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
