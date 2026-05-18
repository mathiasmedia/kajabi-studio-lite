---
name: Pro template capabilities
description: Pro-only blocks, sections, fields, and authoring features available when site.base_theme ends in `-pro`. Additive over Standard. Sourced from Kraig Mathias' creator walkthrough.
type: reference
---

> **DUAL LOCATION — KEEP IN SYNC.** This content is mirrored in `AGENTS.md` §9 so thin clients can inherit it via "sync AGENTS.md from master" (thin clients cannot read master memory files). When you change anything here, update `AGENTS.md` §9 in the same edit. Field IDs, override sentinels, and verified Liquid behavior MUST match across both files.

## When this applies

A site uses a Pro theme when `resolveBaseTheme(site)` returns `streamlined-home-pro` or `encore-page-pro`. Otherwise Pro-only blocks/fields are silently dropped by Kajabi. **NEVER use Pro blocks/fields on a Standard site.** Check `site.base_theme` before composing Pro features.

Standard ↔ Pro is **additive only**: every Standard block/field renders identically in Pro. A Standard site can be safely re-exported against Pro without changes.

## Headline Pro features (creator walkthrough)

These are the high-value features Pro unlocks. All are configured via section/block settings — no custom code.

### 1. Pro header (full-time hamburger / FTH menu)
- Also called "FTH" (Full-Time Hamburger) in the creator's UI. Section-level toggle: `collapsed: true` (a.k.a. "Full-time hamburger menu") forces the mobile slide-in menu to also show on desktop. **Identical behavior on desktop and mobile** — slide-in panel from the right side.
- Integrates with Kajabi user menu, CTA, logo automatically.
- Composes with overlay header AND sticky header modes (per §4.4 — still don't enable sticky/overlay unless asked).
- Knobs:
  - **FTH menu text color** (font color inside the slide-in panel) — default uses Kajabi's body font color.
  - **FTH menu background color** (slide-in panel bg) — default white.
  - **FTH menu close-button color** — `dark` or `light` toggle (controls the X icon contrast).
  - **Hamburger icon color** — any color (the 3 lines that open the menu).
- Optional — leaving it off gives the regular Kajabi horizontal nav.

### 2. Pro footer (`footer_pro`)
- Separate section type — exists ALONGSIDE the standard footer for backwards compatibility on upgraded sites.
- **Mutual exclusion is author-managed via per-section visibility toggles** — both the standard footer and `footer_pro` have `Hide on Desktop` + `Hide on Mobile` fields under their Desktop/Mobile setting groups. To switch to Pro: set the standard footer's `Hide on Desktop: true` + `Hide on Mobile: true`, leave `footer_pro` visible. There is no theme-level "use_pro_footer" toggle. When we emit a Pro site that uses `footer_pro`, our serializer MUST also flip the standard footer's hide-on-desktop + hide-on-mobile flags to `true` (otherwise both render and visitors see two stacked footers).
- **Brings full section functionality to the footer** — accepts ALL block types (not just the standard 5: logo/link_list/text/social/copyright). E.g. image, custom code, spacers, vertical menus, sign-up/opt-in forms.
- Adds full section-level controls: padding, alignment, border, background, column widths (uses the standard 12-col grid — e.g. 1 / 1 / 6 / 4 = image + spacer + two menus + form).
- Adds a **merged copyright + Powered-by-Kajabi** mode with alignment + border options.
- Use case: real branded footer with newsletter opt-in, logo image, multiple vertical link columns, custom code — applied site-wide, not per-page.

### 3. Pro slider (any section, any blocks)

Section-level toggle: `enable_slider: true` turns the section's blocks into a Swiper carousel. Works with ANY block type. **Field IDs and defaults verified against `streamlined-home-pro/sections/section.liquid` + `snippets/column_one_slider.liquid` (also `_two`/`_three` — identical).** Mirrored in `AGENTS.md` §9.3 — keep in sync.

**Schema fields (visible in Kajabi UI):**
- `blocks_per_slide` (range 1–12, default `3`) — desktop only. **Mobile is hardcoded to 1 in Liquid (`{% assign blocks_per_slide_mobile = 1 %}`); there is NO `blocks_per_slide_mobile` setting.** Don't expose a mobile knob — it can't reach Kajabi.
- `hide_overflow` (checkbox, default `true`) — clips slides that would bleed past the section padding.
- `slider_preset` (select, default `"modern"`) — options: `"default"` (Classic: centered dots + arrows) and `"modern"` (dots bottom-left, arrows bottom-right, on one line below the slider). **This is the ONLY field controlling dot/arrow alignment** — there are no separate `dot_align` / `arrow_align` / `arrow_position` fields. Earlier walkthrough notes about "position (inside / outside / centered / above / below)" were wrong.
- `show_arrows` (default `true`), `arrow_color` (default `#333333`), `arrow_slider_margin` (range 0–50, default `0`).
- `show_dots` (default `true`), `dot_color` (default `#333333`).
- `transition_effect` (select, default `"slide"`) — **schema only exposes `slide` + `coverflow`**, but the runtime Swiper config whitelists `slide / fade / cube / coverflow / flip`. We support all 5 in serialization (Kajabi runtime accepts them even though the UI doesn't list them).
- `transition_speed` (range 100–3000, default `500`).
- `autoplay` (default `false`), `autoplay_delay` (range 500–10000, default `3000`).
- `loop` (default `false`).
- `block_offset` (range 0–20, default `0`) — N leading blocks kept OUTSIDE the slider but inside the section. **Field ID is `block_offset`, NOT `block_offset_before`.**
- `block_end_offset` (range 0–20, default `0`) — N trailing blocks. **Field ID is `block_end_offset`, NOT `block_offset_after`.** Canonical use: `block_offset: 1` to keep a heading text block above the carousel in the same section. **This is the ONLY correct way to keep a heading visually grouped with a carousel.**

**Hidden settings referenced in CSS but NOT in the schema** (no Kajabi UI exposes them; they fall back to defaults via Liquid `| default:`):
- `arrow_size` (default `32px`) — font-size of the arrow button container.
- `dot_size` (default `10px`), `dot_margin_top` (default `20px`).
- `space_between_slide_blocks` (default `0`) — desktop gap between slides.
- `space_between_slide_blocks_mobile` (default `0`) — mobile gap.

We expose `spaceBetweenDesktop` / `spaceBetweenMobile` props on `ContentSection` and serialize to these hidden fields — Kajabi reads them at runtime even though no UI sets them. The other hidden fields (`arrow_size`, `dot_size`, `dot_margin_top`) are not exposed — defaults are fine.

**Arrow markup is fixed (NOT customizable per-section):** Pro renders chevrons as inline SVG polylines, not Swiper's native font glyphs. Exact markup from `column_one_slider.liquid`:
```html
<div class="slider-arrows" aria-label="Slider navigation">
  <div class="swiper-button-prev swiper-button-prev-{{section.id}}">
    <span class="slider-arrow-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <polyline points="15 18 9 12 15 6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </div>
  <div class="swiper-button-next swiper-button-next-{{section.id}}"> <!-- next polyline points: "9 18 15 12 9 6" --> </div>
</div>
```
Section CSS explicitly suppresses Swiper's default `::after` glyphs with `content: none !important;`. **Earlier guidance about "custom SVG (paste icon SVG for prev/next)" was wrong** — no such field exists. Our preview in `src/blocks/sections.tsx` mirrors this exact markup so the editor matches the export.

**Runtime quirks:**
- The slider script re-initializes on `DOMContentLoaded`, the custom `section:load` event, and a debounced MutationObserver — necessary so sliders inside tabs (Pro feature §5) rebuild when their tab becomes visible.
- `data-effect` is read fresh on each init; `fadeEffect.crossFade` is NOT set in Pro's runtime config (the bug `mem://reference/kajabi-fade-slider-bug.md` works around — the exporter auto-injects CSS when any section uses `transition_effect: "fade"`).

**Composition with Pro columns:** when a section has `columns: 2` or `columns: 3` (Pro feature §4), an extra `slider_column` setting (`first` / `second` / `third`, default `first`) picks which column hosts the slider — only that column's blocks become slides; the other columns render normally.

**Mandatory authoring rules:**
- Use `block_offset: 1` to keep a heading text block grouped with the carousel — never put the heading in a separate section.
- Default `slider_preset` to `"modern"` to match Kajabi's UI default.
- Don't set per-section `arrow_color` / `dot_color` randomly — pull from `themeSettings.color_button` or `color_primary` so all sliders on a site match.

### 4. Pro columns (2 or 3 columns per section)
- Section-level toggle: `columns: 2` or `columns: 3`. **Per-section** — every section can have its own column config (or none). Use as many times per page as needed.
- **Per-column width** uses the 12-col grid (e.g. 6/6, 9/3, 3/9, 4/4/4, 8/2/2, 3/6/3). Widths must sum to 12.
- **Per-block column assignment:** each block has a `column: 1 | 2 | 3` setting placing it in that column. Defaults to column 1.
- **Block width inside a column:** to fill its column, set the block's own `width: "12"` (block width is now RELATIVE to the column, not the page). Without this, blocks take only part of the column and look broken.
- **Stacking:** multiple blocks in the same column stack vertically in array order. Reorder blocks to reorder the stack.
- **Column gap** (`column_gap`): configurable in pixels (e.g. 20px tight, 60px wide).
- **Sliders work INSIDE a column** (slider left, stacked text/CTAs right, etc.).
- **Mobile collapse:** columns stack vertically in order column 1 → 2 → 3. Automatic, no config.
- Far better than Standard's 12-col grid for sidebar + side-by-side layouts.

#### 4a. Vertical block stacking inside a column (THE Pro columns superpower)

The biggest reason to reach for Pro columns over the standard 12-col grid is **vertical stacking of multiple block types inside a single column**. The standard grid only places blocks side-by-side in one row; Pro columns let you stack heterogeneous blocks (text → stats → CTA → image → accordion) within a column while still controlling each one independently. Mirrored in `AGENTS.md` §9.4a — keep in sync.

**How it works:** every block carries an optional `column: 1 | 2 | 3`. The serializer + preview group blocks by that value and render each group as its own vertical stack inside the corresponding column. Order within a column = order in the `blocks` array. There is no nesting — you do NOT wrap blocks in a "column container" block; you just tag each block with which column it belongs to.

**Canonical pattern — image left, stacked content right (intro + stats + CTA):**

```jsonc
{
  "kind": "content",
  "name": "Built for online business",
  "props": { "columns": 2, "columnWidths": [6, 6], "columnGap": 48, "vertical": "center" },
  "blocks": [
    { "type": "image", "props": { "column": 1, "colWidth": "12", "src": "https://...", "alt": "..." } },
    { "type": "text",  "props": { "column": 2, "width": "12", "align": "left",
        "text": "<p>...eyebrow...</p><h2>Built for the experts...</h2><p>...body...</p>" } },
    { "type": "text",  "props": { "column": 2, "width": "12", "align": "left",
        "text": "<div style='border-top:1px solid #D8C9B0;padding-top:28px;margin-top:36px;display:flex;gap:40px;'>...stats...</div>" } },
    { "type": "cta",   "props": { "column": 2, "width": "12", "align": "left",
        "buttonText": "Start Your Project", "buttonUrl": "/contact",
        "buttonStyle": "solid", "buttonBackgroundColor": "#2A211B", "buttonTextColor": "#FBF8F2", "buttonBorderRadius": "2",
        "padding": { "top": "32", "right": "0", "bottom": "0", "left": "0" } } }
  ]
}
```

**Authoring rules:**

1. **Use it instead of cramming everything into one giant text block.** If a `text` block's HTML contains heading + body + stats grid + a styled `<a>` button, split into 2–4 blocks tagged to the same `column`. Stats become their own `text` block; the CTA becomes a real `cta` block (so it inherits the brand button system per the CTA Buttons core rule and §8a).
2. **`width: "12"` on every block in the same column.** Block width is RELATIVE to the column. `width: "6"` inside a column = half-fills that column (rarely wanted when stacking).
3. **Vertical spacing between stacked blocks** comes from each block's chrome `padding` (object form: `{top, right, bottom, left}`, never scalar — see "Block padding must be object" memory) or inline `margin-top` in the block HTML. There is no built-in "row gap" between stacked blocks.
4. **Mix block types freely.** A column can stack `text + cta + image + accordion + feature` in any order. Grouping is purely by the `column` prop — type doesn't matter.
5. **Empty columns are valid.** A 3-column section can leave column 2 empty and put blocks only in 1 and 3 — Kajabi renders the empty column as whitespace. Useful for asymmetric reading layouts.
6. **Match the CTA to the rest of the site.** When you split a baked-in `<a>` button out of HTML into a real `cta` block, audit existing CTAs and copy their `buttonBackgroundColor` / `buttonTextColor` / `buttonStyle` / `buttonBorderRadius` exactly.
7. **Section-level `vertical` aligns columns relative to each other**, not blocks inside a column. Inside a column, blocks just flow top-to-bottom.

**When to reach for stacked columns vs other patterns:**

| Layout intent | Use this |
|---|---|
| Image left, headline+body+stats+CTA right (canonical hero/about split) | Pro columns 6/6, stack text+text+cta in column 2 |
| Three feature cards in a row, each with icon+title+body+button | Standard 12-col grid with `feature` blocks (no Pro needed) |
| Sidebar filter + product grid | Pro columns 3/9, search/filter blocks in column 1, products in column 2 |
| Hero with badge above headline above two CTAs | Single column, stack badge+text+cta+cta blocks |
| Pricing table, three tiers each with heading+price+bullet list+CTA | Pro columns 4/4/4, stack text+text+text+cta in EACH column |

**Anti-pattern — DON'T do this:**

```jsonc
// ❌ One massive text block doing everything inline.
// Lose: brand CTA system, semantic structure, independent A/B copy, Kajabi per-block editor controls.
{ "type": "text", "props": { "column": 2, "text":
  "<h2>...</h2><p>...</p><div class='stats'>...</div><a class='button' href='/contact'>Start</a>" } }

// ✅ Three blocks in column 2 — text + text + cta.
```

**Pre-flight check when restructuring a section into Pro columns:** before saving, walk every block and confirm (a) every block has an explicit `column` value, (b) every block has `width: "12"` unless you specifically want fractional fill inside the column, (c) every `cta` block matches the site's brand button styling, (d) any inline `<a class="button">` previously baked into HTML has been extracted into a real `cta` block.

### 5. Pro tabs (sections-as-tabs)
- **Setup procedure (mandatory order):**
  1. Build each tab's content as its OWN separate `ContentSection` (e.g. one section for "Annual pricing", another for "Monthly pricing"). They live as siblings on the page.
  2. On EACH participating section, set `use_as_tab: true` and assign a unique `tab_slug` (lowercase, e.g. `annual`, `monthly`). Set `default_tab: true` on EXACTLY ONE of them — that's the tab shown on page load.
  3. Add a new section using the `tabs` block (under "Custom" → Tabs). Order it ABOVE the participating sections in the page.
  4. Inside the `tabs` block, define each tab as a `{ name, slug }` pair. The `slug` MUST match the `tab_slug` you set on each section. The `name` is the human label shown on the tab (e.g. "Annual"); slug is the lowercase machine ID (e.g. `annual`).
  5. Up to **5 tabs** per `tabs` block.
- **Style:** `pills` (default) OR `tabs` (real tab look). Alignment: left / center / right. CSS-stylable for fully custom visuals.
- **Tab fade transition** (`tab_fade_effect`) is on by default. Uncheck on EACH participating section to remove the fade and get instant tab swaps.
- Works with ANY section content — pricing cards, text, image galleries, features, anything.
- Canonical use: monthly vs yearly pricing, feature comparisons, plan tiers.
- **Slug-matching is the #1 failure mode** — a typo between `tabs` block slug and section `tab_slug` silently hides the section. Always normalize to lowercase.

### 6. Search form + Search filter blocks (TWO separate blocks, work independently)
- **TWO Pro-only blocks** that both target sibling `feature` blocks in the same section. They are independent — keyword search does NOT clear the filters and vice versa, but using one resets the other's UI state.
- **`block_search_form`** — keyword text input. Filters by free-text content match against feature blocks in the SAME section. Only styling settings; no logic config.
- **`block_search_filter`** — up to **5 filter groups** (toggle each on/off independently — disabling filter 2 collapses 3/4/5 up to fill).
  - Per-filter: custom title (e.g. "Tags", "Categories", "Locations") + comma-separated options ("Marketing, Email, SEO").
  - **Filter logic:** within ONE filter group → OR (selecting Marketing + Email = matches in either). Across DIFFERENT filter groups → AND (Marketing tag + SEO category = only items matching both). Comprehensive cross-filter narrowing.
  - **Layouts:**
    - Default — checkboxes stacked vertically (best in a sidebar column).
    - `use_dropdown_filters: true` — collapses each filter group into a clickable dropdown (cleaner sidebar).
    - `use_dropdowns_horizontally: true` — combine with `use_dropdown_filters`. Lays the dropdowns out horizontally above the content. Recommended pattern: drop the search/filter blocks INTO their own full-width section above the feature grid, not in a sidebar.
- **Canonical sidebar pattern:** Pro columns with left col `width: 3` (search form on top, filter below) + right col `width: 9` (3-up feature grid). Set section `horizontal: left` so filtered cards collapse left instead of re-centering.
- **Canonical horizontal pattern:** Single full-width section, search form + filter (with `use_dropdown_filters` + `use_dropdowns_horizontally`) on top, feature grid below.
- **Both blocks only filter feature blocks in the SAME section** — they cannot reach into other sections.

### 6b. Pro library / products section (custom filtering)
- Pro upgrades the Kajabi `products` section (used on the `library` page) with built-in filtering. **This means the §4.10 rule still holds** — keep `library` as `{ kind: "raw", type: "products" }` so Kajabi renders the expert's real products — but on Pro themes you can pass extra `settings` to control filtering behavior.
- **Static filter** (author-controlled, hides products from the visitor):
  - `static_filter_enabled: true`
  - `static_filter_mode: "include" | "exclude"`
  - `static_filter_keywords: "launch, business"` — comma-separated; matches against product title keywords. `include` = only show matching, `exclude` = hide matching.
  - Canonical use: dedicate one library section to a "Featured" product (`include` a specific keyword), then add a SECOND `products` section below it with the same keyword `exclude`d, labeled "All products". This gives a featured-on-top + everything-else-below library layout.
  - Multiple `products` sections on the same library page is the supported pattern for category grouping (e.g. one per category, each filtered by its own keyword).
- **Dynamic filter** (visitor-controlled, additive to static filter):
  - `dynamic_filter_enabled: true`
  - Renders a keyword search input + category dropdown above the product grid.
  - `dynamic_filter_categories: "blogging, growth, launch"` — comma-separated category labels; each matches against product title keywords. Categories show as a select dropdown with a clear option.
  - Keyword search filters by free-text title match in real time.
  - Static + dynamic compose: e.g. exclude the featured product statically, then let the visitor search/filter the rest.
- **Page composition rule:** library page may have MULTIPLE `{ kind: "raw", type: "products", settings: { ... } }` sections, each with its own filter config and intro `content` section above it (eyebrow + h2). Still no hardcoded product cards — Kajabi renders all product data; we only configure filtering.

### 7. 26 pre-designed section presets
- Layout starters (white-boxes, featured testimonial, team grid, gradient CTA, "as seen on" logos, text+image splits, 3-feature grids, etc.).
- Inherit theme styles automatically — no custom styling required.
- Optional — use as scaffolds, then customize.

### 8. Style guide / theme settings extras

#### 8a. Pro button system (global + per-button overrides)
Pro replaces Kajabi's single-button styling with a **dark/light pair** model so the same site can ship buttons over both light and dark sections without per-button color picking. Configure globally in **Page Settings → Style guide → Buttons**, then override per-CTA inside any `cta`/`text`-with-button block. **Field IDs below are the literal Kajabi `settings_data.json` keys — verified against `streamlined-home-pro/config/settings_schema.json`.**

**Global theme settings (style guide):**
- `btn_background_color` (label "Button Color **Dark**") + `btn_text_color` (label "Button Color **Light**") — Pro repurposes the two existing Kajabi color fields as the dark/light brand pair. **Counterintuitive:** `btn_text_color` does NOT mean "text color" — it's the LIGHT half of the pair. Authors pick ONE pair sitewide; every button then chooses which member it uses via `btn_type`.
- `btn_type`: `"dark"` | `"light"` (radio, default `"dark"`) — which member of the pair this button uses. (Replaces Kajabi's single bg/fg model.)
- `btn_style`: `"solid"` | `"outline"` | `"text"` (radio, default `"solid"`) — Pro adds `"text"` (no padding, no border, just a styled link with the button's font treatment).
- `btn_size`, `btn_width`, `btn_border_radius` — same as Standard.
- **Advanced options gated behind `view_advanced_button_customizations: true`** (theme setting toggle). Until that's on, the fields below are hidden in the Kajabi UI but still emit/respect from JSON.
- `btn_override_shadow`: `"on"` | `"off"` (radio, default `"on"`) — toggle off to remove the default subtle drop shadow.
- `btn_inverse_on_hover`: `"normal"` | `"inverse"` (radio, default `"normal"`) — `"inverse"` swaps fg/bg using the dark/light pair on hover (works for both `dark` and `light` types; works on outline + solid). Replaces Kajabi's default opacity-shift hover (which does nothing on outline buttons).
- `btn_uppercase`: `"on"` | `"off"` (radio, default `"off"`) — uppercase all button text sitewide.
- `select_custom_btn_font`: `"inherit"` | `"primary"` | `"accent"` (select, default `"inherit"`) — `"inherit"` = "Do Not Override" sentinel. Picks the custom font registered in §8c.
- `btn_font_weight` — any of the 9 weights (100–900) the loaded font supports.
- `custom_body_button_line-height` (note: **hyphen, not underscore**, in the key), `btn_letter-spacing` (also hyphen) — typographic precision.
- `custom_button_font_size_desktop` + `custom_button_font_size_mobile` — independent.
- `button_border_thickness` — px (e.g. `2`).
- `button_vertical_padding` + `button_horizontal_padding` — inner padding (two separate fields, NOT a `padding` object).
- `custom_button_top_margin` + `custom_button_bottom_margin` — outer space above/below.

**Per-button overrides (on every `cta` block, and on text blocks with inline buttons):**
- Every global field above also exists as a per-block override.
- **"Do Not Override" sentinel = the literal string `"inherit"` for EVERY field** (verified in `snippets/block_cta.liquid` — every override field is checked with `{% if block.settings.X != 'inherit' %}`). This applies even to numeric fields like padding/margin/font-size and to color fields. The Kajabi UI defaults all per-block override fields to `"inherit"`. **Serializer rule:** to preserve global behavior, emit `"inherit"` (NOT `""`, NOT omit the key) — Liquid's `default:` filter only applies on `nil`, and the override fields are explicitly compared to `'inherit'`, so empty string would be treated as a real override and produce broken CSS like `font-size: ;`.
- Authors can mix: set `btn_type: "light"` on one button to flip just that one to the light variant while everything else stays dark.

**Style + hover behavior (verified in `snippets/block_cta.liquid`):**
- `btn_style: "text"` **DOES respect `btn_color_dark`/`btn_color_light` via `btn_type`** — there are dedicated `text + dark` and `text + light` branches. Text buttons use the dark/light pair color as the link color (no padding/border, just the colored anchor). They do NOT fall back to body text color.
- `btn_inverse_on_hover: "inverse"` is implemented ONLY inside the `solid` and `outline` branches. The `text` branches contain no inverse-hover code path — **inverse hover is a no-op on `btn_style: "text"`**. Don't set it expecting a visible effect on text buttons.

**Composition rule:** still follow §4.7 — pick the dark/light pair ONCE per site, set globals to match, and use per-button overrides only for genuine variant needs (e.g. a single light button on a dark hero, secondary text-style button next to a primary solid one). Do not randomly mix solid/outline/text or override colors across sections.


#### 8b. Pro form input system (global + per-form overrides)
Mirrors the button system for **opt-in / contact / search form inputs**. Configure globally in **Page Settings → Style guide → Form styles**, then override per-form inside any `form`/`opt_in` block. **Field IDs verified against `streamlined-home-pro/config/settings_schema.json`.**

**Global theme settings:**
- `form_input_color_dark` + `form_input_color_light` — brand color pair for input bg.
- `form_input_placeholder_color_dark` + `form_input_placeholder_color_light` — placeholder text color per pair member. (Plus the existing standard `color_placeholder` global.)
- `form_new_input_type`: `"dark"` | `"light"` (radio, default `"light"`) — which pair member this input uses.
- `form_new_input_style`: `"solid"` | `"transparent"` (radio, default `"solid"`) — `"transparent"` shows the section background through the input (use when the input sits on a colored/dark section and you want a borderless field).
- `form_input_border_radius` — px (Pro adds this; Standard has no rounding control on inputs).
- **Advanced options gated behind `use_pro_form_customizations: true`** (theme setting toggle). Same pattern as buttons.
- `form_input_border_thickness` — px.
- `form_input_font`: `"inherit"` | `"primary"` | `"accent"` (default `"inherit"` = "Do Not Override" sentinel).
- `form_input_font_weight`, `form_input_line-height` (hyphen), `form_input_letter-spacing` (hyphen) — typographic precision.
- `form_input_font_size_desktop` + `form_input_font_size_mobile` — independent.
- `form_input_vertical_padding` + `form_input_horizontal_padding` — inner padding (two separate fields).
- `form_input_top_margin` + `form_input_bottom_margin` — outer space above/below.

**Per-form overrides:** every field above is also available on the form block itself, with the same `"inherit"` sentinel as buttons (literal string, every field, including numerics — never `""` or omitted).

**Composition rule:** same as buttons — pick the dark/light pair ONCE, set globals, override only when a specific form needs the inverse variant (e.g. a transparent/light input on a dark footer).

#### 8c. Custom fonts (any `<link>` tag — Google, Adobe, self-hosted)
  - Paste **any `<link>` tag** into theme settings — Google Fonts embed, Adobe Typekit, self-hosted CDN, etc. Pro doesn't restrict to Google.
  - Name the font family in the input below the link field (must match the `font-family` declared by the loaded stylesheet).
  - Assign as **primary** OR **accent** font (two slots total per site).
  - Apply per-element: body / body-bold / h1 / h1-bold / h2 / h2-bold / h3 / h3-bold / buttons / forms — each independently via `select_custom_*_font` enums (`"inherit"` | `"primary"` | `"accent"`).
  - **`"inherit"` semantics (verified in `snippets/font_override_styles.liquid`):** the Liquid only emits a `font-family` rule when the value is `"primary"` or `"accent"`. `"inherit"` emits NOTHING — meaning the element falls back to Kajabi's standard heading/body font cascade (the theme's normal font picker), NOT to one of the two custom-font slots. The custom-font system is purely **additive on top of Standard's font picker** — `"inherit"` literally means "no custom font here, let Kajabi's default font win." So a Pro site can mix: H1 = primary custom font, H2/H3 = Kajabi's default heading font, body = accent custom font.
  - **All 9 font weights** available (100–900) when the loaded font ships them — Standard limits to normal/bold.
  - Per-element line-height, letter-spacing (incl. negative for condensed), font-size (desktop + mobile separately), bottom-margin.


#### 8d. Pro-only `custom_css_class` on every section
- Field key: **`custom_css_class`** (text input, default `""`) — added by Pro to `sections/section.liquid`. Standard themes do NOT have this field.
- Liquid renders it as `{% if section.settings.custom_css_class != blank %}{{ section.settings.custom_css_class }}{% endif %}` directly into the section's outer class list — so the value is space-separated CSS class names (e.g. `"mm-dark-hero dark-hero-form"`), NOT a single class.
- Combined with the theme-wide `customCss` slot (per `mem://feature/template-theme-settings.md`), this is the **canonical way to target a single section** with bespoke CSS without touching base theme files. Workflow: assign `custom_css_class: "hero-gradient-cta"` on the section → write `.hero-gradient-cta { ... }` in `themeSettings.customCss`.
- Use cases: per-section background gradients, scoped typography overrides, hiding a single CTA on mobile, custom hover treatments, animation triggers.
- **Pro-only — silently dropped on Standard sites.** When `resolveBaseTheme(site)` returns a non-Pro theme, never emit `custom_css_class` (the field doesn't exist in the section schema, Kajabi will ignore it).

#### 8e. Authoring workflow — prefer template controls over inline CSS

> Mirrored in `AGENTS.md` §9.8e. Keep in sync. The single biggest mistake on Pro sites is duplicating typography/button/form rules as inline CSS in block HTML — it bypasses the template's global controls, fights the cascade, can't be edited from Kajabi's page builder, and silently breaks when the expert tweaks the style guide.

**The hierarchy (use the highest level that solves the problem):**
1. **Template `themeSettings`** (sitewide defaults via the §8a/b/c override system). Always start here for fonts, headings, buttons, forms.
2. **Block-level overrides** on `cta` / form blocks — only when ONE block legitimately needs a variant.
3. **`custom_css_class` + `themeSettings.customCss`** (§8d) — for genuinely bespoke per-section visual flourishes.
4. **Inline `style=""` in block HTML** — last resort, only for content-specific decoration that would pollute the global cascade if lifted.

**Mandatory pre-flight before saving any styling change:**
1. **Audit existing inline CSS first.** Walk every block, grep HTML for `style="font-`, `line-height`, `letter-spacing`, `text-transform`, `padding:`, `font-size:`, `font-family:`. Every match is a candidate for deletion.
2. **Lift recurring inline rules into `themeSettings`.** Same `font-family` on 6 headings → set custom font slots + `select_custom_h*_font: "primary"`. Same button padding/casing/tracking on every CTA → set `view_advanced_button_customizations: "true"` + `btn_uppercase: "on"` + `btn_letter-spacing: "2px"` + `button_vertical_padding: "16px"` + `button_horizontal_padding: "32px"`. Then **delete the inline declarations**.
3. **Match the dark/light pair model (§8a).** Pick the brand pair ONCE; per-CTA, set `btn_type: "dark"` or `"light"`. Don't set per-block colors unless genuinely off-brand.
4. **Use the value-formats memory.** Every override field is enum-validated. See `mem://reference/pro-custom-fonts-value-formats.md` — bare numbers, `em` values, and gap values (`13px`, `15px`) are silently rejected. Always emit `"Npx"` strings on the documented px grid, unitless decimals on the 0.1 line-height grid, the 5px-grid for margins, and `[-2px,2px]` (NEVER `em`) for letter-spacing.
5. **Whenever you set any override field, flip its `hide_if` toggle to `"true"`** (per `mem://reference/pro-custom-fonts.md`) — otherwise the field is invisible in Kajabi's editor.
6. **Use `"inherit"` (literal string) for every override you DON'T want to change.** Never `""`, never omit. Empty string produces `font-weight: ;` — broken CSS.
7. **Mind the hyphen-in-ID fields:** `*_line-height`, `*_letter-spacing`, `custom_body_button_line-height`. Snake_case versions are silently dropped.
8. **Verify the preview matches.** Editor honors `themeSettings` overrides via `resolvePreviewFonts()` (see `mem://feature/preview-respects-pro-custom-fonts.md`). After changes, refresh — if typography/buttons don't update, you likely emitted an invalid value or forgot the visibility toggle.

**Anti-patterns (delete on sight):**
- ❌ Inline `font-family` on every heading instead of `select_custom_h*_font: "primary"`.
- ❌ Inline `padding`/`text-transform`/`letter-spacing` on every `<a class="button">` instead of the global `btn_*` system.
- ❌ Inline `line-height: 1.05` instead of `custom_h1_line-height: "1.0"` (snapped to the 0.1 grid).
- ❌ Per-CTA `buttonBackgroundColor` set to the same brand value on every CTA instead of one global `btn_background_color` + per-CTA `btn_type: "dark"`.
- ❌ Setting numeric overrides as bare numbers (`"42"`) — must be `"42px"`.
- ❌ Setting overrides as `em` (`"0.18em"`) — must be `"Npx"` clamped to `[-2px, 2px]`.
- ❌ Setting overrides to `""` thinking it means "use default" — produces broken CSS. Use `"inherit"`.
- ❌ Emitting an override without flipping its `hide_if` toggle — value applies but the expert can't see/edit it in Kajabi.
- ❌ Using `select_custom_h1_font: "inherit"` and expecting it to route to the accent slot — `"inherit"` means "no custom font, use Kajabi's default heading font". Use `"accent"` to route there.

**Worked example — Bennett Studio cleanup pattern:** symptom was every heading carrying inline `style="font-family: 'Playfair Display', serif; line-height: 1.05; letter-spacing: -0.02em;"` and every button carrying inline `style="padding: 16px 32px; text-transform: uppercase; letter-spacing: 0.18em; font-size: 13px;"`. Sitewide style-guide changes had no effect. Fix: set `themeSettings` once with `use_custom_fonts: "true"`, `use_primary_custom_font: "true"`, `primary_custom_font_name: "Playfair Display"`, `override_h1_font_styles: "true"`, `select_custom_h1_font: "primary"`, `custom_h1_line-height: "1.0"`, `custom_h1_letter-spacing: "-1.1px"`, `view_advanced_button_customizations: "true"`, `btn_uppercase: "on"`, `btn_letter-spacing: "2px"`, `custom_button_font_size_desktop: "14px"`, `button_vertical_padding: "16px"`, `button_horizontal_padding: "32px"`. Then delete every inline `style=` from heading and button HTML. Refresh preview → all headings/buttons render correctly, and the expert can now tweak everything from Kajabi's style guide.

**Key insight:** inline CSS is the symptom of a missed template-level control. Almost every typography/button/form rule belongs in `themeSettings`. Reach for inline styles only for true one-off content decoration.

## Pro-only block snippets (streamlined-home-pro + encore-page-pro)

These exist as `snippets/block_*.liquid` in Pro themes only. They are NOT yet wired into our React block library — exposing them requires the 6-step procedure at the bottom. Until then, Pro sites can still be composed from Standard blocks plus the section-level Pro features above.

| Snippet | Purpose | Key fields |
|---|---|---|
| `block_feature_icon` | Icon-led feature card (alternative to image-led `block_feature`) | `feature_icon` (icon picker), `feature_icon_color`, `feature_icon_size`, `image_width`, `image_border_radius`, `text` (HTML) |
| `block_code_tabs` | Multi-tab code/HTML viewer (up to 4 tabs) | `code_tabs` (HTML), `tabs_style` (`tabs`/`pills`), `tabs_align`, `first_tab_slug`/`first_tab_name` … `fourth_tab_slug`/`fourth_tab_name`, per-tab content |
| `block_search_filter` | Faceted filter widget (up to 5 filters) — see §6 above | `use_dropdown_filters`, `use_dropdowns_horizontally`, `use_filter_1` … `use_filter_5`, per-filter `filter_N_options` (CSV), `filter_N_title` |
| `block_search_form` | Standalone keyword search input | search input fields (TBD on first wire-up) |
| `block_image_icon` | Image used as icon (smaller, inline) | image picker + sizing |
| `block_test` | Internal Kajabi placeholder — **do not use** | n/a |

## Pro-only section snippets (column sliders)

Pro adds slider variants of column layouts driven by Slick selectors (`[data-slick-id]`):
- `column_one_slider.liquid` — single-column slider
- `column_two_slider.liquid` — two-column slider
- `column_three_slider.liquid` — three-column slider

These are layout switches set via section settings, not new block types.

## Pro-only sections

- `sections/footer_pro.liquid` — see §2 above.
- `sections/cta_popup.liquid`, `sections/exit_pop.liquid`, `sections/two_step.liquid` — sitewide overlay sections enabled via theme settings, not per-page blocks.

## Pro-only section-level fields

`sections/section.liquid` in Pro adds ~50 new fields. Categories:

- **Animation / reveal-on-scroll**: AOS-style — `animation_type`, `animation_duration`, `animation_delay`, `animation_offset`.
- **Slider mode** (see §3): `enable_slider`, `slider_autoplay`, `slider_speed`, `slider_dots`, `slider_arrows`, `slider_infinite`, `slides_to_show_*`, `block_offset_before`, `block_offset_after`, plus all arrow/dot positioning fields.
- **Columns** (see §4): `columns`, `column_widths`, `column_gap`, per-block `column`.
- **Tabs** (see §5): `use_as_tab`, `tab_slug`, `default_tab`.
- **Advanced borders**: per-side `border_top_*`, `border_right_*`, `border_bottom_*`, `border_left_*`.
- **Per-breakpoint columns**: `columns_desktop`, `columns_tablet`, `columns_mobile`.
- **Background video**: `bg_video_loop`, `bg_video_muted`, `bg_video_autoplay`, `bg_video_overlay_color`, `bg_video_overlay_opacity`.
- **Spacing precision**: per-breakpoint padding/margin (Pro adds more granular tokens).

To add support: extend `kajabiFieldSchema.ts` SECTION schema (mark new fields `proOnly: true`), extend `Section`/`ContentSection` React props, gate in `serialize.ts` so they only emit when the export target is a `-pro` theme.

## Roadmap for exposing Pro blocks

When a Pro-only block is actually needed, add it incrementally:

1. Create `src/blocks/components/<BlockName>.tsx` — React preview component matching the Liquid output.
2. Add `<block_type>` to `BlockType` union in `src/blocks/types.ts`.
3. Add field defaults to `src/blocks/blockDefaults.ts`.
4. Add serializer in `src/blocks/serialize.ts` mapping React props → Kajabi `block.settings.*` JSON.
5. Add field schema entry in `src/engines/kajabiFieldSchema.ts` with `proOnly: true`.
6. Update `getTemplateCapabilities()` so Standard-themed sites reject the block.

Do this only when an expert actually needs the block — don't expose all Pro blocks speculatively.
