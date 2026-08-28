[![Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://cloudflare.com) [![refresh](https://github.com/trvny/tvpi/actions/workflows/refresh.yml/badge.svg)](https://github.com/trvny/tvpi/actions/workflows/refresh.yml) <a href="https://deepwiki.com/trvny/tvpi"><img src="https://deepwiki.com/badge.svg" alt="DeepWiki"></a>  
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare%20Workers-F38020?logo=cloudflareworkers&logoColor=fff&style=flat)](https://tvpi.travny.workers.dev) [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=fff&style=flat)](https://trfny.com/)

[Polski](README_pl.md) · [English](README.md) · **简体中文**

# [TVP Live IPTV 📺](https://trfny.com/tv/)

---

> ## ⚠️ 当前状态：住宅网络推送方案已验证
>
> TVP 对非波兰基础设施仍返回 `GEOIP_FILTER_FAILED`（403），因此 GitHub Actions 和 Cloudflare 无法独立刷新大多数频道。
>
> 住宅网络推送路径已经实现，并在波兰家庭网络上完成端到端测试。`scripts/residential_push.py` 成功刷新 **9/9** 个频道，将校验并标准化后的 HLS manifest 推送到 Worker；刷新后，九个稳定的 Worker `.m3u8` 地址均可正常播放。
>
> 这证明**方案本身有效**，但 TVPI 目前仍不能保证 24/7 可用。需要一台使用波兰住宅 IP 的设备大约每 10 分钟运行一次推送器，而当前维护者无法让该设备全天在线，因此偶发中断或旧缓存回退属于预期情况。
>
> 仍在寻找可长期运行的波兰住宅 runner / 主机。见 [issue #15](https://github.com/trvny/tvpi/issues/15)。

---

## 合并播放列表

TVP 直播频道以可直接使用的 M3U 播放列表提供。Worker 播放列表包含稳定的逐频道 `.m3u8` 端点；只有播放器真正打开某个频道时，该频道才会解析或返回最新 manifest。

| 来源 | URL 基址 | 刷新方式 | 适合场景 |
|--------|----------|---------|----------|
| **Cloudflare Worker** [`playlist.m3u`](https://tvpi.travny.workers.dev/playlist.m3u) | `https://tvpi.travny.workers.dev` | 打开频道时逐频道刷新 | 可长期保存的稳定播放列表 |
| **GitHub Raw** [`playlist.m3u`](https://raw.githubusercontent.com/trvny/tvpi/main/streams/playlist.m3u) | `https://raw.githubusercontent.com/trvny/tvpi/main/streams/` | Actions 每 15 分钟刷新 | 无 Worker / 离线回退 |

> 为什么有两个？TVP 为每个 HLS URL 签发寿命较短（约 15–30 分钟）的 token。Worker 播放列表指向稳定的 TVPI `.m3u8` URL，因此打开频道时可获得当前已推送 manifest 或解析新 token。GitHub Raw 文件只是定时刷新的静态快照，token 可能在下次刷新前过期。

## 频道

| Logo | 频道 | Worker | Raw 镜像 | 状态 |
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

**状态** badge 会实时请求对应 Worker 端点，因此反映的是该频道当前是否有响应。

Worker 链接本身就是 `.m3u8` 端点，会 **302 重定向到带有最新 token 的 HLS manifest**。URL 本身稳定可保存，可直接放进自己的播放列表。对于偏好嵌套播放列表的播放器，同路径仍提供普通 `.m3u` 文件。

> **提示：** [jsDelivr CDN 镜像](https://www.jsdelivr.com/github) 有时比 raw.githubusercontent.com 更稳定：
> ```
> https://cdn.jsdelivr.net/gh/trvny/tvpi@main/streams/playlist.m3u
> ```
> 但 jsDelivr 缓存较激进，而 token 寿命很短。如果遇到旧流，优先使用 Raw URL 或 Worker。

## 工作原理

[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff&style=flat)](https://www.python.org/)  
Raw 文件路径：
1. **GitHub Actions** 每 15 分钟运行一次 `generate.py`。
2. 脚本调用 TVP API 获取新的签名 HLS token URL。
3. 若发生临时故障，会复用该频道最后一次可用 URL，而不是用占位符覆盖；随后写入并提交 `streams/*.m3u`。
4. 播放器读取 Raw 文件。

```
GitHub Actions（每 15 分钟）
        │
        ▼
   vod.tvp.pl API  ──►  签名 HLS token URL（TTL ~15–30 分钟）
        │
        ▼
   streams/*.m3u 提交到仓库
        │
        ▼
  raw.githubusercontent.com/…/streams/playlist.m3u
        │
        ▼
   IPTV 播放器 🎬
```

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff&style=flat-square)](https://www.typescriptlang.org/)  
Worker 的合并播放列表不会提前解析 token，而是列出稳定频道端点。频道被打开时，端点才会返回当前推送的 manifest，或执行正常的缓存/在线/回退解析。

## 设置

1. Fork 本仓库，或推送到自己的 GitHub 账号。
2. Actions 会自动运行，不需要 secrets 或额外配置。
3. 第一次运行后（最多约 15 分钟），把 Raw URL 加入播放器；也可以部署 `worker/`（`wrangler deploy`）并使用 Worker URL。

## 备注

- 表格中的 logo 是渲染时从频道网站 favicon 获取；**状态** badge 通过 shields.io 实时请求 Worker，可能因 badge 缓存稍有延迟。
- TVP token TTL 约为 15–30 分钟。15 分钟刷新通常能让 Raw 文件保持有效，但 GitHub 在高负载时可能延迟计划任务；Worker 路径不会受静态 token 过期影响。
- 如果 `generate.py` 无法获取新 URL，而且某频道也没有缓存，会写入占位 stub，从而让其余播放列表仍能正常生成。

## [许可证](LICENSE)

<a href="https://spdx.org/licenses/ISC"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.shieldcn.dev/github/license/trvny/tvpi.svg?variant=branded&size=xm&mode=dark&theme=neutral&font=jetbrains-mono"><img alt="License" src="LICENSE"></picture></a>

## 其他项目

[![feeds](https://github.com/trvny/.github/blob/main/assets/profile/pin-feeds.svg)](https://github.com/trvny/feedseek) [![wam](https://github.com/trvny/.github/blob/main/assets/profile/pin-wambridge.svg)](https://github.com/trvny/wambridge)

## 💬 抽屉里的引语

<!-- markdownlint-disable MD033 -->
<!--STARTS_HERE_QUOTE_README-->
<i>❝As you age naturally, your family shows more and more on your face. If you deny that, you deny your heritage. — Frances Conroy❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 小新闻

<!--README_FEED:START-->
- [Urban Word of the Day — grebo](https://www.urbandictionary.com/define.php?term=grebo&defid=1975218)
- [How to Engage with New Media: A Strategic Guide for Nonprofit Organizations](https://carnegieendowment.org/research/2026/08/how-to-engage-with-new-media-a-strategic-guide-for-nonprofit-organizations)
- [Urban Word of the Day — board chow](https://www.urbandictionary.com/define.php?term=board%20chow&defid=2568411)
- [Na ten sprzęt Apple czekam bardziej niż na iPhone'a 18 Pro. Premiera już niebawem](https://antyweb.pl/na-ten-sprzet-apple-czekam-bardziej-niz-na-iphonea-18-pro-premiera-juz-niebawem)
- [Wizyta na placu budowy zaplecza Kolei Małopolskich w Oświęcimiu - DlaWas.Info](https://news.google.com/atom/articles/CBMisgFBVV95cUxNdlJsU21iWnJfMmhnaWtjaEJwV0w1NzNob3V5M2J4SnUtakxHTGRYMXp5cTNNTFd6Y0l3UzZqeWVtb2lndDhiRXdNVEljdzZTZHFJeGx4TlpvYmlmV2VId2JsYjA2STRDeW5TOF96VWFJc0R2RkVRb05ISTVDVndoNERWVWgwODdpSkUxanFQRmxPMmhmUW1Lb0RoV2l6a0gwam1ST0tDYnpoNGlyNG0zNzFB?oc=5)
- [Czy warto wyciągać ładowarki z gniazdka, czy to mit?](https://antyweb.pl/czy-warto-wyciagac-ladowarki-z-gniazdka-czy-to-mit)
<!--README_FEED:END-->
