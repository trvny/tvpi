const SHITPOST_FEED_URL = "https://shitpost.trfny.com/feed.json";
const SHITPOST_ORIGIN = "https://shitpost.trfny.com";

function normalizeShitpostItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  let url;
  try {
    url = new URL(String(item.url || item.id || ""));
  } catch {
    return null;
  }

  if (url.origin !== SHITPOST_ORIGIN || !/^\/posts\/gh-\d+-\d+$/u.test(url.pathname)) return null;

  const caption = String(item.summary || item.title || "").trim();
  if (!caption) return null;

  const parsedPublishedAt = Date.parse(String(item.date_published || item.date_modified || ""));
  const published = Number.isFinite(parsedPublishedAt)
    ? new Date(parsedPublishedAt).toISOString()
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
    published,
    date: published.slice(0, 10),
    tags,
  };
}

export async function getShitposts(fetchImpl = fetch, limit = 50) {
  try {
    const response = await fetchImpl(SHITPOST_FEED_URL, {
      headers: { accept: "application/feed+json, application/json" },
      cf: { cacheEverything: true, cacheTtl: 300 },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return [];
    const feed = await response.json();
    if (!feed || !Array.isArray(feed.items)) return [];

    const seen = new Set();
    const posts = feed.items
      .map(normalizeShitpostItem)
      .filter((post) => {
        if (!post || seen.has(post.url)) return false;
        seen.add(post.url);
        return true;
      })
      .sort((a, b) => (b.published || "").localeCompare(a.published || ""));

    return posts.slice(0, Math.max(0, Math.min(100, Math.trunc(limit) || 0)));
  } catch {
    return [];
  }
}

export async function getLatestShitpost(fetchImpl = fetch) {
  return (await getShitposts(fetchImpl, 1))[0] || null;
}
