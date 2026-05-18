---
name: popup-slots-seed-with-base-defaults
description: exit_pop + two_step must always seed with base theme default content, never blank — applies to createSite, blank builders, ensureGlobalSections auto-seed, and any popup reset path
type: preference
---
ALWAYS seed `exit_pop` + `two_step` global sections with the base theme's default content blocks (from `sections/<type>.liquid` `{% schema %}` `presets` / `default_blocks` for the site's `base_theme`) — NEVER blank `{ blocks:{}, blockOrder:[] }`.

**Applies to:**
- `buildBlankDesign` / `buildLandingPageBlankDesign` for brand-new sites
- `ensureGlobalSections` (sharedSlots.ts) auto-seed when a slot is missing on an existing site
- Any programmatic popup reset (`delete` then re-add)
- Any AI-authored `update-site-design` call that touches `design.globalSections.exit_pop` / `two_step`

**Exception:** `importSiteFromZip` keeps whatever the zip carried verbatim — don't touch.

**Why:** experts should never open a popup row in the sidebar to find an empty editor. Kajabi's base themes ship tasteful default content (headline + body + email form + CTA) — give the expert that as a starting point.

**How to apply:** extend sharedSlots.ts with `defaultGlobalSectionContent(baseTheme, type)` that reads `presets[0]` from the schema registry (already parsed from each base-theme zip). Wire it into `blankGlobalSection` and the blank-design builders.

See AGENTS §4.35ab.
