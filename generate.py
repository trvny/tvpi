#!/usr/bin/env python3
"""
TVP M3U generator — runs in GitHub Actions, writes tvp.m3u

API: https://vod.tvp.pl/api/products/{channel_id}/videos/playlist
     ?platform=BROWSER&videoType=LIVE
Returns: {"sources": {"HLS": [{"src": "<m3u8 url>"}]}}
"""

import json
import sys
import urllib.request

CHANNELS = [
    {
        "id":    "399697",
        "name":  "TVP 1 HD",
        "logo":  "https://s.tvp.pl/images/3/8/0/uid_3800ec3d7a9b6fa4517f2a1d4f5cd6b9_width_130_gs_0.png",
        "group": "Polska",
    },
    {
        "id":    "399698",
        "name":  "TVP 2 HD",
        "logo":  "https://s.tvp.pl/images/6/7/d/uid_67d7cfe9dd3e5ee8dbb47e2f98eb1e4f_width_130_gs_0.png",
        "group": "Polska",
    },
    # Uncomment to add more:
    # {"id": "399699", "name": "TVP Info",    "logo": "", "group": "Polska"},
    # {"id": "399731", "name": "TVP World",   "logo": "", "group": "Polska"},
    # {"id": "399700", "name": "TVP Sport",   "logo": "", "group": "Polska"},
    # {"id": "399701", "name": "TVP Kultura", "logo": "", "group": "Polska"},
    # {"id": "399702", "name": "TVP Polonia", "logo": "", "group": "Polska"},
    # {"id": "399703", "name": "TVP Historia","logo": "", "group": "Polska"},
]

API_URL = (
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
    "Accept":  "application/json, */*",
}


def get_stream_url(channel_id):
    url = API_URL.format(id=channel_id)
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


def main():
    lines = ["#EXTM3U"]
    ok    = 0

    for ch in CHANNELS:
        print(f"Fetching {ch['name']} (id={ch['id']}) …", file=sys.stderr)
        url = get_stream_url(ch["id"])
        if url:
            lines.append(
                f'#EXTINF:-1 tvg-id="{ch["id"]}" '
                f'tvg-name="{ch["name"]}" '
                f'tvg-logo="{ch["logo"]}" '
                f'group-title="{ch["group"]}",{ch["name"]}\n'
                f'{url}'
            )
            ok += 1
            print(f"  ✓ {url[:80]}…", file=sys.stderr)
        else:
            print(f"  ✗ skipped", file=sys.stderr)

    out = "\n\n".join(lines) + "\n"
    with open("tvp.m3u", "w", encoding="utf-8") as f:
        f.write(out)

    print(f"\nDone: {ok}/{len(CHANNELS)} streams written to tvp.m3u", file=sys.stderr)
    if ok == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
