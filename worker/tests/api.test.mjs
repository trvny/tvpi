import assert from "node:assert/strict";
import test from "node:test";
import tvpi from "../src/entry.ts";

const ORIGIN = "https://tvpi.travny.workers.dev";
const ctx = { waitUntil() {} };

function environment() {
  const now = Date.now();
  const timestamps = new Map([
    ["tvp1", now - 60_000],
    ["tvp2", now - 20 * 60_000],
    ["tvpinfo", now + 60_000],
  ]);
  const calls = { head: 0, get: 0 };
  const env = { MIRROR: {
    async head(key) {
      calls.head++;
      const slug = key.replace("manifests/", "").replace(".m3u8", "");
      if (slug === "tvpsport") throw new Error("R2 transient failure");
      if (!timestamps.has(slug)) return null;
      return { customMetadata: { ts: String(timestamps.get(slug)) } };
    },
    async get() {
      calls.get++;
      return { customMetadata: { ts: String(now - 60_000) },
        text: async () => "#EXTM3U\\n#EXT-X-VERSION:3\\n" };
    },
  }};
  return { env, calls };
}

test("GET/HEAD channel catalog exposes stable endpoints and no signed URLs", async () => {
  const { env, calls } = environment();
  const res = await tvpi.fetch(new Request(ORIGIN + "/api/channels"), env, ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
  const body = await res.json();
  assert.equal(body.channels.length, 9);
  assert.equal(body.channels[0].streamUrl, ORIGIN + "/tvp1.m3u8");
  assert.equal(body.playlistUrl, ORIGIN + "/playlist.m3u");
  assert.ok(!JSON.stringify(body).includes("token="));
  const head = await tvpi.fetch(new Request(ORIGIN + "/api/channels", { method: "HEAD" }), env, ctx);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(calls.head, 0);
});

test("GET status describes manifest freshness without claiming playback", async () => {
  const { env, calls } = environment();
  const res = await tvpi.fetch(new Request(ORIGIN + "/api/status"), env, ctx);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const data = await res.json();
  assert.match(data.meaning, /playback not verified/);
  assert.equal(data.channels.length, 9);
  const by = new Map(data.channels.map(ch => [ch.slug, ch.manifest]));
  assert.equal(by.get("tvp1"), "fresh");
  assert.equal(by.get("tvp2"), "stale");
  assert.equal(by.get("tvpinfo"), "stale");
  assert.equal(by.get("tvpsport"), "unknown");
  assert.equal(by.get("tvpdokument"), "missing");
  assert.equal(calls.head, 9);
  const head = await tvpi.fetch(new Request(ORIGIN + "/api/status", { method: "HEAD" }), env, ctx);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(calls.head, 9, "HEAD does not read R2");
});

test("legacy playlist and normalized manifest still share the catalog", async () => {
  const { env } = environment();
  const playlist = await tvpi.fetch(new Request(ORIGIN + "/playlist.m3u"), env, ctx);
  assert.equal(playlist.status, 200);
  const body = await playlist.text();
  assert.equal(body.split("#EXTINF:").length - 1, 9);
  const hls = await tvpi.fetch(new Request(ORIGIN + "/tvp1.m3u8"), env, ctx);
  assert.equal(hls.status, 200);
  assert.equal(hls.headers.get("x-manifest"), "normalized");
  assert.match(await hls.text(), /#EXTM3U/);
});
