// Legacy Pages host for the TRAVNY hub, built in trvny/trvny/pages.
// Permanent, path- and query-preserving redirect to the durable Pages domain.
// Keep this alias for existing links while it remains available.
const CANONICAL_HOST = "travny.pages.dev";

export function onRequest({ request, next }) {
  const url = new URL(request.url);
  // Misdeployment guard: never 301 the canonical host to itself.
  if (url.hostname === CANONICAL_HOST) return next();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
