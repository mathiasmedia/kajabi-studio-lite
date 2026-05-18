---
name: Font controls before custom CSS
description: Pro custom fonts win over legacy --pathx-font-* CSS — exportFromTree must suppress legacy font CSS when themeSettings drives fonts
type: preference
---
**Rule:** When `themeSettings` already configures fonts via Kajabi's native pickers (Standard `font_family_heading`/`font_family_body`) OR Pro custom fonts (`use_custom_fonts: "true"` + `override_heading_font_styles`/`override_body_fonts`), the legacy `TreeGlobal.headingFont`/`bodyFont` CSS injection in `packages/engine/src/blocks/export.ts` (`injectGlobalCss` → `buildFontCssBlock` → `--pathx-font-heading`/`--pathx-font-body` block) MUST be skipped.

**Why:** The legacy block emits `body h1, body h2, ... { font-family: var(--pathx-font-heading) }` which has higher specificity than Pro's `:is(h1,...)` font overrides. If `design.fonts.heading` is missing, `resolveFont(undefined)` defaults to Inter, and the export silently overrides the expert's Playfair (or whatever Pro slot they picked) with Inter — preview shows the right font (uses themeSettings cascade), Kajabi shows Inter (legacy CSS wins). Symptom: "the heading font is different in preview vs Kajabi."

**How to apply:**
- `exportFromTree` calls `themeSettingsConfigureFonts(opts.themeSettings)` and clears `headingFont`/`bodyFont`/`fontImports` from `opts.global` when true.
- Detection triggers on any of: `use_custom_fonts === "true"`, `override_heading_font_styles === "true"`, `override_body_fonts === "true"`, non-empty `font_family_heading`, non-empty `font_family_body`.
- Per AGENTS §9.8e: ALWAYS reach for `themeSettings` font fields first. Never hand-write `:root { --pathx-font-* }` or any `body h1 { font-family: ... }` rule into `customCss`. Pro custom fonts is the only correct path for non-Kajabi fonts.
