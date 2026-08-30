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

// Several hosts reach this same site/ output, and they are treated differently.
//
// trfny.com is the canonical address since 2026-08-16, when the domain was
// registered. Every absolute URL in the markup — canonical, og:url, sitemap,
// robots — points there, so search engines consolidate on the domain we own
// rather than on a pages.dev subdomain we merely rent.
//
// travny.pages.dev keeps serving as an emergency fallback, but HTML responses
// are marked noindex so the fallback cannot compete with trfny.com in search.
// If the custom domain ever needs to be retired, promote the fallback explicitly
// by changing the canonical host and removing that response directive.
//
// tvpi.pages.dev answers only with a redirect. Both Pages projects build from
// this same repository and the same site/ output, so the old host cannot be
// retired with a _redirects file — that file would apply to the new site too.
// Matching on the Host header keeps one codebase serving both. Matching is
// exact, so per-deployment aliases (<hash>.tvpi.pages.dev) are left alone;
// redirecting those would point at a hash that does not exist elsewhere.
const REDIRECT_HOSTS = new Set(["tvpi.pages.dev", "www.trfny.com"]);
const FALLBACK_HOST = "travny.pages.dev";
const CANONICAL_HOST = "trfny.com";

function isFallbackHost(hostname) {
  return hostname === FALLBACK_HOST || hostname.endsWith(`.${FALLBACK_HOST}`);
}

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

// Returns the body already read, because the abort signal has to stay armed
// until then: a server that answers with headers immediately and then drips
// the body would otherwise hold the page render open with no bound at all.
// The timeout covers the whole exchange, not just the wait for headers.
async function fetchWithTimeout(url, options = {}, timeoutMs = 4500, parse = "text") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) return { ok: false, body: null };
    return { ok: true, body: parse === "json" ? await response.json() : await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function getWeather() {
  try {
    const { ok, body } = await fetchWithTimeout(WEATHER_STATE, {
      cf: { cacheTtl: 300, cacheEverything: true },
      headers: { accept: "application/json" },
    }, 4500, "json");
    return ok ? body : null;
  } catch {
    return null;
  }
}

// The edge cannot know which channels are actually up, so it says so.
//
// This used to derive availability from membership in /playlist.m3u, on the
// stated assumption that "the playlist contains only channels for which the
// Worker found a usable URL". That assumption is false against the deployed
// Worker: buildStablePlaylist (worker/src/entry.ts:48) emits all nine channels
// unconditionally from a static array, and advertises exactly that in its
// X-Playlist-Type: stable-channel-endpoints header. A stream is resolved only
// when its own .m3u8 endpoint is opened. So every channel matched, every chip
// rendered "on", and the page reported 9/9 ON AIR whatever the real state was.
//
// Returning null renders the chips without a status class and the /tv rows as
// SPRAWDZ, which the browser checks then resolve for real. Slower to a truthful
// number, but it is a truthful number. Giving the edge a real answer means
// teaching the Worker to report per-channel availability; until then, it has
// nothing to say.
function getChannels() {
  return CHANNELS.map((channel) => ({ ...channel, status: null }));
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

function identifyPage(pathname) {
  if (pathname === "/" || pathname === "/index.html") return "home";
  if (pathname === "/tv" || pathname === "/tv/" || pathname === "/tv/index.html") return "tv";
  return null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Permanent, path- and query-preserving move. 301 (not 302) is what lets
  // Search Console transfer ranking signals to the new host; Google asks for
  // these redirects to stay up at least a year after the move.
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }

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
  const online = channels.filter((channel) => channel.status === true).length;
  const known = channels.some((channel) => channel.status !== null);
  const countText = known ? `${online}/${channels.length}` : `—/${channels.length}`;

  let rewriter = new HTMLRewriter().on("html", new SetAttribute("lang", "pl"));

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
  if (isFallbackHost(url.hostname)) headers.set("x-robots-tag", "noindex, follow");
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}
