---
name: Clone Phase 1 — Firecrawl branding hex values VERBATIM
description: During §4.24 Phase 1, copy exact hex values from Firecrawl's `branding` block into the Match Brief verbatim. Never paraphrase, round, or sample by eye.
type: workflow
---

🚨 **Verified (Healthcare Excellence Advisors, `732c0617`, 2026-05-18).** I sampled palette by eye: Navy `#0F3B47`, Teal `#2DB3A6`, Gold `#D4A24B`. Firecrawl `branding` returned: `#113350`, `#1E8A8A`, `#C39A4E`. Every section shipped slightly off-brand. Two full color-replacement passes required.

**The rule:** Phase 1 step 2 writes Firecrawl `branding` to the Match Brief VERBATIM. No transformations.

**Forbidden:**
- ❌ Eyeballing hex from screenshots when Firecrawl returned CSS-truth values
- ❌ "Rounding" hex values
- ❌ Picking pixel samples over the actual CSS values

**Fallback (branding incomplete):** sample at ORIGINAL resolution, note as sampled in the brief. If missing entirely, ASK.

**Phase 3a consumes these exact hexes** when setting `themeSettings.btn_background_color` etc.

**Symptom:** "the navy is slightly off" / multiple color-replacement passes after Phase 3.

Companion to §4.24 Phase 1 + `mem://reference/clone-themesettings-before-html.md`.
