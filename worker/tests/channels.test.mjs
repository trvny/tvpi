import assert from "node:assert/strict";
import test from "node:test";
import { CHANNELS, publicChannels, buildStablePlaylist } from "../src/channels.ts";

test("one canonical catalog provides nine unique stable channels", () => {
  const origin = "https://tvpi.travny.workers.dev";
  const channels = publicChannels(origin);
  assert.equal(channels.length, 9);
  assert.equal(new Set(channels.map(c => c.slug)).size, 9);
  assert.deepEqual(channels.map(c => c.number),
    ["101", "102", "103", "104", "105", "106", "107", "108", "109"]);
  assert.equal(channels[0].streamUrl, origin + "/tvp1.m3u8");
  assert.equal(channels.at(-1).slug, "tvpmuzyka");
  assert.equal(CHANNELS.length, channels.length);
});

test("stable M3U uses canonical URLs, never signed upstream tokens", () => {
  const origin = "https://bartek.lol/tv";
  const playlist = buildStablePlaylist(origin);
  const urls = playlist.split("\n").filter(line => line.startsWith("https://"));
  assert.ok(playlist.startsWith("#EXTM3U\n"));
  assert.deepEqual(urls, publicChannels(origin).map(c => c.streamUrl));
  assert.equal(playlist.split("#EXTINF:").length - 1, CHANNELS.length);
  assert.ok(!playlist.includes("token="));
});
