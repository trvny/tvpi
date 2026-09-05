[![Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com) [![refresh](https://github.com/trvny/tvpi/actions/workflows/refresh.yml/badge.svg)](https://github.com/trvny/tvpi/actions/workflows/refresh.yml) <a href="https://deepwiki.com/trvny/tvpi"><img src="https://deepwiki.com/badge.svg" alt="DeepWiki"></a>  
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=fff&style=flat)](https://tvpi.travny.workers.dev) [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=fff&style=flat)](https://trfny.com/)

**Polski** · [English](README.md) · [简体中文](README_zh.md)

# [TVP Live IPTV 📺](https://trfny.com/tv/)

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

[![feeds](https://github.com/trvny/.github/blob/main/assets/profile/pin-feeds.svg)](https://github.com/trvny/feedseek) [![wam](https://github.com/trvny/.github/blob/main/assets/profile/pin-wambridge.svg)](https://github.com/twojstar/wambridge)

## 💬 Cytat z szuflady

<!-- markdownlint-disable MD033 -->
<!--STARTS_HERE_QUOTE_README-->
<i>❝Hard disks are so sensitive to vibration, that just screaming at them diminishes their performance.❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Mininewsy

<!--README_FEED:START-->
- [How to Engage with New Media: A Strategic Guide for Nonprofit Organizations](https://carnegieendowment.org/research/2026/08/how-to-engage-with-new-media-a-strategic-guide-for-nonprofit-organizations)
- [How the U.S. Export-Import Bank Can Finally Join the Fight Against Climate Change](https://carnegieendowment.org/research/2026/09/renewable-energy-investment-united-states-exim-export-import-bank)
- [Wrześniowe Soboty Agatowe. Na polach w Rudnie można wykopać swój skarb. Całe rodziny ruszyły na poszukiwania z młotkami i motykami - Dziennik Polski](https://news.google.com/atom/articles/CBMigwJBVV95cUxORHJrU3lQU0JreFdBeEY2ZEswazltaW1wN2ExV3N2RUpCLXdaT3dEdXRHLTlDcjdSTzlwZWhjaEx3cU5iT1lSeUFCY1ROc090SUk4cFhCVFNYYzFLQkU0YWVCX0hiUGR2YURRc0J0V1B5YmZveWVVbWFnbndQSnQ0NzZBVGs4UTdWYUV5QUZwTTJlcjc5UXhyU19faUVTY3JUQWlhNHkteGZ1Xzg2TlZoR1hIb1FRbjZ6dHZOMkF0YXF4eHlxaUp3eGVhcTczd3dCdTBxLUhYQmd6R0QyazQ3aXBWSGdsMktqX1JBUUMxT0Nud1hlMTJqWFBFc1JuMjA0OEVv?oc=5)
- [WOW! Ten zwiastun jest tak dobry, że twórcy muszą udowadniać, że to nie sztuczna inteligencja](https://antyweb.pl/wow-ten-zwiastun-jest-tak-dobry-ze-tworcy-musza-udowadniac-ze-to-nie-sztuczna-inteligencja)
- [Ubisoft nie uczy się nawet na własnych sukcesach. Heroes III Remake to obnaża](https://antyweb.pl/ubisoft-nie-uczy-sie-nawet-na-wlasnych-sukcesach-heroes-iii-remake-to-obnaza)
- [Nietrzeźwy pieszy wbiegł na czerwonym świetle. Potrącenie na ulicy Dąbrowskiego - oswiecimonline.pl](https://news.google.com/atom/articles/CBMirgFBVV95cUxOQlBRWS1jVlNiRnBoQkFaYjJOTVZQS1VSLVhReFo0ZXF4QVMwUTFjaW00MWdHdnNEWHE3Zm9wQkEyTEczaGIyalQzSzJOZ2ZlVGJYb2xQaVREWEZMck55WXQyR0xNSURob0kxNFNKd0lTUzYtUzZxX1pPZkFSTGNMcmJHTmFSUE9La1hyWHNrTFZRLTBGbVdKUnFsd1RWTl9Tc010S2pvcG1FN2VUQVE?oc=5)
<!--README_FEED:END-->
