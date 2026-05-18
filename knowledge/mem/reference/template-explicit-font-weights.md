---
name: template-explicit-font-weights
description: Pro templates MUST set font weight + line-height + size on EVERY heading level (h1–h6) and body — never rely on Kajabi defaults. Preview vs Kajabi mismatches happen when template sets one heading explicitly and leaves siblings to fall back to defaults (h1 → 700 in catalog, but Kajabi's actual default for the loaded font may be 600 or 500).
type: preference
---

# Pro template typography — set EVERY weight explicitly

## Why
Symptom: preview h1 looks heavier than Kajabi's h1, even though the family + size match. Cause: template set `custom_h2_font_weight: "500"` (so Kajabi h2 = 500) but never set h1 weight, so:
- Kajabi h1 → falls back to `font_weight_heading` (which the template also didn't set) → falls back to base-theme default (often 600 for serif display fonts, NOT 700).
- Preview h1 → `valWithDefault` returns the catalog default `"700"` → renders heavier than Kajabi.

The catalog defaults in `templateSettingsCatalog.ts` are NOT guaranteed to match the loaded font's real default in Kajabi — especially for serif/display fonts (Playfair Display, Lora, Cormorant) which often render at 600 by default in Kajabi's themes.

## The rule
Every Pro template's `themeSettings` MUST explicitly set, for the typography it cares about:

**Standard fields (always set, even when using Pro custom fonts):**
- `font_weight_heading` (e.g. `"500"` or `"600"` or `"700"`)
- `line_height_heading` (e.g. `"1.1"`)
- `font_weight_body` (e.g. `"400"`)
- `line_height_body` (e.g. `"1.6"`)

**Pro per-element overrides (when `use_custom_fonts: "true"`)** — for EVERY heading level the template uses on any page:
For each `h1`..`h6` actually rendered:
- `override_h<N>_font_styles: "true"` (flip the visibility toggle)
- `select_custom_h<N>_font: "primary"` or `"accent"` or `"inherit"`
- `custom_h<N>_font_weight: "500"` (or whatever — explicit, never `"inherit"` if you care about parity)
- `custom_h<N>_line-height: "1.1"` (hyphen, not underscore)
- `custom_h<N>_letter-spacing: "-1px"` (or `"inherit"`)
- `custom_h<N>_font_size_desktop: "52px"`
- `custom_h<N>_font_size_mobile: "34px"`

**Body:**
- `override_body_fonts: "true"`
- `select_custom_body_font: "accent"` (or `"primary"`/`"inherit"`)
- `custom_body_font_weight: "400"`
- `custom_body_font_line-height: "1.6"`
- `custom_body_font_size_desktop: "17px"`
- `custom_body_font_size_mobile: "16px"`

**Buttons (when advanced button styling matters):**
- `view_advanced_button_customizations: "true"`
- `btn_font_weight: "500"`
- `custom_button_font_size_desktop: "14px"`
- `custom_button_font_size_mobile: "13px"`

## What "every heading level the template uses" means
Audit every page in the template. If any page renders an `<h3>`, you MUST set `override_h3_*` overrides. Don't leave gaps — a missing override means the preview falls back to one weight and Kajabi falls back to a different weight, and the expert sees a mismatch on exactly that one heading.

## 🚨 Common silent gap: per-element set, Standard fields undefined (verified 2026-04, Pro Functionality site)
The two layers are independent. A site can have every `override_h<N>_font_styles: "true"` + `custom_h<N>_font_weight` filled in correctly while `font_weight_heading`, `line_height_heading`, `font_weight_body`, `line_height_body` are still `undefined`. The composed pages render fine, but:
- Kajabi system pages (login, store, checkout, blog, member library) use the **Standard fields**, not per-element overrides → fall back to base-theme defaults (heading 700, body 400/1.6) → look off-brand.
- Preview's Standard fallback path (when Pro overrides aren't active for a given element) uses the same Standard fields → silent divergence.

The audit MUST check both layers. After confirming per-element overrides, verify the Standard sitewide fields are set to match (e.g. heading 500/1.1, body 400/1.7). Symptom: "system pages don't match my brand" or "the preview shows the right weight but the live login page is bolder."

## Don't use "inherit" if you care about parity
`"inherit"` on a weight/line-height/size means "use the cascade" — and the cascade differs between preview (catalog defaults) and Kajabi (loaded font's actual defaults). For typography the template DESIGNED, write the explicit value. Reserve `"inherit"` for fields the template genuinely doesn't care about.

## Pre-flight checklist for every Pro template (and every template-build prompt)
1. Open the template's `TemplateDef.themeSettings`.
2. Confirm `font_weight_heading` + `line_height_heading` + `font_weight_body` + `line_height_body` are all set (Standard fields — these brand Kajabi system pages too).
3. Walk every page; collect the set of heading levels actually rendered.
4. For each level, confirm `override_h<N>_font_styles: "true"` + at minimum `custom_h<N>_font_weight` + `custom_h<N>_line-height` + `custom_h<N>_font_size_desktop` + `custom_h<N>_font_size_mobile` are set explicitly.
5. Confirm `override_body_fonts: "true"` + body weight/line-height/size explicit.
6. If template uses CTAs at all (it does), confirm `view_advanced_button_customizations: "true"` + `btn_font_weight` + button sizes explicit.

## Anti-pattern
```jsonc
// ❌ Wrong — only h2 weight set, h1/h3/h4 inherit and silently diverge
{
  "use_custom_fonts": "true",
  "override_h2_font_styles": "true",
  "custom_h2_font_weight": "500",
  // h1, h3, h4 left to fall back — preview ≠ Kajabi
}

// ✅ Right — every level the template uses is explicit
{
  "use_custom_fonts": "true",
  "font_weight_heading": "500",        // sitewide fallback for unconfigured headings
  "line_height_heading": "1.1",
  "font_weight_body": "400",
  "line_height_body": "1.6",
  "override_h1_font_styles": "true",
  "custom_h1_font_weight": "500",
  "custom_h1_line-height": "1.05",
  "custom_h1_letter-spacing": "-1px",
  "custom_h1_font_size_desktop": "72px",
  "custom_h1_font_size_mobile": "44px",
  "override_h2_font_styles": "true",
  "custom_h2_font_weight": "500",
  "custom_h2_line-height": "1.1",
  "custom_h2_font_size_desktop": "52px",
  "custom_h2_font_size_mobile": "34px",
  "override_h3_font_styles": "true",
  "custom_h3_font_weight": "500",
  "custom_h3_line-height": "1.2",
  "custom_h3_font_size_desktop": "32px",
  "custom_h3_font_size_mobile": "24px",
  "override_body_fonts": "true",
  "custom_body_font_weight": "400",
  "custom_body_font_line-height": "1.6",
  "custom_body_font_size_desktop": "17px",
  "custom_body_font_size_mobile": "16px",
  "view_advanced_button_customizations": "true",
  "btn_font_weight": "500",
  "custom_button_font_size_desktop": "14px",
  "custom_button_font_size_mobile": "13px"
}
```
