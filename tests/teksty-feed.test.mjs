import test from "node:test";
import assert from "node:assert/strict";

import { getLatestShitpost, getShitposts } from "../functions/_shared/shitpost.js";
import { onRequestGet, onRequestHead } from "../functions/teksty/feed.xml.js";

const origin = "https://shitpost.trfny.com";
const first = {
  id: origin + "/posts/gh-12-34",
  url: origin + "/posts/gh-12-34",
  summary: "First post & <payload>",
  date_published: "2026-10-07T08:00:00Z",
  tags: ["text"],
};
const second = {
  id: origin + "/posts/gh-56-78",
  url: origin + "/posts/gh-56-78",
  summary: "Newest post",
  date_published: "2026-10-09T08:00:00Z",
  tags: ["meme"],
};

function fakeFetch(items, ok = true) {
  return async () => ({
    ok,
    json: async () => ({ version: "https://jsonfeed.org/version/1.1", items }),
  });
}

function context() {
  const posts = [
    { slug: "grass-mud-horse", title: "Alpaca & crab", summary: "Slang <censored>",
      date: "2026-10", updated: "2026-10-08T12:00:00Z",
      tags: ["Chinese & internet"], lang: "en" },
  ];
  return {
    request: new Request("https://trfny.com/teksty/feed.xml"),
    env: { ASSETS: { fetch: async () => Response.json(posts) } },
  };
}

test("shitpost items are validated, de-duplicated and chronologically sorted", async () => {
  const posts = await getShitposts(fakeFetch([
    first, second, first, { ...second, url: "https://evil.test/posts/gh-56-78" },
  ]));
  assert.equal(posts.length, 2);
  assert.equal(posts[0].url, second.url);
  assert.equal(posts[1].url, first.url);
  assert.equal((await getLatestShitpost(fakeFetch([first, second]))).url, second.url);
});

test("merged Atom feed escapes source content and keeps stable original links", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch([first, second]);
  try {
    const response = await onRequestGet(context());
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/atom\+xml/);
    assert.match(xml, /<title>Alpaca &amp; crab<\/title>/);
    assert.match(xml, /First post &amp; &lt;payload&gt;/);
    assert.match(xml, /Slang &lt;censored&gt;/);
    assert.match(xml, /<entry xml:lang="en">/);
    assert.match(xml, /<source><id>https:\/\/shitpost\.trfny\.com\/<\/id>/);
    assert.ok(xml.indexOf(second.url) < xml.indexOf("Alpaca &amp; crab"));
    assert.ok(xml.indexOf("Alpaca &amp; crab") < xml.indexOf(first.url));
    const head = await onRequestHead(context());
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  } finally {
    globalThis.fetch = original;
  }
});

test("articles remain available if Shitpost Reactor is unavailable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch([], false);
  try {
    const response = await onRequestGet(context());
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.match(xml, /Alpaca &amp; crab/);
    assert.doesNotMatch(xml, /<source><id>https:\/\/shitpost/);
  } finally {
    globalThis.fetch = original;
  }
});

test("newer duplicate updates win and tracking URL variants collapse", async () => {
  const stale = {
    ...first,
    url: first.url + "?utm_source=test#fragment",
    date_modified: "2026-10-07T08:00:00Z",
    summary: "Stale copy",
  };
  const edited = {
    ...first,
    date_modified: "2026-10-10T15:00:00Z",
    summary: "Edited copy",
  };
  const posts = await getShitposts(fakeFetch([stale, edited]));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, first.url);
  assert.equal(posts[0].caption, "Edited copy");
  assert.equal(posts[0].published, "2026-10-07T08:00:00.000Z");
  assert.equal(posts[0].updated, "2026-10-10T15:00:00.000Z");
});

test("Atom strips XML control characters and retains original publication dates", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch([{
    ...first,
    summary: "Invalid \u0001 XML",
    date_modified: "2026-10-10T15:00:00Z",
    tags: ["\u0002 x"],
  }]);
  try {
    const response = await onRequestGet(context());
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.doesNotMatch(xml, /[\u0001\u0002]/u);
    assert.match(xml, /<published>2026-10-07T08:00:00.000Z<\/published>/);
    assert.match(xml, /<updated>2026-10-10T15:00:00.000Z<\/updated>/);
  } finally {
    globalThis.fetch = original;
  }
});

test("undated Reactor entries use a stable Atom updated fallback, not a fake publish date", async () => {
  const original = globalThis.fetch;
  const undated = { ...first };
  delete undated.date_published;
  globalThis.fetch = fakeFetch([undated]);
  try {
    const response = await onRequestGet(context());
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.match(xml, /First post &amp; &lt;payload&gt;/);
    assert.match(xml, /<updated>1970-01-01T00:00:00.000Z<\/updated>/);
    assert.doesNotMatch(xml, /<published>1970-01-01/u);
  } finally {
    globalThis.fetch = original;
  }
});
