#!/usr/bin/env python3
"""Residential-IP push for tvpi.

As of 2026-07, TVP enforces its geo-block at the API/manifest level (not just
on HLS segments) for every channel except tvpinfo -- GEOIP_FILTER_FAILED on
the plain playlist call. No Cloudflare Worker colo or GitHub Actions runner is
in Poland, so the Worker's live fetch (L2) and the GitHub Actions raw-mirror
generator (L3b) are both structurally unable to reach those channels anymore.

Run this on a machine with a Polish residential IP. It fetches each channel's
live HLS url directly from TVP's API and pushes it into the Worker's D1 LKG
(+ R2 mirror), the same rows the cron would write if it could reach TVP.

Env:
  TVPI_PUSH_TOKEN   shared secret, must match the Worker's PUSH_TOKEN secret

Usage:
  TVPI_PUSH_TOKEN=... python3 residential_push.py

Cron (every 10 min, comfortably under TVP's ~15-30 min token lifetime and the
Worker's 15-min LKG_MAX_AGE_MS read-side freshness window):
  */10 * * * * TVPI_PUSH_TOKEN=... /usr/bin/python3 /path/to/residential_push.py >> /path/to/push.log 2>&1
"""
import json
import os
import sys
import urllib.error
import urllib.request

WORKER_BASE = "https://tvpi.travny.workers.dev"

# Keep in lockstep with CHANNELS in worker/src/index.ts and TVP_CHANNELS in
# generate.py -- same slug/id pairs.
CHANNELS = {
    "tvp1": "399697",
    "tvp2": "399698",
    "tvpinfo": "399699",
    "tvpsport": "399702",
    "tvpdokument": "399721",
    "tvpnauka": "399722",
    "tvprozrywka": "399724",
    "tvphistoria": "399703",
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


def fetch_hls(channel_id: str) -> str | None:
    req = urllib.request.Request(TVP_API_URL.format(id=channel_id), headers=TVP_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.load(res)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        print(f"[{channel_id}] fetch failed: {e}", file=sys.stderr)
        return None
    try:
        return data["sources"]["HLS"][0]["src"]
    except (KeyError, IndexError, TypeError):
        print(f"[{channel_id}] unexpected response shape: {data}", file=sys.stderr)
        return None


def push(slug: str, url: str, token: str) -> bool:
    req = urllib.request.Request(
        f"{WORKER_BASE}/push/{slug}",
        data=json.dumps({"url": url}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.status == 200
    except urllib.error.HTTPError as e:
        print(f"[{slug}] push rejected: {e.code} {e.read().decode(errors='replace')}", file=sys.stderr)
        return False
    except urllib.error.URLError as e:
        print(f"[{slug}] push failed: {e}", file=sys.stderr)
        return False


def main() -> int:
    token = os.environ.get("TVPI_PUSH_TOKEN")
    if not token:
        print("TVPI_PUSH_TOKEN not set", file=sys.stderr)
        return 1

    ok = 0
    for slug, channel_id in CHANNELS.items():
        hls = fetch_hls(channel_id)
        if hls and push(slug, hls, token):
            ok += 1
    print(f"pushed {ok}/{len(CHANNELS)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
