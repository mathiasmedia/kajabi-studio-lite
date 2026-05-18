---
name: sync everything from master
description: One-phrase full-sync trigger for thin clients — replaces the 4-separate-sync-trigger pain point; batches every read in parallel for speed
type: feature
---
# `sync everything from master` — the one-phrase full sync

**Trigger phrases (any of):** "sync everything from master", "full sync from master", "sync it all", "sync all the things", "resync everything".

**Why it exists:** operators were chaining `sync AGENTS.md from master` + `sync shell from master` + `sync base themes from master` + an ad-hoc engine-wiring sync — 4 phrases for what should be 1. This is the default sync now.

**What gets pulled (all in ONE parallel batch):**
1. Engine wiring: `vite.config.ts`, `tsconfig.app.json`, `tsconfig.json`, `package.json`
2. Docs: `AGENTS.md`, `PRO_CAPABILITIES.md`
3. App shell: `src/components/AppHeader.tsx`, `src/components/SitePreview.tsx`, `src/pages/{SitesDashboard,SiteEditor,LandingPagesDashboard}.tsx`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `tailwind.config.ts`, `index.html`
4. Data layer: `src/lib/siteStore.ts`, `src/lib/imageStore.ts`, `src/lib/exportPersistence.ts`
5. Base themes (binaries — use `cross_project--copy_project_asset`): all 4 `public/base-theme/*.zip`
6. ESLint guardrail: `eslint.config.js`

**What it does NOT touch:** `src/integrations/supabase/**` (auto-gen), `.env`, `supabase/functions/**` (deployed from master, not copied), `packages/engine/**` (consumed via npm — run `bun add @k-studio-pro/engine@latest swiper@latest` after).

**Speed rule:** ALL reads in ONE parallel tool-call message. Sequential reads are the only thing that makes this slow. Target: <60s total. Same for the writes — batch them.

**Preserve thin-client branding** ONLY in `AppHeader.tsx` (some thin clients are rebranded as e.g. "Studio Pro"). Diff the brand string, keep the thin-client value, overwrite everything else verbatim.

**Verify after sync** with the slider diagnostic from `mem://reference/slider-lives-in-sections-not-component.md`.

Full procedure: AGENTS.md §8.‑1 (the very top of §8, before §8.0).

The targeted syncs (§8.7 landing pages, §8.8 base themes, §8.9 shell) still exist for rare slice-only cases, but `sync everything from master` is the default.
