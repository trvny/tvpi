// Pages project `tvpi` only: legacy host for the TRAVNY site, which now
// builds from trvny/trvny (travny-pages/). Permanent, path- and
// query-preserving move; keep for at least a year after 2026-08-16.
const CANONICAL_HOST = "trfny.com";

export function onRequest({ request }) {
  const url = new URL(request.url);
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
