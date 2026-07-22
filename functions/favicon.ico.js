// Some crawlers and source pickers request /favicon.ico directly and ignore
// richer <link rel="icon"> declarations. Point that classic path at the
// existing 96×96 PNG so they do not fall back to a generic globe.
export function onRequestGet(context) {
  const target = new URL("/assets/icon-96.png", context.request.url);
  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
