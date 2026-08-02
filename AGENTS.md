# AGENTS.md

## Scope

These instructions apply to the whole `trvny/tvpi` repository.

## Project invariants

TVPI has two related but distinct delivery paths:

- `generate.py` and `.github/workflows/refresh.yml` maintain the committed
  `streams/` fallback;
- `worker/` serves stable channel endpoints and pushed or freshly resolved
  manifests.

The TVP API is geo-sensitive and short-lived signed URLs are expected. Read the
current status in `README.md` before changing refresh or fallback behavior. Do
not describe the service as reliably 24/7 unless current measurements support
that claim.

## Before changing anything

- Check current `main`, open pull requests, and recent commits. The scheduled
  refresh workflow writes generated stream updates to `main`.
- Read the code for both delivery paths when a change affects channel
  resolution, caching, fallback, or playlist format.
- Verify current external API behavior instead of trusting old comments or a
  single successful request.

## Change rules

- Do not hand-edit `streams/` as the implementation of a fix. Change the
  generator or refresh path, then regenerate when required.
- Preserve per-channel failure isolation and last-known-good fallback. One
  broken channel must not erase working entries for the others.
- Keep Worker deployment, D1 migrations, secrets, and residential pushes
  explicit. Do not deploy, migrate, rotate secrets, or overwrite remote state
  unless the task requests it.
- Never commit Cloudflare credentials, push tokens, cookies, or private network
  details.
- Keep changes small and avoid unrelated README or workflow churn.

## Validation

Use the narrowest relevant checks:

```bash
python3 -m py_compile generate.py scripts/residential_push.py
cd worker && npm ci && npm run typecheck
```

Also validate generated M3U/HLS structure when changing playlist logic. Network
or geo-dependent behavior must be reported as physically verified, simulated,
or unverified; do not blur those categories.

## GitHub workflow

Keep one logical change per pull request. Truly trivial low-risk edits may go
directly to `main`. Treat Codex review as advisory only; do not ask it to
implement, commit, or push. Prefer squash merge after relevant checks pass on
the final head commit.
