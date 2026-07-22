const CHANNELS = [
  { id: "399697", no: "101", slug: "tvp1", tag: "TVP1", name: "TVP 1 HD" },
  { id: "399698", no: "102", slug: "tvp2", tag: "TVP2", name: "TVP 2 HD" },
  { id: "399699", no: "103", slug: "tvpinfo", tag: "INFO", name: "TVP Info" },
  { id: "399702", no: "104", slug: "tvpsport", tag: "SPORT", name: "TVP Sport" },
  { id: "399721", no: "105", slug: "tvpdokument", tag: "DOK", name: "TVP Dokument" },
  { id: "399722", no: "106", slug: "tvpnauka", tag: "NAUKA", name: "TVP Nauka" },
  { id: "399724", no: "107", slug: "tvprozrywka", tag: "ROZR", name: "TVP Rozrywka" },
  { id: "399703", no: "108", slug: "tvphistoria", tag: "HIST", name: "TVP Historia" },
  { id: "2999109", no: "109", slug: "tvpmuzyka", tag: "MUZ", name: "TVP Muzyka i Koncerty" },
];

const TV_WORKER = "https://tvpi.travny.workers.dev";
const WEATHER_STATE = "https://weather.travny.workers.dev/state.json";

const PAGE_META = {
  home: {
    title: "TRAVNY: TVP IPTV, pogoda Chrzanów i feedy RSS",
    description:
      "Telegazetowy hub: aktualne playlisty TVP IPTV, pogoda dla Kościelca i Chrzanowa oraz najnowsze wpisy z własnego czytnika RSS.",
    h1: 'TRAVNY<small class="h1seo">TVP IPTV · POGODA CHRZANÓW · FEEDY RSS</small>',
    schema: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "TRAVNY",
      alternateName: "TRAVNY Telegazeta",
      url: "https://tvpi.pages.dev/",
      inLanguage: "pl-PL",
      description:
        "Hub z playlistami TVP IPTV, pogodą dla Chrzanowa i Kościelca oraz feedami RSS.",
    },
  },
  tv: {
    title: "TVPI: aktualne playlisty TVP IPTV M3U",
    description:
      "Aktualne playlisty IPTV M3U dla kanałów TVP. Stabilne adresy do VLC, Kodi, TiviMate i innych odtwarzaczy, odświeżane przez Cloudflare Worker.",
    h1: 'TVPI<small class="h1seo">AKTUALNE PLAYLISTY TVP IPTV M3U</small>',
    schema: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "TVPI",
      url: "https://tvpi.pages.dev/tv/",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      inLanguage: "pl-PL",
      description: "Aktualne playlisty IPTV M3U dla kanałów Telewizji Polskiej.",
    },
  },
};

const CONDITIONS = {
  clear: ["Słonecznie", "☀"],
  clouds: ["Pochmurno", "☁"],
  fewclouds: ["Mało chmur", "⛅"],
  rain: ["Deszcz", "🌧"],
  drizzle: ["Mżawka", "🌦"],
  snow: ["Śnieg", "❄"],
  thunder: ["Burza", "⚡"],
  fog: ["Mgła", "🌫"],
  mist: ["Mgiełka", "🌫"],
  unknown: ["Brak danych", "•"],
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roundMedian(group) {
  const value = group?.median;
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
}

function aqiClass(value) {
  const aqi = Number(value);
  if (!Number.isFinite(aqi)) return ["mid", "?"];
  if (aqi <= 40) return ["good", String(Math.round(aqi))];
  if (aqi <= 80) return ["mid", String(Math.round(aqi))];
  return ["bad", String(Math.round(aqi))];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getWeather() {
  try {
    const response = await fetchWithTimeout(WEATHER_STATE, {
      cf: { cacheTtl: 300, cacheEverything: true },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function getChannels() {
  try {
    // One combined request is much cheaper than nine separate channel probes.
    // The playlist contains only channels for which the Worker found a usable URL.
    const response = await fetchWithTimeout(`${TV_WORKER}/playlist.m3u`, {
      cf: { cacheTtl: 120, cacheEverything: true },
      headers: { accept: "audio/x-mpegurl,text/plain;q=0.9,*/*;q=0.1" },
    }, 3000);
    if (!response.ok) {
      return CHANNELS.map((channel) => ({ ...channel, status: false }));
    }
    const playlist = await response.text();
    return CHANNELS.map((channel) => ({
      ...channel,
      status: playlist.includes(`tvg-id="${channel.id}"`),
    }));
  } catch {
    // Unknown is intentional: the existing browser-side checks remain the fallback.
    return CHANNELS.map((channel) => ({ ...channel, status: null }));
  }
}

function channelClass(status) {
  if (status === true) return "on";
  if (status === false) return "off";
  return "";
}

function renderHubChips(channels) {
  return channels
    .map(
      (channel) =>
        `<span class="chip ${channelClass(channel.status)}" id="c-${channel.slug}">` +
        `<span class="d">${channel.no}</span>${escapeHtml(channel.tag)}</span>`,
    )
    .join("");
}

function renderTvRows(channels) {
  return channels
    .map((channel) => {
      const statusClass = channel.status === true ? "on" : channel.status === false ? "off" : "chk";
      const statusText = channel.status === true ? "NADAJE" : channel.status === false ? "BRAK" : "SPRAWDŹ";
      const stream = `${TV_WORKER}/${channel.slug}.m3u8`;
      return (
        `<div class="row" role="button" tabindex="0" data-copy="${stream}" data-slug="${channel.slug}">` +
        `<span class="no">${channel.no}</span>` +
        `<span class="nm">${escapeHtml(channel.name)}</span>` +
        `<span class="lead"></span>` +
        `<span class="st ${statusClass}" id="st-${channel.slug}">${statusText}</span>` +
        `<span class="cp">⤓ COPY</span></div>`
      );
    })
    .join("");
}

function renderWeather(state) {
  if (!state) return null;

  const ensemble = state.ensemble || {};
  const temperature = roundMedian(ensemble.tempC);
  const feels = roundMedian(ensemble.feelsC);
  const wind = roundMedian(ensemble.windMs);
  const humidity = roundMedian(ensemble.humidity);
  const [conditionText, conditionIcon] = CONDITIONS[ensemble.condition] || CONDITIONS.unknown;
  const air = state.airQuality || {};
  const [airClass, airValue] = aqiClass(air.europeanAqi);

  const pollen =
    air.topPollen && Number(air.topPollen.grains) > 0
      ? ` · pyłki: <span class="g">${escapeHtml(air.topPollen.species)} ${escapeHtml(air.topPollen.grains)}</span>`
      : "";

  const warnings = Array.isArray(state.warnings)
    ? state.warnings.filter((warning) => warning?.event)
    : [];

  return {
    temperature: `${temperature ?? "—"}°`,
    condition: `${conditionIcon} ${escapeHtml(conditionText)}`,
    meta:
      `odczuwalna <b>${feels == null ? "—" : `${feels}°`}</b> · ` +
      `wiatr <b>${wind == null ? "—" : `${wind} m/s`}</b> · ` +
      `wilg. <b>${humidity == null ? "—" : `${humidity}%`}</b>` +
      `<br>AQI <span class="aqi ${airClass}">${airValue}</span>${pollen}`,
    warning:
      warnings.length > 0
        ? `⚠ ${escapeHtml(warnings[0].event)}${warnings.length > 1 ? ` · +${warnings.length - 1}` : ""}`
        : "",
  };
}

class SetAttribute {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
  element(element) {
    element.setAttribute(this.name, this.value);
  }
}

class SetText {
  constructor(value, html = false) {
    this.value = value;
    this.html = html;
  }
  element(element) {
    element.setInnerContent(this.value, { html: this.html });
  }
}

class SetMetaContent {
  constructor(value) {
    this.value = value;
  }
  element(element) {
    element.setAttribute("content", this.value);
  }
}

class HeadExtras {
  constructor(page, meta) {
    this.page = page;
    this.meta = meta;
  }
  element(element) {
    const twitter =
      this.page === "tv"
        ? `<meta name="twitter:title" content="${escapeHtml(this.meta.title)}">` +
          `<meta name="twitter:description" content="${escapeHtml(this.meta.description)}">`
        : "";

    element.append(
      `<meta property="og:locale" content="pl_PL">${twitter}` +
        `<style>h1 .h1seo{display:block;margin-top:9px;font-family:"VT323",monospace;` +
        `font-size:clamp(16px,2.6vw,22px);font-weight:400;line-height:1.1;letter-spacing:.055em;` +
        `color:var(--c);text-shadow:0 0 5px}</style>` +
        `<script type="application/ld+json">${JSON.stringify(this.meta.schema).replaceAll("<", "\\u003c")}</script>`,
      { html: true },
    );
  }
}

function identifyPage(pathname) {
  if (pathname === "/" || pathname === "/index.html") return "home";
  if (pathname === "/tv" || pathname === "/tv/" || pathname === "/tv/index.html") return "tv";
  return null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const page = identifyPage(url.pathname);

  if (context.request.method !== "GET" || !page) {
    return context.next();
  }

  const needsWeather = page === "home";
  const [assetResponse, channels, weatherState] = await Promise.all([
    context.next(),
    getChannels(),
    needsWeather ? getWeather() : Promise.resolve(null),
  ]);

  const contentType = assetResponse.headers.get("content-type") || "";
  if (!assetResponse.ok || !contentType.includes("text/html")) {
    return assetResponse;
  }

  const meta = PAGE_META[page];
  const online = channels.filter((channel) => channel.status === true).length;
  const known = channels.some((channel) => channel.status !== null);
  const countText = known ? `${online}/${channels.length}` : `—/${channels.length}`;

  let rewriter = new HTMLRewriter()
    .on("html", new SetAttribute("lang", "pl"))
    .on("title", new SetText(meta.title))
    .on('meta[name="description"]', new SetMetaContent(meta.description))
    .on('meta[property="og:title"]', new SetMetaContent(meta.title))
    .on('meta[property="og:description"]', new SetMetaContent(meta.description))
    .on('meta[name="twitter:title"]', new SetMetaContent(meta.title))
    .on('meta[name="twitter:description"]', new SetMetaContent(meta.description))
    .on("head", new HeadExtras(page, meta))
    .on("h1", new SetText(meta.h1, true));

  if (page === "home") {
    rewriter = rewriter
      .on("#tvchips", new SetText(renderHubChips(channels), true))
      .on("#tvbig", new SetText(countText))
      .on("#tvcount", new SetText(`${countText} ON AIR`));

    const weather = renderWeather(weatherState);
    if (weather) {
      rewriter = rewriter
        .on("#wxtemp", new SetText(weather.temperature))
        .on("#wxcond", new SetText(weather.condition, true))
        .on("#wxmeta", new SetText(weather.meta, true));
      if (weather.warning) {
        rewriter = rewriter
          .on("#wxwarn", new SetText(weather.warning))
          .on("#wxwarn", new SetAttribute("class", "wxwarn show"));
      }
    }
  } else {
    rewriter = rewriter
      .on("#rows", new SetText(renderTvRows(channels), true))
      .on("#chCount", new SetText(`${countText} ON AIR`));
  }

  const transformed = rewriter.transform(assetResponse);
  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "public, max-age=0, s-maxage=120, stale-while-revalidate=300");
  headers.set("content-language", "pl");
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}
