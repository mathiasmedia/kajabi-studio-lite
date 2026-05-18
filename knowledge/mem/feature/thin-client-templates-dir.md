---
name: thin-client-templates dir
description: Canonical thin-client versions of vite.config.ts/tsconfig.app.json/package.json live in thin-client-templates/; sync them VERBATIM with no skip/rewrite branch
type: feature
---
# Thin-client templates — the "true all-in sync" fix

## Problem this solves

`vite.config.ts`, `tsconfig.app.json`, and `package.json` intentionally diverge between master and thin clients:
- Master references `./packages/engine/src/...` (local monorepo source).
- Thin clients reference `./node_modules/@k-studio-pro/engine/...` (npm package).

Before this dir existed, the sync workflow had to **skip** these files with a per-file rewrite explanation ("can't sync verbatim — would break the build"). That broke "true all-in sync" — operators kept asking "why are these 4 files always out of sync?" and the answer was always a multi-paragraph architectural explanation. Painful.

## The fix

`thin-client-templates/` on master holds the canonical thin-client versions:
- `thin-client-templates/vite.config.ts` — uses `viteEngineAliases(__dirname)` from `@k-studio-pro/engine/vite`
- `thin-client-templates/tsconfig.app.json` — paths point at `./node_modules/@k-studio-pro/engine/src/`
- `thin-client-templates/package.json` — depends on `@k-studio-pro/engine` as a regular npm dep
- `thin-client-templates/README.md` — operator-facing explanation

Sync workflow now reads these template paths and writes to the bare paths in the thin client. Zero conditional logic. Zero "skip with reason". One read, one write per file.

## Maintenance rules

1. **Every change to master's root `vite.config.ts` / `tsconfig.app.json` / `package.json` must be mirrored in the corresponding `thin-client-templates/` file.** If you bump a dep in master's package.json, bump it here too. If you add a new alias to master's vite.config.ts, add it here too (using the engine-package paths instead of `./packages/engine/`).
2. **`SiteEditor.tsx` is NOT in this directory.** The engine-package aliases make `@/blocks` and `@/lib/siteDesign/*` resolve identically on both sides, so `SiteEditor.tsx` syncs verbatim from master's own copy.
3. **Engine version pin in template `package.json`.** Keep the range loose (`^0.1.18`) so `bun update @k-studio-pro/engine` picks up patches on thin clients automatically.

## Where the workflow lives

`AGENTS.md` §8.‑1 list 1 documents this. The "How to execute" step 1 instructs the thin-client AI to read from `thin-client-templates/<file>` and write to the bare path.
