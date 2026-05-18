---
name: Never invent schema field IDs — always look them up
description: Before writing ANY themeSettings/section/block field to a site's design JSON, verify the exact field ID exists in the base theme's parsed schema. Made-up names (primary_font_link, accent_font_family, etc.) sit valid in JSON, save returns 200 OK, and Kajabi's Style Guide stays blank because the real fields are still empty.
type: constraint
---

🚨 **Verified failure mode (Ascend site, 2026-05-08).** Authored Pro custom-font setup using `primary_font_link`, `primary_font_family`, `accent_font_link`, `accent_font_family` — NONE of which exist in `streamlined-home-pro`'s `config/settings_schema.json`. Save returned 200, JSON contained the keys, but the Style Guide UI showed blank because the real fields (`use_custom_fonts`, `font_stylesheet_links`, `use_primary_custom_font`, `primary_custom_font_name`, `primary_custom_font_fallback`, `use_accent_custom_font`, `accent_custom_font_name`, `accent_custom_font_fallback`) were never written.

**The rule — for EVERY themeSettings/section/block field you write:**

1. **Verify the field ID exists** in the base theme's schema BEFORE writing it. Sources of truth (in order of preference):
   - `packages/engine/src/engines/schemaRegistry.ts` / `schemas.generated.json` (parsed from base theme `{% schema %}`)
   - `mem://reference/pro-custom-fonts.md` and `mem://reference/pro-custom-fonts-value-formats.md` for Pro font/button/form fields
   - `mem://reference/block-field-catalog.md` for per-block fields
   - The base theme zip's `config/settings_schema.json` directly (extract it if needed)
2. **Never guess by analogy.** "primary_font_link sounds like the right name" → wrong. Read the schema.
3. **No 200 OK validation.** `update-site-design` accepts arbitrary JSON. Keys you invent sit there valid and useless. The only verification is opening the Style Guide UI in the editor and confirming the toggle/input shows your value.

**Pre-flight on every themeSettings/styling write:** list every field ID you're about to set, grep `schemas.generated.json` (or the relevant memory file) for each one. If any field isn't there, it's invented — find the real name before saving.

Same class of bug as §4.26 (block content prop names). Same fix: read the schema, don't guess.
