function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function getPosts(context) {
  const url = new URL("/teksty/posts.json", context.request.url);
  const response = await context.env.ASSETS.fetch(url.toString());
  if (!response.ok) throw new Error(`posts.json: ${response.status}`);
  const posts = await response.json();
  if (!Array.isArray(posts) || posts.length === 0) throw new Error("posts.json is empty");
  return posts;
}

function renderEntry(post) {
  const href = `https://trfny.com/teksty/${encodeURIComponent(post.slug)}/`;
  const categories = (post.tags || [])
    .map((tag) => `    <category term="${escapeXml(tag)}"/>`)
    .join("\n");
  const summary = escapeXml(`<p>${post.summary}</p>`);
  return `  <entry>
    <title>${escapeXml(post.title)}</title>
    <id>${href}</id>
    <link rel="alternate" href="${href}"/>
    <updated>${escapeXml(post.updated)}</updated>
${categories}
    <summary type="html">${summary}</summary>
  </entry>`;
}

export async function onRequestGet(context) {
  try {
    const posts = await getPosts(context);
    const updated = posts.reduce(
      (latest, post) => String(post.updated || "") > latest ? String(post.updated) : latest,
      "1970-01-01T00:00:00Z",
    );
    const entries = posts.map(renderEntry).join("\n");
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="pl">
  <title>TRAVNY · Teksty</title>
  <subtitle>Krótkie publikacje, eksperymenty i atlasy z TRAVNY.</subtitle>
  <id>https://trfny.com/teksty/</id>
  <link rel="alternate" href="https://trfny.com/teksty/"/>
  <link rel="self" type="application/atom+xml" href="https://trfny.com/teksty/feed.xml"/>
  <updated>${escapeXml(updated)}</updated>
  <author><name>TRAVNY</name></author>
${entries}
</feed>
`;
    return new Response(xml, {
      headers: {
        "content-type": "application/atom+xml; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    return new Response(`Feed unavailable: ${error instanceof Error ? error.message : "unknown error"}\n`, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
