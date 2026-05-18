---
name: template-theme-settings
description: Templates declare top-level Kajabi settings (color_primary, fonts, button styles) and custom CSS via TemplateDef.themeSettings + customCss. These brand Kajabi system pages (login, store, checkout) we don't compose ourselves.
type: feature
---

# Template-wide theme settings + custom CSS

Each `TemplateDef` (in `src/lib/templates.ts`) can declare two optional fields that brand the **entire Kajabi site**, including pages we don't compose:

```ts
export interface TemplateDef {
  // ... pageKeys, buildPages, renderPage, imageSlots ...
  themeSettings?: Record<string, string>;
  customCss?: string;
}
```

## Why this matters

Kajabi's system pages (login, password recovery, store, checkout, library, member directory, 404) render server-side using top-level theme settings from `settings_data.json` and the global `css` field. If we don't set those, those pages show **default Kajabi styling** — wrong fonts, wrong colors — even though our composed pages look on-brand.

## Two layers

### 1. `themeSettings` — typed schema fields
Keys MUST exist in `src/engines/templateSettingsCatalog.ts` (extracted from `settings_schema.json`). Common fields:

- **Color**: `background_color`, `color_primary`, `color_heading`, `color_body`, `color_body_secondary`, `color_placeholder`
- **Heading font**: `font_family_heading`, `font_weight_heading`, `line_height_heading`
- **Body font**: `font_family_body`, `font_weight_body`, `line_height_body`
- **Type scale**: `font_size_h1_desktop` … `font_size_h6_desktop`, `font_size_body_desktop`, plus `_mobile` variants
- **Buttons**: `btn_style`, `btn_size`, `btn_width`, `btn_border_radius`, `btn_text_color`, `btn_background_color`

Unknown keys are dropped with a console warning at export time.

### 2. `customCss` — raw CSS escape hatch
For things the schema can't express: form input styling, link hover states, system-page polish, product/library card overrides. Wrapped at export in a `/* === template customCss === */` block so re-runs are idempotent.

## Pipeline

`SiteEditor.handleExport()` →
`exportFromTree(trees, { themeSettings, customCss })` →
`mergeThemeSettings(...)` in `src/blocks/export.ts` →
`exportThemeZip(merged, ...)`.

`mergeThemeSettings` writes themeSettings into `current` and appends customCss to `current.css` AFTER any auto-generated TreeGlobal font/type-scale block.

## Relationship to TreeGlobal

`TreeGlobal` (passed via `opts.global`) drives the **rendered CSS for our composed pages**. It generates font @imports + type-scale CSS that ships in `current.css`. It is invisible to Kajabi system pages.

`themeSettings` is the only way to brand Kajabi system pages. Use BOTH for full coverage — TreeGlobal for our pages' typography + customCss for everything else.

## Validation

`auditTemplateSettings(current)` at the end of `exportThemeZip` reports any unknown top-level keys + per-field issues (out-of-range values, invalid options). Check the export console output before shipping a template.
