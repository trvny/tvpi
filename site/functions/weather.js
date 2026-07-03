// GET /weather  →  proxies weather.travny.workers.dev/state.json
// The upstream worker sends no CORS header, so a browser fetch from
// tvpi.pages.dev is blocked. This same-origin Pages Function re-serves the
// JSON with Access-Control-Allow-Origin:* and a short edge cache.
export async function onRequest() {
  const UPSTREAM = "https://weather.travny.workers.dev/state.json";
  const cors = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=300",
  };
  try {
    const res = await fetch(UPSTREAM, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!res.ok) return new Response(`{"error":"upstream_${res.status}"}`, { status: 502, headers: cors });
    return new Response(await res.text(), { status: 200, headers: cors });
  } catch {
    return new Response(`{"error":"upstream_unreachable"}`, { status: 502, headers: cors });
  }
}
