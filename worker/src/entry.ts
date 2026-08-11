import worker from "./index";

const MANIFEST_MAX_AGE_MS = 15 * 60_000;
const MANIFEST_MAX_BYTES = 512 * 1024;
const manifestKey = (slug: string): string => `manifests/${slug}.m3u8`;

// SHA-256 IDs of per-runner volunteer credentials. IDs are safe to publish;
// the random bearer credentials themselves stay DPAPI-protected on each runner.
const APPROVED_VOLUNTEER_IDS = new Set<string>([]);

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

async function credentialId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function authorizeVolunteer(request: Request, env: Env): Promise<Request> {
  const headers = new Headers(request.headers);
  headers.delete("X-TVPI-Volunteer");

  const auth = headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token.startsWith("v1_")) return new Request(request, { headers });

  const id = await credentialId(token);
  if (APPROVED_VOLUNTEER_IDS.has(id) && env.PUSH_TOKEN) {
    headers.set("Authorization", `Bearer ${env.PUSH_TOKEN}`);
    headers.set("X-TVPI-Volunteer", id);
  }
  return new Request(request, { headers });
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
      const forwarded = await authorizeVolunteer(request, env);
      let manifest: string | null = null;
      try {
        const body = (await forwarded.clone().json()) as { manifest?: unknown };
        manifest = pushedManifest(body.manifest);
      } catch {
        // The base Worker returns the canonical invalid-JSON response.
      }

      const response = await worker.fetch(forwarded, env, ctx);
      if (response.ok) {
        await syncManifest(env, path.slice("/push/".length), manifest);
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
