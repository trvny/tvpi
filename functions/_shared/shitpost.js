const SHITPOST_FEED_URL = "https://shitpost.trfny.com/feed.json";
const SHITPOST_ORIGIN = "https://shitpost.trfny.com";
const UNDATED_UPDATED = "1970-01-01T00:00:00.000Z";
const MAX_SOURCE_ITEMS = 500;

function parseTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function normalizeShitpostItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  let url;
  try {
    url = new URL(String(item.url || item.id || ""));
  } catch {
    return null;
  }

  if (url.origin !== SHITPOST_ORIGIN || !/^\/posts\/gh-\d+-\d+$/u.test(url.pathname)) return null;
  url.search = "";
  url.hash = "";

  const caption = String(item.summary || item.title || "").trim();
  if (!caption) return null;

  const published = parseTimestamp(item.date_published);
  const modified = parseTimestamp(item.date_modified);
  // Atom requires updated; stable sentinel for genuinely undated source entries.
  const updated = modified || published || UNDATED_UPDATED;

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
    updated,
    date: (published || modified).slice(0, 10),
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

    const count = Math.max(0, Math.min(100, Math.trunc(limit) || 0));
    if (count === 0) return [];

    // Source feed is newest-first. Bound CPU even if its archive grows.
    const newestByUrl = new Map();
    for (const item of feed.items.slice(0, MAX_SOURCE_ITEMS)) {
      const post = normalizeShitpostItem(item);
      if (!post) continue;
      const previous = newestByUrl.get(post.url);
      if (!previous || post.updated > previous.updated) newestByUrl.set(post.url, post);
    }

    return [...newestByUrl.values()]
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .slice(0, count);
  } catch {
    return [];
  }
}

export async function getLatestShitpost(fetchImpl = fetch) {
  return (await getShitposts(fetchImpl, 1))[0] || null;
}
