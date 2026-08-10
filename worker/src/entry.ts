import worker from "./index";

const MANIFEST_MAX_AGE_MS = 15 * 60_000;
const MANIFEST_MAX_BYTES = 512 * 1024;
const VOLUNTEER_RATE_LIMIT_SECONDS = 60;
const VOLUNTEER_RATE_PREFIX = "https://tvpi-cache/volunteer-push/";
const manifestKey = (slug: string): string => `manifests/${slug}.m3u8`;

const TVP_LOGO = "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png";
const PLAYLIST_CHANNELS = [
  { id: "399697", slug: "tvp1", name: "TVP 1 HD", logo: TVP_LOGO, group: "Polska" },
  { id: "399698", slug: "tvp2", name: "TVP 2 HD", logo: TVP_LOGO, group: "Polska" },
  { id: "399699", slug: "tvpinfo", name: "TVP Info", logo: TVP_LOGO, group: "Polska" },
  { id: "399702", slug: "tvpsport", name: "TVP Sport", logo: TVP_LOGO, group: "Polska" },
  {
    id: "399721",
    slug: "tvpdokument",
    name: "TVP Dokument",
    logo: TVP_LOGO,
    group: "Polska",
  },
  { id: "399722", slug: "tvpnauka", name: "TVP Nauka", logo: TVP_LOGO, group: "Polska" },
  {
    id: "399724",
    slug: "tvprozrywka",
    name: "TVP Rozrywka",
    logo: TVP_LOGO,
    group: "Polska",
  },
  {
    id: "399703",
    slug: "tvphistoria",
    name: "TVP Historia",
    logo: TVP_LOGO,
    group: "Polska",
  },
  {
    id: "2999109",
    slug: "tvpmuzyka",
    name: "TVP Muzyka i Koncerty",
    logo: TVP_LOGO,
    group: "Polska",
  },
] as const;

const KNOWN_LIVE_IDS: Readonly<Record<string, string>> = {
  tvp1: "51689486",
  tvp2: "51696811",
  tvpinfo: "51696820",
  tvpsport: "51696827",
  tvpdokument: "53795159",
  tvpnauka: "71345993",
  tvprozrywka: "51696825",
  tvphistoria: "51696819",
};

function buildStablePlaylist(origin: string): string {
  const lines = ["#EXTM3U"];
  for (const channel of PLAYLIST_CHANNELS) {
    lines.push(
      `#EXTINF:-1 tvg-id="${channel.id}" tvg-name="${channel.name}" tvg-logo="${channel.logo}" group-title="${channel.group}",${channel.name}`,
      `${origin}/${channel.slug}.m3u8`,
    );
  }
  return lines.join("\n") + "\n";
}

function pushedManifest(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MANIFEST_MAX_BYTES) return null;
  return value.trimStart().startsWith("#EXTM3U") ? value : null;
}

function isTvpHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "tvp.pl" || host.endsWith(".tvp.pl");
}

function extractLiveId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !isTvpHost(url.hostname)) return null;
    return url.pathname.match(/\/token\/video\/live\/(\d+)\//)?.[1] ?? null;
  } catch {
    return null;
  }
}

function freshTokenDates(now = Date.now()): ReadonlySet<string> {
  const dates = new Set<string>();
  for (const offsetDays of [-1, 0, 1]) {
    const date = new Date(now + offsetDays * 86_400_000);
    dates.add(
      `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}

function isFreshOfficialUrl(rawUrl: string, liveId: string, masterOnly = false): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !isTvpHost(url.hostname)) return false;

    const marker = `/token/video/live/${liveId}/`;
    if (!url.pathname.startsWith(marker)) return false;
    const remainder = url.pathname.slice(marker.length);
    const tokenDate = remainder.split("/", 1)[0] ?? "";
    if (!freshTokenDates().has(tokenDate)) return false;
    if (masterOnly && !url.pathname.endsWith("/master.m3u8")) return false;
    return true;
  } catch {
    return false;
  }
}

function manifestUrls(manifest: string): string[] {
  const urls: string[] = [];
  for (const line of manifest.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) continue;
    if (!value.startsWith("#")) {
      urls.push(value);
      continue;
    }
    for (const match of value.matchAll(/URI="([^"]+)"/gi)) {
      urls.push(match[1]);
    }
  }
  return urls;
}

async function expectedLiveId(env: Env, slug: string): Promise<string | null> {
  try {
    const row = await env.DB
      .prepare("SELECT url FROM lkg WHERE slug = ?")
      .bind(slug)
      .first<{ url: string }>();
    const learned = row?.url ? extractLiveId(row.url) : null;
    if (learned) return learned;
  } catch {
    // Fall through to the bootstrap map.
  }
  return KNOWN_LIVE_IDS[slug] ?? null;
}

async function hashText(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function claimVolunteerSlot(request: Request, slug: string): Promise<boolean> {
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const key = new Request(`${VOLUNTEER_RATE_PREFIX}${slug}/${await hashText(address)}`);
  if (await caches.default.match(key)) return false;

  await caches.default.put(
    key,
    new Response("1", {
      headers: { "Cache-Control": `public, max-age=${VOLUNTEER_RATE_LIMIT_SECONDS}` },
    }),
  );
  return true;
}

interface PushBody {
  url?: unknown;
  manifest?: unknown;
}

interface ValidatedPush {
  url: string;
  manifest: string;
}

async function validateVolunteerPush(
  env: Env,
  slug: string,
  body: PushBody,
): Promise<ValidatedPush | Response> {
  if (!PLAYLIST_CHANNELS.some((channel) => channel.slug === slug)) {
    return new Response("Unknown channel\n", { status: 404 });
  }

  const liveId = await expectedLiveId(env, slug);
  if (!liveId) {
    return new Response("Volunteer validation is not initialized for this channel\n", {
      status: 503,
    });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const manifest = pushedManifest(body.manifest);
  if (!manifest || !isFreshOfficialUrl(url, liveId, true)) {
    return new Response("Volunteer push must contain a fresh official TVP HLS master and manifest\n", {
      status: 400,
    });
  }

  const references = manifestUrls(manifest);
  if (references.length === 0 || !manifest.toUpperCase().includes("#EXT-X-")) {
    return new Response("Manifest has no HLS references\n", { status: 400 });
  }
  if (!references.every((reference) => isFreshOfficialUrl(reference, liveId))) {
    return new Response("Manifest contains a non-TVP or wrong-channel URL\n", { status: 400 });
  }

  return { url, manifest };
}

async function readManifest(env: Env, slug: string): Promise<string | null> {
  try {
    const object = await env.MIRROR.get(manifestKey(slug));
    if (!object) return null;

    const timestamp = Number(object.customMetadata?.ts);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > MANIFEST_MAX_AGE_MS) {
      return null;
    }

    return await object.text();
  } catch {
    return null;
  }
}

async function syncManifest(env: Env, slug: string, manifest: string | null): Promise<void> {
  try {
    if (!manifest) {
      await env.MIRROR.delete(manifestKey(slug));
      return;
    }

    await env.MIRROR.put(manifestKey(slug), manifest, {
      httpMetadata: {
        contentType: "application/vnd.apple.mpegurl",
        cacheControl: "no-store",
      },
      customMetadata: { ts: Date.now().toString() },
    });
  } catch {
    // The URL push remains usable even when the optional manifest mirror fails.
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    if (request.method === "POST" && path.startsWith("/push/")) {
      const slug = path.slice("/push/".length);
      let manifest: string | null = null;
      let forwarded = request;

      if (request.headers.has("Authorization")) {
        try {
          const body = (await request.clone().json()) as PushBody;
          manifest = pushedManifest(body.manifest);
        } catch {
          // The base Worker returns the canonical invalid-JSON response.
        }
      } else {
        let body: PushBody;
        try {
          body = (await request.json()) as PushBody;
        } catch {
          return new Response("Invalid JSON body\n", { status: 400 });
        }

        const validated = await validateVolunteerPush(env, slug, body);
        if (validated instanceof Response) return validated;
        if (!env.PUSH_TOKEN) {
          return new Response("Push service is not configured\n", { status: 503 });
        }
        if (!(await claimVolunteerSlot(request, slug))) {
          return new Response("Too many volunteer pushes for this channel\n", {
            status: 429,
            headers: { "Retry-After": VOLUNTEER_RATE_LIMIT_SECONDS.toString() },
          });
        }

        manifest = validated.manifest;
        forwarded = new Request(request.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.PUSH_TOKEN}`,
            "Content-Type": "application/json",
            "User-Agent": request.headers.get("User-Agent") ?? "TVPI volunteer",
          },
          body: JSON.stringify(validated),
        });
      }

      const response = await worker.fetch(forwarded, env, ctx);
      if (response.ok) {
        await syncManifest(env, slug, manifest);
      }
      return response;
    }

    if (request.method === "GET" && (path === "/" || path === "/playlist.m3u")) {
      return new Response(buildStablePlaylist(url.origin), {
        headers: {
          "Content-Type": "application/x-mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
          "X-Playlist-Type": "stable-channel-endpoints",
        },
      });
    }

    if (request.method === "GET" && path.endsWith(".m3u8")) {
      const slug = path.slice(1, -".m3u8".length);
      const manifest = await readManifest(env, slug);
      if (manifest) {
        return new Response(manifest, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "X-Source": "push-manifest",
            "X-Manifest": "normalized",
          },
        });
      }
    }

    return worker.fetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    return worker.scheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<Env>;
