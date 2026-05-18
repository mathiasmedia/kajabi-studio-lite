---
name: Clone Phase 3 — set themeSettings BEFORE any block HTML
description: During §4.24 clone builds, configure themeSettings (fonts/colors/buttons matching source) as the FIRST step of Phase 3, BEFORE composing any page HTML. Prevents inline-style baking that later fights Style Guide edits.
type: workflow
---

🚨 **Verified failure mode (Healthcare Excellence Advisors clone, site `732c0617`, 2026-05-18).** During §4.24 Phase 3, I went straight to composing pages and seeded every heading + lede with inline `style="font-family:Manrope;font-weight:700;color:#FBF8F2"`. When the expert later swapped the heading font via the Pro Style Guide, headings didn't change — inline styles won. Required a full-site customCss + inline-style cleanup touching ~40 blocks across 12 pages.

**Phase 3a — Set the Style Guide from the Match Brief BEFORE composing any page:**
1. `design.themeSettings` — Pro: `use_custom_fonts:"true"` + `font_stylesheet_links` + `use_primary_custom_font:"true"` + `primary_custom_font_name` + `select_custom_all_headings_font:"primary"` + per-level overrides per §4.22. Both: `btn_background_color`/`btn_text_color`/`background_color`/`color_body`/`color_heading` AND Standard siblings per §4.35am.
2. `design.branding` (3 colors + 2 fonts) for Kajabi system page inheritance.
3. `design.customCss` resets per §4.30 step 3a.
4. Save. Verify Style Guide UI before composing.

**Phase 3b** — NOW build page-by-page. Block HTML stays clean — semantic tags only, no inline font/weight/color. Inline `style` only for editorial one-offs per `mem://reference/inline-style-html-content.md`.

**Symptom:** "I changed the heading font in the Style Guide but nothing happened" → inline styles fighting Style Guide.

Companion to §4.24 + §4.35ad + `mem://reference/clone-verbatim-firecrawl-branding.md`.
