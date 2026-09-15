function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCard(post) {
  const slug = /^[a-z0-9-]+$/.test(String(post.slug || "")) ? String(post.slug) : "";
  if (!slug) return "";
  const tags = (post.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  return `<a class="card" href="/teksty/${slug}/">
<span class="go">OTWÓRZ ›</span>
<div class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.kind)}</div>
<h2>${escapeHtml(post.title)}</h2>
<p>${escapeHtml(post.summary)}</p>
<div class="tags">${tags}</div>
</a>`;
}

async function getPosts(context) {
  const url = new URL("/teksty/posts.json", context.request.url);
  const response = await context.env.ASSETS.fetch(url.toString());
  if (!response.ok) return [];
  const posts = await response.json();
  return Array.isArray(posts) ? posts : [];
}

export async function onRequest(context) {
  const [response, posts] = await Promise.all([
    context.env.ASSETS.fetch(context.request),
    getPosts(context),
  ]);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html") || posts.length === 0) return response;

  return new HTMLRewriter()
    .on("#text-list", {
      element(element) {
        element.setInnerContent(posts.map(renderCard).join("\n"), { html: true });
      },
    })
    .transform(response);
}
