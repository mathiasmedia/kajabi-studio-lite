---
name: Style guide cascade discipline
description: Always set styling via themeSettings (style guide) FIRST, per-block overrides SECOND, customCss LAST RESORT. Fonts via Pro custom font system (or Standard font fields), never hand-written @import + body{font-family} in customCss. Hardcoded customCss is invisible to Kajabi's style guide editor and silently overrides expert UI tweaks.
type: preference
---

# Style guide cascade discipline

The cascade for ALL styling decisions (fonts, colors, buttons, spacing, type sizes):

1. **`themeSettings` (style guide) FIRST** — sitewide, editable from Kajabi UI.
2. **Per-block overrides SECOND** — only when one block must differ from sitewide.
3. **`customCss` LAST RESORT** — only when style guide genuinely can't express it (e.g. `.logo__text` per AGENTS §4.35f, Kajabi-rendered DOM with no schema field).

## Why
Anything in `customCss` is invisible to Kajabi's style guide editor. The expert can't change it from the UI later. Every hardcoded rule silently overrides whatever they set in the style guide → "I changed the heading font and nothing happened" support bug.

## Fonts — canonical procedure
- **Pro themes:** `themeSettings.use_custom_fonts: "true"` + `font_link_*` + `font_family_primary_name` (+ accent) + `override_heading_font_styles: "true"` + `select_custom_all_headings_font: "primary"` (per `mem://reference/pro-all-headings-font-field-id.md`). Per-element via `override_h<N>_font_styles` per AGENTS §4.22.
- **Standard themes:** `themeSettings.font_family_heading` + `font_family_body` + weights + line-heights.
- **Only fall back to `customCss`** when font isn't on Google Fonts AND can't be linked via Pro's `font_link_*`, OR when targeting a Kajabi DOM element with no schema field.

NEVER hand-write `@import url(...fonts.googleapis...)` + `body{font-family:...}` in `customCss` when `themeSettings` could express it. The legacy `--pathx-font-*` injection in `export.ts` (`buildFontCssBlock`) creates a `body h1, body h2, ...` selector with higher specificity than Pro's `:is(h1,...)` overrides — if both run, legacy wins and silently replaces the expert's Pro font with Inter (see `mem://feature/font-controls-before-css.md`).

## Colors — canonical procedure
- Sitewide brand → `design.branding` (3 colors, fills empty themeSettings) AND/OR `themeSettings.color_primary` / `color_accent` / `color_button` / `color_button_text`.
- Section bg → section's `background` prop.
- Block tint → block's `backgroundColor` chrome prop.
- NEVER hand-write `:root{--pathx-color-*}` or `body{color:...}` in `customCss`.

## Buttons — canonical procedure
- Sitewide → `themeSettings.color_button` + `color_button_text` + `btn_border_radius` (Standard) or Pro overrides per AGENTS §9.8.
- Per-CTA differences → block-level button props per AGENTS §4.7.
- NEVER hand-write `.btn { background: ... }` in `customCss`.

## Audit pass on every site
1. Open `design.themeSettings`. If fonts/weights/colors/buttons are missing → set them there FIRST.
2. Open `design.customCss`. Migrate any typography/color rules that duplicate `themeSettings` capability.
3. Only rules that survive: `.logo__text`, `.pricing__heading` typography, animations, complex selectors, `@media` beyond Pro's mobile font sizes.

## Symptoms that indicate violation
- "Style guide change had no effect" → customCss higher-specificity rule.
- "Expert can't recolor from Kajabi" → colors hardcoded in customCss.
- "Font picker shows Inter but site uses Cormorant" → font set via customCss `@import`, not themeSettings.
- "Tweaked one CTA, all CTAs changed" → color in customCss `.btn` instead of block prop.
