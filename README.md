[![Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com) [![refresh](https://github.com/trvny/tvpi/actions/workflows/refresh.yml/badge.svg)](https://github.com/trvny/tvpi/actions/workflows/refresh.yml)  
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=fff&style=flat)](https://tvpi.travny.workers.dev) [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=fff&style=flat)](https://tvpi.pages.dev/)

# [TVP Live IPTV 📺](https://tvpi.pages.dev)

---

> ## ⚠️ Current status: residential push workaround verified
>
> TVP still returns `GEOIP_FILTER_FAILED` (403) from non-Polish infrastructure,
> so GitHub Actions and Cloudflare cannot refresh most channels on their own.
>
> The residential push path is implemented and has been tested end to end from a
> Polish home connection. `scripts/residential_push.py` refreshed **9/9**
> channels, pushed validated and normalized HLS manifests to the Worker, and all
> nine stable Worker `.m3u8` URLs played successfully immediately after refresh.
>
> This confirms that the **method works**, but TVPI is not a guaranteed 24/7
> service yet. A machine on a Polish residential IP must run the pusher roughly
> every 10 minutes, and the current maintainer cannot keep that machine online
> around the clock. Temporary outages and stale fallbacks are therefore expected.
>
> A durable Polish residential runner or host is still wanted. See
> [issue #15](https://github.com/trvny/tvpi/issues/15).

---

## Combined playlist

Live TVP channels as ready-to-use M3U playlists. The Worker playlist contains
stable per-channel `.m3u8` endpoints; each channel resolves or serves its fresh
manifest only when the player opens it.

| Source | URL base | Refresh | Best for |
|--------|----------|---------|----------|
| **Cloudflare Worker** [`playlist.m3u`](https://tvpi.travny.workers.dev/playlist.m3u) | `https://tvpi.travny.workers.dev` | per channel, when opened | stable saveable playlist |
| **GitHub Raw** [`playlist.m3u`](https://raw.githubusercontent.com/trvny/tvpi/main/streams/playlist.m3u) | `https://raw.githubusercontent.com/trvny/tvpi/main/streams/` | every 15 min via Actions | offline/no-Worker fallback |

> Why two? TVP signs each HLS URL with a short (~15–30 min) token. The Worker
> playlist points to stable TVPI `.m3u8` URLs, so opening a channel can obtain the
> current pushed manifest or resolve a fresh token. The raw git file is a static
> snapshot refreshed on a timer, so its token can expire before the next refresh.

## Channels

| Logo | Channel | Worker | Raw mirror | Status |
|:---:|---|:---:|:---:|:---:|
| <img src="https://www.google.com/s2/favicons?domain=tvp.pl&sz=64" width="32" height="32"> | **TVP 1** | [m3u8](https://tvpi.travny.workers.dev/tvp1.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvp1.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvp1.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=tvp.pl&sz=64" width="32" height="32"> | **TVP 2** | [m3u8](https://tvpi.travny.workers.dev/tvp2.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvp2.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvp2.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=tvp.info&sz=64" width="25" height="25"> | **TVP Info** | [m3u8](https://tvpi.travny.workers.dev/tvpinfo.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvpinfo.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvpinfo.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=sport.tvp.pl&sz=64" width="32" height="32"> | **TVP Sport** | [m3u8](https://tvpi.travny.workers.dev/tvpsport.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvpsport.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvpsport.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=dokument.tvp.pl&sz=64" width="25" height="25"> | **TVP Dokument** | [m3u8](https://tvpi.travny.workers.dev/tvpdokument.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvpdokument.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvpdokument.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=nauka.tvp.pl&sz=64" width="32" height="32"> | **TVP Nauka** | [m3u8](https://tvpi.travny.workers.dev/tvpnauka.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvpnauka.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvpnauka.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=rozrywka.tvp.pl&sz=64" width="25" height="25"> | **TVP Rozrywka** | [m3u8](https://tvpi.travny.workers.dev/tvprozrywka.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvprozrywka.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvprozrywka.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=historia.tvp.pl&sz=64" width="32" height="32"> | **TVP Historia** | [m3u8](https://tvpi.travny.workers.dev/tvphistoria.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvphistoria.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvphistoria.m3u&up_message=online&down_message=offline&label=) |
| <img src="https://www.google.com/s2/favicons?domain=tvp.pl&sz=64" width="25" height="25"> | **TVP Muzyka i Koncerty** | [m3u8](https://tvpi.travny.workers.dev/tvpmuzyka.m3u8) | [m3u](https://raw.githubusercontent.com/trvny/tvpi/main/streams/tvpmuzyka.m3u) | ![status](https://img.shields.io/website?url=https%3A%2F%2Ftvpi.travny.workers.dev%2Ftvpmuzyka.m3u&up_message=online&down_message=offline&label=) |

The **Status** badge pings the Worker endpoint live, so it reflects whether the
service is currently responding for that channel.

The Worker links are `.m3u8` endpoints: a **302 redirect to the freshly
tokenized HLS manifest**. They are stable, saveable URLs — put them straight
into your own playlist and every play resolves a fresh token. (Plain `.m3u`
per-channel playlists still exist at the same paths for players that prefer
a nested playlist.)

> **Tip:** the [jsDelivr CDN mirror](https://www.jsdelivr.com/github) can be
> more reliable than raw.githubusercontent.com:
> ```
> https://cdn.jsdelivr.net/gh/trvny/tvpi@main/streams/playlist.m3u
> ```
> Note jsDelivr caches aggressively, which works against short-lived tokens —
> prefer the raw URL or the Worker if you see stale streams.

## How it works

[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff&style=flat)](https://www.python.org/)  
The raw-file path:
1. **GitHub Actions** runs `generate.py` every 15 minutes (cron schedule).
2. The script calls the TVP API for fresh signed HLS token URLs.
3. On any transient failure it reuses that channel's last-known-good URL rather
   than overwriting it with a placeholder, then writes/commits `streams/*.m3u`.
4. Your player fetches the raw file.

```
GitHub Actions (every 15 min)
        │
        ▼
   vod.tvp.pl API  ──►  signed HLS token URL  (TTL ~15–30 min)
        │
        ▼
   streams/*.m3u committed to repo
        │
        ▼
  raw.githubusercontent.com/…/streams/playlist.m3u
        │
        ▼
   Your IPTV player 🎬
```

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff&style=flat-square)](https://www.typescriptlang.org/)   
The Worker combined playlist skips token resolution. It lists stable channel
endpoints, and each endpoint serves the current pushed manifest or runs the
normal cache/live/fallback resolution only when that channel is opened.

## Setup

1. Fork or push this repo to your GitHub account.
2. Actions run automatically — no secrets or extra config needed.
3. After the first run (up to 15 min), grab a raw URL and add it to your player,
   or deploy the Worker (`worker/`, via `wrangler deploy`) and use the Worker URL.

## Notes

- Logos in the table are channel-site favicons fetched at render time; the
  **Status** badges ping the Worker live via shields.io and may take a moment to
  refresh due to badge caching.
- TVP token TTL is ~15–30 min; the 15-min refresh keeps the raw files mostly
  valid, but GitHub may delay scheduled runs under load — the Worker is the only
  path that's fully immune to token expiry.
- If `generate.py` can't get a fresh URL **and** has no cached one for a channel,
  it writes a placeholder stub so the rest of the playlist still builds.

## [License](LICENSE)

<picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/license/trvny/tvpi.svg?variant=branded&size=xm&mode=dark&theme=neutral&font=jetbrains-mono"><img alt="License" src="https://www.shieldcn.dev/github/license/trvny/tvpi.svg?variant=branded&size=xm&mode=light&theme=neutral&font=jetbrains-mono"></picture>

## Other stuff

[![feeds](https://github-stats-extended.vercel.app/api/pin?username=trvny&repo=trvny%2Ffeeds&theme=great-gatsby)](https://github.com/trvny/feeds)

## 💬 Cytat z szuflady

<!-- markdownlint-disable MD033 -->
<!--STARTS_HERE_QUOTE_README-->
<i>❝Coincidence is God's way of remaining anonymous. — Albert Einstein❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Mininewsy

<!--README_FEED:START-->
- [Marka Cashify od lipca funkcjonuje jako kantor kryptowalut online w oparciu o przepisy MiCA](https://pap-mediaroom.pl/biznes-i-finanse/marka-cashify-od-lipca-funkcjonuje-jako-kantor-kryptowalut-online-w-oparciu-o)
- [Erste Letnie Brzmienia 2026 ruszają już dzisiaj. Kraków otwiera letnią trasę przez pięć miast](https://pap-mediaroom.pl/biznes-i-finanse/erste-letnie-brzmienia-2026-ruszaja-juz-dzisiaj-krakow-otwiera-letnia-trase-przez)
- [Humanoid pozyskuje 152 mln USD przy wycenie na kwotę 1,35 mld USD po przeprowadzeniu rundy finansowania, stając się pierwszym europejskim jednorożcem wyspecjalizowanym w robotach…](https://pap-mediaroom.pl/biznes-i-finanse/humanoid-pozyskuje-152-mln-usd-przy-wycenie-na-kwote-135-mld-usd-po)
- [Fresha przyspiesza ekspansję w Europie, otwierając nowe biuro w Warszawie i powołując Macieja Walczewskiego na stanowisko dyrektora generalnego na Europę Wschodnią](https://pap-mediaroom.pl/biznes-i-finanse/fresha-przyspiesza-ekspansje-w-europie-otwierajac-nowe-biuro-w-warszawie-i)
- [Mikropoświadczenia - nowa waluta umiejętności](https://pap-mediaroom.pl/polityka-i-spoleczenstwo/mikroposwiadczenia-nowa-waluta-umiejetnosci)
<!--README_FEED:END-->
