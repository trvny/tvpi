const ARTICLE_URL =
  "https://raw.githubusercontent.com/trvny/trvny/main/stuff/other/token-worldcup.html";

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  try {
    const upstream = await fetch(ARTICLE_URL, {
      method,
      headers: { accept: "text/html" },
      cf: { cacheEverything: true, cacheTtl: 300 },
    });

    if (!upstream.ok) {
      return new Response(method === "HEAD" ? null : "Article source unavailable.", {
        status: 502,
        headers: { "cache-control": "no-store" },
      });
    }

    const headers = new Headers(upstream.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
    headers.set("x-trvny-source", ARTICLE_URL);
    headers.delete("content-disposition");
    headers.delete("content-length");

    return new Response(method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers,
    });
  } catch {
    return new Response(method === "HEAD" ? null : "Article source unavailable.", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
