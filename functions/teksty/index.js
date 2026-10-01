const SHITPOST_FEED_URL = "https://shitpost.trfny.com/feed.json";
const SHITPOST_ORIGIN = "https://shitpost.trfny.com";

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

function normalizeShitpostItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  let url = null;
  try {
    url = new URL(String(item.url || item.id || ""));
  } catch {
    return null;
  }

  if (url.origin !== SHITPOST_ORIGIN || !/^\/posts\/gh-\d+-\d+$/u.test(url.pathname)) return null;

  const caption = String(item.summary || item.title || "").trim();
  if (!caption) return null;

  const publishedAt = String(item.date_published || item.date_modified || "");
  const parsedPublishedAt = Date.parse(publishedAt);
  const date = Number.isFinite(parsedPublishedAt)
    ? new Date(parsedPublishedAt).toISOString().slice(0, 10)
    : "";

  const tags = Array.isArray(item.tags)
    ? item.tags
      .filter((tag) => typeof tag === "string" && tag.trim())
      .slice(0, 4)
      .map((tag) => tag.trim())
    : [];

  return {
    url: url.toString(),
    caption,
    date,
    tags,
  };
}

function renderShitpostCard(post) {
  const tags = post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  const meta = post.date ? `AUTO · ${escapeHtml(post.date)}` : "AUTO";
  const caption = escapeHtml(post.caption).replaceAll("\n", "<br>");
  return `<a class="card shitpost-card" href="${escapeHtml(post.url)}">
<span class="go">ŹRÓDŁO ↗</span>
<div class="meta">${meta}</div>
<h2>SHITPOST OF THE DAY</h2>
<p>${caption}</p>
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

async function getShitpostOfTheDay() {
  try {
    const response = await fetch(SHITPOST_FEED_URL, {
      headers: { accept: "application/feed+json, application/json" },
      cf: { cacheEverything: true, cacheTtl: 300 },
    });
    if (!response.ok) return null;
    const feed = await response.json();
    if (!feed || !Array.isArray(feed.items) || feed.items.length === 0) return null;
    return normalizeShitpostItem(feed.items[0]);
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const [response, posts, shitpost] = await Promise.all([
    context.env.ASSETS.fetch(context.request),
    getPosts(context),
    getShitpostOfTheDay(),
  ]);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) return response;

  let rewriter = new HTMLRewriter();

  if (shitpost || posts.length > 0) {
    rewriter = rewriter.on("#text-list", {
      element(element) {
        if (shitpost) {
          element.before(renderShitpostCard(shitpost), { html: true });
        }
        if (posts.length > 0) {
          element.setInnerContent(posts.map(renderCard).join("\n"), { html: true });
        }
      },
    });
  }

  return rewriter.transform(response);
}
