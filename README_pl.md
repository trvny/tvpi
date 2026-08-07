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
<i>❝“There are only two things wrong with C++:  The initial concept and the implementation.”— Bertrand Meyer❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Mininewsy

<!--README_FEED:START-->
- [How Populist Middle Powers Are—and Are Not—Reshaping Global Politics](https://carnegieendowment.org/research/2026/08/how-populist-middle-powers-areand-are-notreshaping-global-politics)
- [Trump administration to impose 15% tariff in polysilicon probe meant to counter China](https://news.google.com/rss/articles/CBMirgFBVV95cUxON0ctWlNTcE9CNEpzbmE4cXRCdFVEU2k2dVpMNjc0M0xLQU1hSWR2MmgwZjdXenNzVnlSM0dGUWVmVlJzUGJ1b3kxV0NReVNqRFItdHlqbzcwR085cmJ5NFRBRlNWTXBRLXRRcmh1Uzl0Wmo2N2d3Wjd1MmpKNkN6Umo4bHlZdFhsbUZYWTVFeGhBUjVCZ3pyNy1EYkVFaWMzVC1ZSzRlQnVYS21LZWc?oc=5)
- [US Senate confirms Schwartz as CDC director](https://news.google.com/rss/articles/CBMiigFBVV95cUxPdUlSeHMyTFMzMzBSYXp5UHJJZ2dQTEZJYTJ5c1dtdWZHaXJ0WUNMRnVIRkpJY2c5dlRWcVdybmVPbFhJcHZ1XzBaZHRPWUJlY181eDItTEtraEY3d0V6dGJRVE9ReXFJcnktcGJEY25nRWtTbGFpRzQ5UXZXSkVVRWJZYTNrM21fQ0E?oc=5)
- [Etsy lays off 12% of workforce as part of restructuring plan](https://news.google.com/rss/articles/CBMiqgFBVV95cUxOYWh3SWlrVGlSZDBVdnBWajVZS3N1ejdBVVN6SlY2V3JIdVRQOVc2VGFtX1Y1MHNsblFON3pWVkhZbHU4WmtoQWZWNlZJQUZLMDlkMTEyNDBycEd1Y3BMMXRHUDNnSHZMNHdFY3FycS12R080bTZ5TEVfQmFzOE1ONzJ5WlpMS0trVFV6T3lpRFo2WVRiSUpOWW5hZDlZczgtdnhYeEVZRnBrQQ?oc=5)
- [ZKKM Chrzanów uruchamia nową linię i zwiększa liczbę połączeń - Przelom.pl](https://news.google.com/atom/articles/CBMirwFBVV95cUxQdDkxMHY5VUR3VW5RZmZLWGxPaXRjZ1Z4U2QxbDZNYS1uLWl6Q1oyUVRlUHEtQTh3QmI5VHFrUEtQNVYxZmo0dTIyT0NUWkExeEVQTmprQlBtZ1RBdm54c1Nfa1FiZG05OUQ0dkU0bTg5cFpvVEx6VTY0NWxBZWprMGtsd0dTYkRERmUwckZZOU1ad2JyWi1LdnJkX0tVT2tLRldWNTdJZXJ5UUZqWi1J?oc=5)
- [EXCLUSIVE: Iran threatens to hit Gulf states if US launches new strikes](https://news.google.com/rss/articles/CBMisAFBVV95cUxPajFnaXk0anVrT2IwaV9XMDBma0pMQU53ZF9LRUJiT01nWjJsdG5FZXhwUjNtZFp2Yy1NV3Q4dFRIeUxzV1pCWk9RMVVZNk1UbWxxMFdiNEdNTG5KSVBVWTRCaWFJSFNlT3RiMFF6RWtqN2pnRThTUU9GaHNfelhwV3RZTXdfMzJwUk1aVlFXZ0FBNk1qWFFmd2xIRWNVWVpmQl9DSkE2NnhMaXlJZ2FFeQ?oc=5)
<!--README_FEED:END-->
