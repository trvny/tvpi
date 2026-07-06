// Augments the wrangler-generated worker-configuration.d.ts (gitignored,
// regenerated in CI via `wrangler types`), which only reflects bindings from
// wrangler.jsonc. PUSH_TOKEN is a Worker secret (set via the Cloudflare API /
// dashboard, deliberately not in wrangler.jsonc), so it needs to be declared
// here by hand. Global `interface Env` merges across files.
interface Env {
  PUSH_TOKEN: string;
}
