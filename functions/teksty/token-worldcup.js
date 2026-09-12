const ARTICLE_URL =
  "https://raw.githubusercontent.com/trvny/trvny/main/stuff/other/token-worldcup/token-worldcup.html";

export async function onRequest(context) {
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "GET, HEAD" },
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let upstream;
    let body = null;
    try {
      upstream = await fetch(ARTICLE_URL, {
        method,
        headers: { accept: "text/html" },
        cf: { cacheEverything: true, cacheTtl: 300 },
        signal: controller.signal,
      });
      if (upstream.ok && method === "GET") body = await upstream.text();
    } finally {
      clearTimeout(timer);
    }

    if (!upstream.ok) {
      return new Response(method === "HEAD" ? null : "Article source unavailable.", {
        status: 502,
        headers: { "cache-control": "no-store" },
      });
    }

    const headers = new Headers({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      "x-trvny-source": ARTICLE_URL,
    });

    return new Response(body, {
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
