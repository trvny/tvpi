"use strict";

(() => {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const links = [...document.querySelectorAll(".trvny-nav-link[href]")].slice(0, 32);
  const seen = new Set();
  const destinations = links.flatMap((link) => {
    const label = (link.firstChild?.textContent || link.textContent || "").trim();
    if (!label || seen.has(label)) return [];
    seen.add(label);
    return [{ label, url: link.href }];
  });
  if (destinations.length === 0) return;

  const ownerKey = Symbol.for("trfny.hub.webmcp.lifecycle");
  const previous = globalThis[ownerKey];
  if (previous && typeof previous.abort === "function") previous.abort();

  const lifecycle = new AbortController();
  globalThis[ownerKey] = lifecycle;
  const cleanup = () => {
    lifecycle.abort();
    if (globalThis[ownerKey] === lifecycle) delete globalThis[ownerKey];
  };
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) cleanup();
  }, { once: true });

  const names = destinations.map(({ label }) => label);
  const tool = {
    name: "open_travny_destination",
    title: "Open a TRAVNY destination",
    description: "Start browser navigation to one destination exposed by the current TRAVNY site menu.",
    inputSchema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          enum: names,
          description: "Exact menu destination to open.",
        },
      },
      required: ["destination"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute({ destination } = {}) {
      if (typeof destination !== "string") {
        return { ok: false, error: "destination must be a string.", availableDestinations: names };
      }
      const target = destinations.find(({ label }) => label === destination);
      if (!target) {
        return { ok: false, error: "Unknown destination.", availableDestinations: names };
      }
      window.location.assign(target.url);
      return { ok: true, navigationStarted: true, destination: target.label, url: target.url };
    },
  };

  try {
    Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal }))
      .catch((error) => console.warn("TRAVNY WebMCP registration failed", error));
  } catch (error) {
    console.warn("TRAVNY WebMCP registration failed", error);
  }
})();
