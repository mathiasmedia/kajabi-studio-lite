# Kajabi Rendering Guide

## Overview

Kajabi Encore themes are not normal websites. They are structured theme packages made up of:

- Liquid templates
- section files
- snippet files
- layout files
- asset files
- a `settings_data.json` config model

A renderer’s job is to combine:

- theme files
- `settings_data.current`
- Kajabi-style Liquid context
- compiled theme CSS
- scoped styles

into final HTML and CSS.

---

## Core Mental Model

### 1. `settings_data.current` is the source of truth

All editable theme state lives under:

```json
{
  "current": { ... }
}
```

This includes:

- global settings
- `link_lists`
- `content_for_*`
- all `sections`
- header/footer section definitions

If a builder or exporter mutates a theme, this is the main data model it is changing.

### 2. Header and footer are special

Header and footer are **not normal page content sections**.

They should **not** be placed inside `content_for_index` or other `content_for_*` arrays.

They are rendered by the layout via:

```liquid
{% section "header" %}
{% section "footer" %}
```

and live under:

- `sections.header`
- `sections.footer`

---

## Theme File Structure

A Kajabi theme zip usually contains:

- `config/settings_data.json`
- `config/settings_schema.json` if present
- `layouts/*.liquid`
- `templates/*.liquid`
- `sections/*.liquid`
- `snippets/*.liquid`
- `assets/*`
- often `locales/*`

A renderer/parser/exporter should preserve this structure exactly.

### Export requirements

A safe export engine should:

- preserve the correct root folder structure
- write updated `config/settings_data.json`
- preserve untouched layouts/templates/sections/snippets/assets
- preserve binary assets
- use **STORE** compression
- validate before export

---

## High-Level Rendering Flow

At a high level, page rendering works like this:

1. read `settings_data.current`
2. build a normalized settings model
3. resolve the requested template, such as `templates/index.liquid`
4. determine which layout wraps it
5. resolve `content_for_*` page arrays
6. render each section in order
7. render each block inside each section
8. compile theme CSS
9. combine layout + page content + CSS into final HTML

For `index`, Kajabi commonly works like this:

- `templates/index.liquid`
- renders `{% content_for_index %}`
- that loops the section IDs in `current.content_for_index`
- each ID resolves to a section object in `current.sections`
- the section renders through its `type`
- the layout wraps the whole thing and renders header/footer separately

---

## `settings_data.current` Structure

### Global settings

Flat key/value settings such as:

- colors
- fonts
- button styles
- typography sizes
- background colors

### `link_lists`

Menu definitions such as:

```json
"link_lists": {
  "main-menu": {
    "links": [
      { "name": "Home", "url": "/" }
    ]
  }
}
```

### `content_for_*`

Ordered arrays of section IDs per page:

```json
"content_for_index": ["1575400116835", "1575400143733"]
```

These **must stay arrays**, not strings.

### `sections`

A dictionary of all section instances.

Each section usually has:

- `id`
- `type`
- `name`
- `hidden`
- `settings`
- `block_order`
- `blocks`

---

## Section Structure

A content section often looks like:

```json
{
  "type": "section",
  "name": "Hero",
  "hidden": "false",
  "settings": { ... },
  "block_order": ["id_0", "id_1"],
  "blocks": {
    "id_0": { "type": "text", "settings": { ... } },
    "id_1": { "type": "image", "settings": { ... } }
  }
}
```

Important rules:

- `block_order` must match actual block IDs
- sections referenced in `content_for_*` must exist
- section IDs must be unique
- section type must match a real renderable section template

---

## Block Structure

Blocks are rendered inside a section.

A block has:

- `id`
- `type`
- `settings`
- sometimes `hidden`

Common block types include:

- `text`
- `feature`
- `image`
- `cta`
- `accordion`
- `card`
- `social_icons`
- `link_list`

and other block types supported by the theme/snippet set.

---

## Recommended Normalized Models

### Raw theme data

The file-based model:

- layouts
- templates
- sections
- snippets
- text assets
- binary asset manifest
- raw `settings_data`

### Settings model

A renderer-friendly model:

- `globalSettings`
- `contentFor`
- `sections`
- `linkLists`

Normalization should:

- coerce booleans carefully
- resolve ordered blocks from `block_order`
- preserve link lists
- preserve per-section/per-block settings

---

## Boolean Coercion Rules

Kajabi often stores booleans as strings:

- `"true"`
- `"false"`

These should usually be coerced into real booleans.

### But do **not** coerce certain keys

Some keys must remain strings because they act like style tokens or class fragments.

Examples:

- `vertical`
- `horizontal`
- `alignment`
- `logo_type`

If these are coerced incorrectly, layout and CSS classes break.

---

## Critical Kajabi Field-Name Gotchas

### Button links

Use:

- `btn_action`

Not:

- `btn_url`

### Image links

Use:

- `img_action`

Not:

- `image_link`

### Feature blocks

`feature` blocks in `streamlined-home` use a **single rich-HTML field**:
`block.settings.text`. The heading goes inline as `<h3>...</h3>` and the body
as `<p>...</p>` — there is no separate `heading` or `body` field.

```json
{
  "type": "feature",
  "settings": {
    "text": "<h3>Fast</h3><p>Sub-second renders.</p>",
    "hide_image": "true",
    "width": "4"
  }
}
```

Legacy `{heading, body, extraHtml}` payloads are normalized into `text`
by `normalizeLegacyFeatureContent()` in `src/engines/kajabiFieldSchema.ts`
and are never emitted to `settings_data.json`. Feature blocks are valid in
body (`type: "section"`) sections — audit + transform engines count a
populated `feature.text` as meaningful content.

If a feature block has no image, set:

```json
"hide_image": "true"
```

Otherwise the theme may render a broken placeholder.

### Padding fields

These should be objects, not strings:

```json
"padding_desktop": {
  "top": "80",
  "right": "",
  "bottom": "80",
  "left": ""
}
```

Do not store them as stringified JSON.

---

## Liquid Rendering Context

When rendering a section, the Liquid context should include at minimum:

- `section`
- `block`
- `settings`
- `section_settings`
- `current_site`
- `current_site_user`
- `editor`
- page-level stubs like `page`, `sales_page`, `products`, `blog_post`
- `content_for_layout`

You also need enough stub context so templates do not crash when they expect Kajabi-like globals.

---

## Custom Liquid Filters to Support

At minimum, support these Kajabi-style filters:

- `color_scheme_class`
- `settings_id`
- `image_picker_url`
- `image_tag`
- `asset_url`
- `kajabi_asset_url`
- `google_fonts_url`
- `stylesheet_tag`
- `script_tag`
- `form_input`
- `cart`
- `display_price`
- `truncate_html`
- `pluralize`

### Filter behavior notes

- unknown filters should not hard-crash the preview when possible
- image and asset URL resolution needs to be robust

---

## Custom Liquid Tags to Support

At minimum, support these tags:

- `schema`
- `element`
- `element_attributes`
- `block_attributes`
- `section`
- `content_for_index`
- `dynamic_sections_for`
- `form`
- `paginate`
- `layout`
- `csrf_meta_tags`
- `content_for_header`

Some of these are effectively no-ops in preview, especially editor-only ones, but they still need safe handling.

---

## Section/Block Render Chain

A normal render chain looks like:

- template
- `content_for_*`
- section
- section template
- block wrapper
- block snippet
- specialized block snippet

Typical dynamic include behavior:

- `text` → `block_text`
- `feature` → `block_feature`
- `image` → `block_image`
- `accordion` → `block_accordion`

If the snippet chain is broken or block type resolution fails, the page may partially render or flatten important content.

---

## CSS Layering Order

A safe deterministic order is:

1. core CSS
2. compiled theme CSS from `styles.scss.liquid`
3. scoped inline section/block styles
4. `overrides.css`

This order matters because theme CSS establishes layout/grid/typography, while scoped styles and overrides finish the page look.

---

## Theme CSS Compilation

`styles.scss.liquid` is not just a static file.

It often contains Liquid interpolation using global settings.

So the renderer must:

1. render `styles.scss.liquid` against `settings`
2. treat the output as CSS
3. inject it in the correct order

---

## The 12-Column Grid Matters

Blocks often rely on widths like:

- `12`
- `6`
- `4`
- `3`

These map to the theme’s column classes and determine whether blocks sit:

- full width
- two-up
- three-up
- four-up

If widths or row settings are wrong, the whole section composition looks wrong even if the content is correct.

---

## Preview Truth Hierarchy

If you are building a builder or transformer, the right hierarchy is:

1. **Kajabi import + actual render is the final truth**
2. **Kajabi-aware renderer is the next-best truth**
3. **Any React approximation is only a convenience**

Approximate previews can look close while the real Kajabi output is still wrong.

---

## Export Requirements

A Kajabi export engine should:

- preserve the correct root folder structure
- write updated `config/settings_data.json`
- preserve untouched layouts/templates/sections/snippets/assets
- preserve binary assets
- use STORE compression
- validate before export
- never silently break structural theme files

It should catch:

- malformed `content_for_*`
- missing sections
- invalid block/order relationships
- wrong field names like `btn_url`
- stringified JSON
- missing header/footer assumptions

---

## Validation Rules Worth Having

A validator should check for:

- missing required files
- pages with no layout
- missing sections referenced in `content_for_*`
- duplicate section IDs
- malformed block structures
- block_order mismatches
- invalid padding objects
- bad boolean/string coercion
- unresolved assets
- broken include chains
- unsupported field names
- broken header/footer assumptions

Validation is what keeps export boring and trustworthy instead of fragile.

---

## What Breaks AI-Driven Generation Most Often

The most common failure chain is:

1. source extraction is too shallow
2. wrong section intent is inferred
3. AI picks the wrong Kajabi section type or block pattern
4. structural sanitizer fixes JSON shape
5. semantic meaning is still wrong
6. output imports but looks bad

### Main lesson

Do not let AI invent too much at once.

Use:

- a structured plan
- section-by-section generation
- known recipes
- deterministic export and validation

---

## Practical Rendering Rules for a New App

If rebuilding from scratch, treat these as non-negotiable:

### Rendering

- browser-side LiquidJS renderer
- accurate enough to judge template output
- support the real section/block render chain

### Theme target

- one fixed base theme first
- hard-code around that theme before generalizing

### Generation

- recipe-based
- section-by-section
- AI assists, not dominates

### Export

- deterministic
- validated
- rollback-friendly

### Refinement

- safe fixes first
- targeted regeneration second
- preserve good sections
- rollback regressions

---

## Best Mental Model for the New App

The cleanest model is:

**Reference input → structured page plan → Kajabi recipe plan → generated theme → Kajabi-aware preview → critique/refinement → strict export**

That is much stronger than:

**“AI, take this screenshot and make a theme.”**

---

## Must-Have Checklist

If starting over, these are the must-haves:

- accurate `settings_data.current` normalization
- safe boolean coercion
- strong custom filter/tag support
- correct header/footer handling
- deterministic CSS compilation/layering
- robust asset URL resolution
- strict validation
- STORE export compression
- one fixed base theme first
- section-by-section generation only
- accurate preview before export
- rollback-safe refinement

---

## Recommended Product Rule

Frame the app as:

**An AI-powered Kajabi homepage builder that uses structured planning, recipe-based generation, accurate Kajabi-aware preview, safe refinement, and strict export.**

Not:
- a generic site builder
- a renderer with AI bolted on
- a vague screenshot-to-code toy
