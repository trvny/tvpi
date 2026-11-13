import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "./_middleware.ts";

const canonical = "https://travny.pages.dev";

function context(url, next = () => Promise.resolve(new Response("original"))) {
  return { request: new Request(url), next };
}

test("redirects legacy host without losing path or query", async () => {
  const response = await onRequest(context("http://legacy.example/tv/playlist?channel=tvp1&lang=pl"));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), `${canonical}/tv/playlist?channel=tvp1&lang=pl`);
});

test("keeps HTTPS and nonstandard incoming ports out of redirect target", async () => {
  const response = await onRequest(context("https://legacy.example:8443/a%20b?q=x%2By"));
  assert.equal(response.headers.get("location"), `${canonical}/a%20b?q=x%2By`);
});

test("passes canonical host through without redirect", async () => {
  let called = 0;
  const response = await onRequest(context(`${canonical}/tv`, () => {
    called += 1;
    return Promise.resolve(new Response("next handler", { status: 202 }));
  }));
  assert.equal(called, 1);
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "next handler");
});
