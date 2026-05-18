---
name: Stale src/types folder shadows engine package
description: Leftover src/types/ on a thin client keeps @/types/* alias resolving locally, feeds stale type shapes into engine code, sliders silently fall back to 1-up
type: constraint
---

**Symptom:** Thin client on engine v0.1.18+ with vite alias trailing-slash fix applied, but Slider/Tabs still render as 1-up or blank. Working sibling thin client renders multi-up correctly.

**Diagnostic:** Compare `ls src/` between the working and broken thin client. If broken has `src/types/` and working doesn't → that's the bug.

**Cause:** §8.0 migration step 2 originally only deleted `src/types/assets.ts` and `src/types/schemas.ts`, not the whole folder. Any other leftover file (stale `index.ts` barrel, dead `slot.ts`, etc.) keeps the `@/types/*` tsconfig + vite alias resolving to the LOCAL stale folder instead of `node_modules/@k-studio-pro/engine/src/types/*`. Engine code in `node_modules` reads new prop shapes via `@/types/*`, gets the OLD shapes from the local stale folder, props read as `undefined`, Swiper falls back to 1-up silently — same class as the trailing-slash bug.

**Fix:**
```bash
rm -rf src/types
```

Then verify NO leftover engine-source folder exists locally:
```bash
ls src/types src/blocks src/engines src/lib/siteDesign 2>&1 | grep -v "No such"
```
Should print nothing.

**Permanent fix in AGENTS.md §8.0 step 2:** changed `rm -rf src/types/assets.ts src/types/schemas.ts` to `rm -rf src/types`, plus a post-delete verification command that fails loudly if any of the four shadow folders still exist.

**Master's source of truth:** master itself has NO `src/types/` folder — engine types live exclusively in `packages/engine/src/types/`. Any thin client with `src/types/` after migration is broken.
