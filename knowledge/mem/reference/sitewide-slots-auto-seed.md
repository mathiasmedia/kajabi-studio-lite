---
name: Sitewide slots auto-seed (header / footer / footer_pro / exit_pop / two_step)
description: Whatever layouts/theme.liquid declares via {% section "X" %} ALWAYS shows in the editor sidebar — auto-seeded on load, no re-import needed
type: feature
---
# Sitewide slots auto-seed

Engine 0.6.x+. Every site load runs two helpers in `packages/engine/src/siteDesign/sharedSlots.ts`, wired into `mapRowToSite()` in `data/siteStore.ts`:

- `embedSharedSections(design, baseTheme)` — re-injects `sharedHeader` / `sharedFooter` / `sharedFooterPro` into every page; on Pro themes auto-seeds blank footer slots so BOTH `footer` and `footer_pro` rows appear in the sidebar.
- `ensureGlobalSections(design)` — auto-seeds blank `kind: 'raw'` entries for every entry in `GLOBAL_SECTION_TYPES` (currently `exit_pop` + `two_step`) into `design.globalSections` if missing.

**Outcome:** the editor sidebar ALWAYS reflects what `layouts/theme.liquid` declares, regardless of whether the original importer populated those slots. Old "re-import the site to recover missing footer/exit_pop" advice is obsolete.

**Adding a new sitewide slot:** if Kajabi adds another `{% section "X" %}` to `theme.liquid` (e.g. `cookie_banner`), append `{ type: 'X', name: '<label>' }` to `GLOBAL_SECTION_TYPES` in `sharedSlots.ts`. Every site picks it up on next load — no migration needed.

**Don't paper over with manual JSON injection.** If a slot is missing from the sidebar, the bug is in the auto-seed helper or its wiring (mapRowToSite). Fix it there, not by writing empty entries into individual sites' `design` rows.

**Storage minimal:** auto-seeded blanks are NOT persisted by the lift step on save — only slots the expert actually edited carry content into the DB. Re-load fills the blanks back in.

Live Kajabi unaffected either way: `mergeSettings()` in `exportEngine.ts` preserves untouched original-zip keys byte-for-byte (companion: `mem://reference/exit-pop-two-step-preserved-via-merge.md`).

See AGENTS.md §4.35.
