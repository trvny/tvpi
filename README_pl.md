[![Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com) [![refresh](https://github.com/trvny/tvpi/actions/workflows/refresh.yml/badge.svg)](https://github.com/trvny/tvpi/actions/workflows/refresh.yml) <a href="https://deepwiki.com/trvny/tvpi"><img src="https://deepwiki.com/badge.svg" alt="DeepWiki"></a>  
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=fff&style=flat)](https://tvpi.travny.workers.dev) [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=fff&style=flat)](https://tvpi.pages.dev/)

**Polski** · [English](README.md)

# [TVP Live IPTV 📺](https://tvpi.pages.dev)

---

> ## ⚠️ Bieżący stan: obejście z domowym łączem potwierdzone
>
> TVP nadal zwraca `GEOIP_FILTER_FAILED` (403) dla infrastruktury spoza Polski,
> więc GitHub Actions i Cloudflare nie mogą samodzielnie odświeżać większości kanałów.
>
> Mechanizm wysyłania danych z polskiego łącza domowego jest wdrożony i został
> przetestowany od początku do końca. `scripts/residential_push.py` odświeżył
> **9/9** kanałów, wysłał zweryfikowane i znormalizowane manifesty HLS do Workera,
> a wszystkie dziewięć stabilnych adresów `.m3u8` Workera działało bezpośrednio
> po odświeżeniu.
>
> Potwierdza to, że **metoda działa**, ale TVPI nie jest jeszcze gwarantowaną
> usługą 24/7. Komputer korzystający z polskiego domowego IP musi uruchamiać
> pusher mniej więcej co 10 minut, a obecny opiekun projektu nie może utrzymywać
> takiej maszyny online przez całą dobę. Trzeba więc liczyć się z chwilowymi
> przerwami i nieaktualnymi adresami awaryjnymi.
>
> Nadal poszukiwany jest trwały runner albo hosting na polskim łączu domowym.
> Szczegóły w [issue #15](https://github.com/trvny/tvpi/issues/15).

---

## Zbiorcza playlista

Kanały TVP na żywo jako gotowe do użycia playlisty M3U. Playlista Workera zawiera
stabilne endpointy `.m3u8` dla każdego kanału. Świeży manifest jest pobierany lub
udostępniany dopiero wtedy, gdy odtwarzacz otworzy konkretny kanał.

| Źródło | Bazowy URL | Odświeżanie | Najlepsze zastosowanie |
|--------|------------|-------------|------------------------|
| **Cloudflare Worker** [`playlist.m3u`](https://tvpi.travny.workers.dev/playlist.m3u) | `https://tvpi.travny.workers.dev` | osobno dla kanału, przy otwarciu | stabilna playlista do zapisania |
| **GitHub Raw** [`playlist.m3u`](https://raw.githubusercontent.com/trvny/tvpi/main/streams/playlist.m3u) | `https://raw.githubusercontent.com/trvny/tvpi/main/streams/` | co 15 min przez Actions | awaryjnie, bez Workera |

> Skąd dwie wersje? TVP podpisuje każdy adres HLS krótkotrwałym tokenem
> (~15–30 min). Playlista Workera wskazuje stabilne adresy TVPI `.m3u8`, więc
> otwarcie kanału może pobrać aktualny wysłany manifest albo uzyskać świeży token.
> Surowy plik z repozytorium jest statycznym snapshotem odświeżanym według
> harmonogramu, dlatego token może wygasnąć przed kolejnym przebiegiem.

## Kanały

| Logo | Kanał | Worker | Kopia Raw | Stan |
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

Badge **Stan** odpytuje endpoint Workera na żywo, dlatego pokazuje, czy usługa
aktualnie odpowiada dla danego kanału.

Linki Workera są endpointami `.m3u8`: wykonują **przekierowanie 302 do świeżo
podpisanego manifestu HLS**. To stabilne adresy, które można zapisać bezpośrednio
we własnej playliście. Każde odtworzenie rozwiązuje świeży token. Zwykłe playlisty
`.m3u` dla pojedynczych kanałów nadal istnieją pod tymi samymi ścieżkami dla
odtwarzaczy preferujących playlistę zagnieżdżoną.

> **Wskazówka:** [kopia w CDN jsDelivr](https://www.jsdelivr.com/github) bywa
> bardziej niezawodna niż raw.githubusercontent.com:
> ```
> https://cdn.jsdelivr.net/gh/trvny/tvpi@main/streams/playlist.m3u
> ```
> jsDelivr agresywnie buforuje pliki, co działa przeciwko krótkotrwałym tokenom.
> Przy nieaktualnych streamach lepiej użyć surowego URL-a albo Workera.

## Jak to działa

[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff&style=flat)](https://www.python.org/)  
Ścieżka oparta na plikach Raw:
1. **GitHub Actions** uruchamia `generate.py` co 15 minut według harmonogramu.
2. Skrypt pobiera z API TVP świeże, podpisane adresy HLS.
3. Przy chwilowym błędzie zachowuje ostatni działający URL kanału zamiast
   nadpisywać go placeholderem, a następnie zapisuje i zatwierdza `streams/*.m3u`.
4. Odtwarzacz pobiera surowy plik.

```
GitHub Actions (co 15 min)
        │
        ▼
   API vod.tvp.pl  ──►  podpisany URL HLS  (TTL ~15–30 min)
        │
        ▼
   streams/*.m3u commitowane do repo
        │
        ▼
  raw.githubusercontent.com/…/streams/playlist.m3u
        │
        ▼
   Twój odtwarzacz IPTV 🎬
```

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff&style=flat-square)](https://www.typescriptlang.org/)   
Zbiorcza playlista Workera pomija rozwiązywanie tokenów. Zawiera stabilne
endpointy kanałów, a każdy z nich udostępnia aktualnie wysłany manifest albo
uruchamia zwykłą ścieżkę cache/live/fallback dopiero przy otwarciu kanału.

## Konfiguracja

1. Zrób fork albo wypchnij repozytorium na własne konto GitHub.
2. Actions uruchamiają się automatycznie, bez sekretów i dodatkowej konfiguracji.
3. Po pierwszym przebiegu, najpóźniej po około 15 minutach, dodaj surowy URL do
   odtwarzacza albo wdróż Workera z katalogu `worker/` poleceniem
   `wrangler deploy` i użyj adresu Workera.

## Uwagi

- Logotypy w tabeli są faviconami stron kanałów pobieranymi podczas renderowania.
  Badge **Stan** odpytuje Workera przez shields.io i może odświeżać się z
  opóźnieniem z powodu cache.
- Token TVP działa około 15–30 minut. Odświeżanie co 15 minut zwykle utrzymuje
  surowe pliki przy życiu, ale GitHub może opóźniać zadania z harmonogramu.
  Tylko ścieżka przez Workera jest całkowicie odporna na wygaśnięcie tokenu.
- Gdy `generate.py` nie może uzyskać świeżego URL-a i nie ma zapisanej działającej
  wersji kanału, tworzy placeholder, aby reszta playlisty nadal mogła się zbudować.

## [Licencja](LICENSE)

<a href="https://spdx.org/licenses/ISC"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/license/trvny/tvpi.svg?variant=branded&size=xm&mode=dark&theme=neutral&font=jetbrains-mono"><img alt="License" src="LICENSE"></picture></a>

## Inne rzeczy

[![feeds](https://github-stats-extended.vercel.app/api/pin?username=trvny&repo=trvny%2Ffeeds&theme=great-gatsby)](https://github.com/trvny/feeds) [![wam](https://github.com/trvny/.github/blob/main/assets/profile/pin_wambridge.svg)](https://github.com/trvny/wambridge)

## 💬 Cytat z szuflady

<!-- markdownlint-disable MD033 -->
<!--STARTS_HERE_QUOTE_README-->
<i>❝The person I like most is the one who points out my defects. — Umar ibn Al-Khattāb (R.A)❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Mininewsy

<!--README_FEED:START-->
- ["To nie będzie bimbrownia". Inwestor stanowczo odpowiada mieszkańcom - Przelom.pl](https://news.google.com/atom/articles/CBMisgFBVV95cUxPeWJIRnpQaW4wUUhxV0lGSE0xdklPZ0hleGxZYVhlQUdvcHdzSzFJR2NjRHlsVmJWVFpRa1J3X0lER3BOR3JVSkRodl9QMzN2UHlleWtZRlRyT2p3UU9OYkZQNUtDX3ltMUZTc3VWY1ZxRTZNbU1mbFB1bXdnbDRORC1ZX2hsYzd1eHNYVW9Tb3pzRlYtaEp5WWZLM254V09OZDZrdEw4MWlyVFBZN3NtTjFR?oc=5)
- [FIFA has scrapped $20 billion World Cup sell-off plan, New York Post reports](https://news.google.com/rss/articles/CBMiuwFBVV95cUxNbXdUU2FsekNqTWc1TWdVd09xUXpTTXNScnVjczNNcGVzbERTWmVwOWNGMGlOd2J2dWQwem4yOU4yb0Y0VThodnEzcWJTRjRBZjI2RUhsNDdNXzNtMmVCa2tBNVp2U3lraTE2ZjFObG9WYThxaGJBWVpTSjE2YV9TTnAwNWVXT0d0MjVTcWJlRUs2bjN5bUJzVEU0bG5NNlZ0X1pwSUZPRTF3TjN2QjNWWDRGeWR6SzhTd1pn?oc=5)
- [US bars imports from 43 more companies over China's alleged forced labor involving Uyghurs](https://news.google.com/rss/articles/CBMiwgFBVV95cUxOSzRCdVNpdm4wZldHbEt1WTduUnNQTnh6N2didEJVLTQ5RjBYSGtQemRacGtrRFdjOUt0Ukh0X0lyLS03cDA2YVRWd3piM3V6N1VZZkprcU52QzBJWW10XzRvTnZQUnBwTURxbkJabXduaV82Q0wyd2xWQW5DNERZM2poRlAtM2xmV0tNSGt4LWc0RkVhSTRSQktmeWRfMjlrR0pGQW93Nm9OUnoteEU4b3RQSWxNN2NZaEwxbHdSYUVQdw?oc=5)
- [Exxon, Chevron warn of continued high fuel prices from Iran war](https://news.google.com/rss/articles/CBMiqgFBVV95cUxNMjdEbTVuZzlMdmNabW90dk04NEdXMUdBUFNzR2FpcDJYZE9RWnlQdXFNV1NtZkVWZ2J1M0dzTXhwVGJFYlNsUkp2d211bFB4eXRQQXk3RWJ5c1hBZ1BUYnF3VXNiSzFweUpEaktkOUsyLVBISHlZY2dneU5RTnkyeXNTejVUZlpJa3hURjFsMGZkSVUxVUw4QUg0N3pqZjg0UlZVdTNGSG9kZw?oc=5)
- [US, Israel planning to bombard energy-related targets in Iran, CBS reports](https://news.google.com/rss/articles/CBMivAFBVV95cUxQNXpvc21vbVJNVjc3NWg0ZnppblFCM3dmQXFVVTNhc1A1YkhoSTA4Q0tFZ0hQbFN0WUdtRlBza0J1dzBFenk3NW85U0ZWLXA0N1llLVFCNUdmRy1JU2NzOTE2bTFTdmlYUXdZNUphTE1uSE84ZXA0WjBYNkUtX2NBbWpUS08taFBRc0xNdGtoV0F6SHpfdU15dFB1WllYNnVwQkxFWThYelpLZnQyRml2Q0MwLVZ2blFDWl9raA?oc=5)
- [EXCLUSIVE: OpenAI finds evidence other AI agents escaped containment as it widens hacking probe](https://news.google.com/rss/articles/CBMivAFBVV95cUxQYTc2SUhrNmVER0NvNW9nZHBwbklFMlA0eTNSRFZETXpfSWpVYU1wOUhaMDRLUnRVSEhtRzByeEktX2FEX1ZzaThNMnpZMW9JdVZDZkVRTEQ4UjdlakFPVXZTUjZaM2JOUkhpN1BxeEU4bWJuSjNkUldBNXRVWDkyYWVXVUlKM0VEZU5wZklfX2FJRkQ0bmVybTIyY0xpbHd6aGtIVmZ3YU5ocGdsdFlNeXdOQlBXOUsyZnZtZA?oc=5)
<!--README_FEED:END-->
