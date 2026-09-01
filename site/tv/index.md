# TVPI

> Stable public entry points for current TVP IPTV streams and M3U playlists.

The human-facing page is https://trfny.com/tv/. The streaming Worker is https://tvpi.trfny.com/ and keeps stable channel URLs while resolving fresh HLS data behind them.

## Playlists

- [Combined stable playlist](https://tvpi.trfny.com/playlist.m3u)
- [Worker LLM guide](https://tvpi.trfny.com/llms.txt)
- [Worker full LLM guide](https://tvpi.trfny.com/llms-full.txt)
- [Raw GitHub fallback](https://raw.githubusercontent.com/trvny/tvpi/main/streams/playlist.m3u)

## Notes

TVP stream signatures are short-lived. Consumers should use the stable Worker URLs rather than caching resolved tokenized HLS URLs. Hosted freshness can depend on the residential refresh path described in the project documentation.

## Source

- [Repository](https://github.com/trvny/tvpi)
- [Worker source](https://github.com/trvny/tvpi/blob/main/worker/src/entry.ts)
