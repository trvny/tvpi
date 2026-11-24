import worker from "./index";
import { CHANNELS, buildStablePlaylist, publicChannels } from "./channels";

const MANIFEST_MAX_AGE_MS = 15 * 60_000;
const MANIFEST_MAX_BYTES = 512 * 1024;
const manifestKey = (slug: string): string => `manifests/${slug}.m3u8`;

// SHA-256 IDs of per-runner volunteer credentials. IDs are safe to publish;
// the random bearer credentials themselves stay DPAPI-protected on each runner.
const APPROVED_VOLUNTEER_IDS = new Set<string>([]);

const WORKER_ORIGIN = "https://tvpi.travny.workers.dev";
const WORKER_ROBOTS = `User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: OAI-AdsBot
User-agent: ChatGPT-User
User-agent: anthropic-ai
User-agent: ClaudeBot
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: MistralAI-Index
User-agent: MistralAI-Training
User-agent: MistralAI-User
User-agent: KimiBot
User-agent: Kimi-SearchBot
User-agent: Kimi-User
User-agent: Meta-WebIndexer
User-agent: Meta-ExternalFetcher
User-agent: Meta-ExternalAgent
User-agent: Googlebot
User-agent: Googlebot-News
User-agent: Googlebot-Image
User-agent: Googlebot-Video
User-agent: GoogleOther
User-agent: GoogleOther-Image
User-agent: GoogleOther-Video
User-agent: Google-InspectionTool
User-agent: Google-Extended
User-agent: Applebot
User-agent: Applebot-Extended
User-agent: BingBot
User-agent: DuckDuckBot
User-agent: DuckAssistBot
User-agent: YandexBot
User-agent: YandexFavicons
User-agent: CCBot
User-agent: SemanticScholarBot
Content-Signal: ai-train=yes, search=yes, ai-input=yes
Allow: /
Disallow: /push/

User-agent: *
Content-Signal: ai-train=yes, search=yes, ai-input=yes
Allow: /
Disallow: /push/
`;
const WORKER_INDEX_MD = `# TVPI streaming Worker

> Stable M3U and HLS entry points for the TVP channels exposed by TRAVNY.

- [Combined playlist](${WORKER_ORIGIN}/playlist.m3u)
- [Human TV page](https://travny.pages.dev/tv/)
- [Concise LLM guide](${WORKER_ORIGIN}/llms.txt)
- [Full LLM guide](${WORKER_ORIGIN}/llms-full.txt)
- [Source](https://github.com/trvny/tvpi/tree/main/worker)

Resolved upstream stream URLs are short-lived. Use the stable Worker endpoints instead of storing tokenized HLS URLs.
`;
const WORKER_LLMS = `# TVPI streaming Worker

> Stable public M3U/HLS gateway for TRAVNY's TVP channel list.

## Resources

- [Worker overview](${WORKER_ORIGIN}/index.md): Markdown description of the Worker.
- [Combined playlist](${WORKER_ORIGIN}/playlist.m3u): stable M3U containing all channel endpoints.
- [Human TV page](https://travny.pages.dev/tv/index.md): Markdown page for the browser UI.
- [Full LLM guide](${WORKER_ORIGIN}/llms-full.txt): complete Worker guide.
- [Source](https://github.com/trvny/tvpi/tree/main/worker): implementation and deployment files.
`;
const WORKER_LLMS_FULL = `# TVPI streaming Worker full documentation

Source: ${WORKER_ORIGIN}/

Description: Complete LLM-oriented guide to the public TVPI streaming Worker.

## Stable playlist model

GET / or GET /playlist.m3u returns a stable combined M3U. Its entries point to per-channel .m3u8 endpoints on the same Worker. Those endpoints serve a recently pushed manifest where available or fall through to the normal TVPI resolution stack.

## Freshness

TVP upstream signatures are short-lived. Clients should store the stable Worker endpoint, not a resolved tokenized upstream URL. The project can use a Polish residential refresh path because TVP geo-filtering prevents some server-side environments from refreshing every channel directly.

## Public resources

- [Combined playlist](${WORKER_ORIGIN}/playlist.m3u)
- [Markdown Worker overview](${WORKER_ORIGIN}/index.md)
- [Human TV page](https://travny.pages.dev/tv/index.md)
- [Source](https://github.com/trvny/tvpi/tree/main/worker)

## Non-public operation

POST /push/<slug> is an authenticated maintenance path. Discovery documentation intentionally does not expose credentials or operational secrets.
`;

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
    if (!Number.isFinite(timestamp) || timestamp > Date.now()
      || Date.now() - timestamp > MANIFEST_MAX_AGE_MS) {
      return null;
    }

    return await object.text();
  } catch {
    return null;
  }
}

function withStreamDiscovery(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  headers.set(
    "Link",
    '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"',
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isPublicStreamPath(path: string): boolean {
  return path === "/"
    || path === "/playlist.m3u"
    || path.endsWith(".m3u")
    || path.endsWith(".m3u8");
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

    // Read-only catalog; no signed upstream URLs in the public API.
    if ((request.method === "GET" || request.method === "HEAD") && path === "/api/channels") {
      return new Response(request.method === "HEAD" ? null : JSON.stringify({
        version: 1, playlistUrl: `${WORKER_ORIGIN}/playlist.m3u`,
        channels: publicChannels(WORKER_ORIGIN),
      }), { headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=120",
        "Access-Control-Allow-Origin": "*",
        "X-Robots-Tag": "noindex, nofollow",
      } });
    }

    if ((request.method === "GET" || request.method === "HEAD") && path === "/api/status") {
      if (request.method === "HEAD") {
        return new Response(null, { headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
          "X-Robots-Tag": "noindex, nofollow",
        } });
      }
      const channels = await Promise.all(CHANNELS.map(async (ch) => {
        try {
          const object = await env.MIRROR.head(manifestKey(ch.slug));
          if (!object) return { slug: ch.slug, manifest: "missing", updatedAt: null };
          const ts = Number(object.customMetadata?.ts);
          const fresh = Number.isFinite(ts) && ts > 0 && ts <= Date.now()
            && Date.now() - ts < MANIFEST_MAX_AGE_MS;
          return {
            slug: ch.slug, manifest: fresh ? "fresh" : "stale",
            updatedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null,
          };
        } catch {
          return { slug: ch.slug, manifest: "unknown", updatedAt: null };
        }
      }));
      return new Response(JSON.stringify({
        version: 1, generatedAt: new Date().toISOString(),
        meaning: "R2 pushed-manifest freshness only; playback not verified.",
        channels,
      }), { headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "X-Robots-Tag": "noindex, nofollow",
      } });
    }

    const discovery = new Map<string, [string, string, number]>([
      ["/robots.txt", [WORKER_ROBOTS, "text/plain; charset=utf-8", 86400]],
      ["/index.md", [WORKER_INDEX_MD, "text/markdown; charset=utf-8", 3600]],
      ["/llms.txt", [WORKER_LLMS, "text/plain; charset=utf-8", 3600]],
      ["/llms-full.txt", [WORKER_LLMS_FULL, "text/plain; charset=utf-8", 3600]],
    ]).get(path);
    if (discovery && (request.method === "GET" || request.method === "HEAD")) {
      const [body, contentType, maxAge] = discovery;
      return new Response(request.method === "HEAD" ? null : body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${maxAge}`,
        },
      });
    }

    if (request.method === "GET" && (path === "/" || path === "/playlist.m3u")) {
      return new Response(buildStablePlaylist(url.origin), {
        headers: {
          "Content-Type": "application/x-mpegurl",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
          "X-Playlist-Type": "stable-channel-endpoints",
          "X-Robots-Tag": "noindex, nofollow",
          "Link": '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"',
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
            "X-Robots-Tag": "noindex, nofollow",
            "Link": '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"',
          },
        });
      }
    }

    const delegated = await worker.fetch(request, env, ctx);
    return isPublicStreamPath(path) ? withStreamDiscovery(delegated) : delegated;
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    return worker.scheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<Env>;
