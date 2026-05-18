---
name: exit_pop / two_step preserved via base-theme merge (not by importer/serializer)
description: Fixed-id global Kajabi sections (exit_pop, two_step) are NOT placed into pages by the importer and NOT emitted by serializeTree — they survive round-trip via mergeSettings() in exportEngine.ts which preserves all non-touched original keys
type: reference
---

When verifying round-trip behavior of imported sites, do NOT call `serializeTree(designToPageTrees(...))` in isolation and then count blocks against the source `settings_data.json` — you'll see false drops for `exit_pop`, `two_step`, and similar fixed-id global sections that Kajabi renders via `theme.liquid` rather than `content_for_*` arrays.

**What actually happens:**

1. `importSettingsData` (`packages/engine/src/engines/importEngine.ts`) only places sections into `design.pages[<key>]` if they're referenced by a `content_for_<key>` array. `exit_pop` and `two_step` are not in any `content_for_*`, so they get imported into `importedSections` but never reach a page → they vanish from the design.

2. `serializeTree` therefore never sees them and never emits them. In an isolated round-trip test (without the merge step), the source `form` + `image` blocks living inside `exit_pop` / `two_step` look "dropped".

3. The REAL export pipeline (`exportThemeZip` in `exportEngine.ts`) calls `mergeSettings(originalSettings, generatedSettings, ...)` which deep-clones the original base theme zip's `settings_data.json` and only overwrites the sections + `content_for_*` keys that the engine actually generated. Every other key — including `exit_pop`, `two_step`, `login` sections, `content_for_about`, `link_lists`, etc. — survives byte-identical from the original zip.

4. So shipped Kajabi exports DO contain `exit_pop` and `two_step` correctly. The importer/serializer just don't model them.

**Verified (2026-05-04):** Phase B3 round-trip test against `streamlined-home-pro.zip` and `encore-page-pro.zip` showed `form` 4→2 / 3→1 and `image` 6→4 / 3→1 in isolated `serializeTree` output. Inspection confirmed those blocks live in `exit_pop` + `two_step` sections in the source. Real exports preserve them via `mergeSettings`.

**Implication for Phase B3 verification:** the "dropped" form/image blocks are NOT a Phase B3 regression. Registry-aware passthrough works correctly for every block type that flows through `serializeTree`. Anything in fixed-id global sections is a separate (and already-handled) merge concern.

**If we ever need to model `exit_pop`/`two_step` natively:** treat them like `header`/`footer` in `importSettingsData` — store them on `design` at the top level (not inside any page) and re-emit them in `serializeTree` as fixed-id sections. But there's no user-facing reason to do this today; the merge handles it.
