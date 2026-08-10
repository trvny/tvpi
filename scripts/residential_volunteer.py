#!/usr/bin/env python3
"""Public residential volunteer for TVPI.

Fetch and validate TVP HLS streams from a Polish residential connection, then
submit only the verified TVP URL and normalized manifest to the public volunteer
endpoint. No TVPI secret is required.
"""
import json
import sys
import urllib.error
import urllib.request

import residential_push as core


def push(slug: str, url: str, manifest: str) -> bool:
    req = urllib.request.Request(
        f"{core.WORKER_BASE}/push/{slug}",
        data=json.dumps({"url": url, "manifest": manifest}).encode(),
        headers={
            "Content-Type": "application/json",
            "User-Agent": core.TVP_HEADERS["User-Agent"],
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
    manifest_dir = core.configured_manifest_dir()
    state_file = core.configured_state_file()
    preferences = core.load_preferences(state_file)
    preferences_changed = False
    ok = 0

    for slug, channel_id in core.CHANNELS.items():
        resolved = core.fetch_hls(channel_id, preferences.get(slug))
        if not resolved:
            continue
        url, manifest, source_index = resolved
        core.write_local_manifest(manifest_dir, slug, manifest)
        if push(slug, url, manifest):
            ok += 1
            if preferences.get(slug) != source_index:
                preferences[slug] = source_index
                preferences_changed = True

    if preferences_changed:
        core.save_preferences(state_file, preferences)

    print(f"pushed {ok}/{len(core.CHANNELS)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
