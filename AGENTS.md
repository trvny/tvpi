# AGENTS.md

Rules for **any** agent working in `trvny/tvpi`. Tree-level rules — never run git at the
`~/git` root, fetch before touching a clone, the `trvny` account, the merge policy — live in
`~/git/AGENTS.md` and are not repeated here.

## Layout

| Path | What it is |
|---|---|
| `site/` | the static hub: `index.html`, `tv/`, `assets/`, `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest` |
| `functions/` | Cloudflare **Pages** Functions — must stay at the repo root, see below |
| `worker/` | the TVP **Worker**: TypeScript, `wrangler.jsonc`, D1 migrations |
| `streams/` | **generated** — written by `generate.py`, refreshed on a schedule by `.github/workflows/refresh.yml`. Never hand-edit; the next run overwrites it |

## Three hosts, one build output

`trfny.com` is canonical. `travny.pages.dev` keeps **serving** and deliberately does not
redirect — its pages carry a canonical pointing at the domain, which is enough for search
engines to consolidate, and it means the site never goes dark if the domain lapses.
`tvpi.pages.dev` answers only with a 301.

All of it hangs off the single `CANONICAL_HOST` constant in `functions/_middleware.js`; the
comment block there is the full explanation and the rollback procedure. Change that constant,
not the individual URLs.

**Do not delete the `tvpi` Pages project before roughly August 2027.** It exists solely to serve
the 301 that carries the search index from the old address. Deleting it turns those URLs into
NXDOMAIN and drops the accumulated index.

## Things that look like bugs and are not

Each of these has bitten before. The listed file is the primary explanation — read it before
"fixing" anything here.

- **Pages Functions live at the repo root `/functions/`, never `site/functions/`.** Pages
  discovers them relative to the project `root_dir`, not the build output. A copy under `site/`
  is silently never deployed. See the comment in `functions/weather.js`.
- **`site/_routes.json` excludes `/assets/*` on purpose** so Functions do not run for static
  assets.
- **The linter suppressions in `.github/linters/.mega-linter.yml` are load-bearing**, and each
  one is justified in a comment right above it. `H020` marks placeholders that `_middleware.js`
  fills through `HTMLRewriter`; `H008` marks the single quotes required inside the
  `data:image/svg+xml` favicon. Resolving either breaks the page. The `$` anchor in
  `FILTER_REGEX_EXCLUDE` matters too — without it the pattern also swallows
  `functions/favicon.ico.js`, which then goes unlinted.
- **ESLint is scoped to `functions/**` only** (`eslint.config.mjs`), and JavaScript formatting
  via Prettier is switched off deliberately, for reasons recorded in the MegaLinter config.
- `/favicon.ico` is a 302 to `/assets/icon-96.png`, served by `functions/favicon.ico.js` — not
  a missing file.
- The Bing verification tag is injected into `/` by `functions/index.js`, not written in
  `site/index.html`. Look there if it goes missing.

## Publishing

**Pushing to `main` publishes.** Cloudflare Pages builds the site from `main`, and
`.github/workflows/deploy.yml` deploys the Worker on pushes to `main` that touch its paths.
So anything beyond a genuinely trivial fix goes on a branch and through a pull request, where
the preview deployment and CI can be read before it reaches the live site.
