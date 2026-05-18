---
name: Thin client sync model
description: Engine consumed via @k-studio-pro/engine npm package; legacy file-by-file sync (§8.1–§8.9) deleted from AGENTS as of fleet migration to engine 0.3.3
type: feature
---
Every thin client is fully migrated to consume `@k-studio-pro/engine` from npm. Engine fixes propagate via:

```
bun update @k-studio-pro/engine
rm -rf node_modules/.vite
# hard refresh
```

after a master version bump in `packages/engine/package.json`.

**Valid sync triggers (only these):**
- `sync everything from master` (AGENTS §8.‑1) — the default; full bundle in one parallel batch
- `sync AGENTS.md from master` — docs only
- `sync PRO_CAPABILITIES.md from master` — Pro reference only
- `migrate to engine package` (AGENTS §8.0) — one-time only, for legacy thin clients still carrying local engine source

**Legacy triggers that no longer exist** (AGENTS §8.1–§8.9 was deleted): `sync from master`, `sync shell from master`, `sync base themes from master`, `sync landing pages from master`. If an operator pastes any of these, interpret as `sync everything from master` and run §8.‑1 — never re-introduce file-by-file copies of `src/blocks/`, `src/engines/`, `src/lib/siteDesign/`, or shell pages.

**Why:** every file copy goes stale on the next master push. The engine package is the single source of truth; thin clients are truly thin (just wiring + Supabase + project-specific Auth/Admin pages).

**Smoke-testing a thin client:** see `thin-client-templates/SMOKE_TEST.md` — 2-minute diagnostic + visual + export checklist.
