const SHITPOST_FEED_URL = "https://shitpost.trfny.com/feed.json";
const SHITPOST_ORIGIN = "https://shitpost.trfny.com";

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

export async function getLatestShitpost(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(SHITPOST_FEED_URL, {
      headers: { accept: "application/feed+json, application/json" },
      cf: { cacheEverything: true, cacheTtl: 300 },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    const feed = await response.json();
    if (!feed || !Array.isArray(feed.items) || feed.items.length === 0) return null;
    return normalizeShitpostItem(feed.items[0]);
  } catch {
    return null;
  }
}
