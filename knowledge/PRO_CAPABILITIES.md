# Pro template capabilities reference

This file holds the large Pro-only thin-client reference split out of `AGENTS.md` so `sync AGENTS.md from master` stays fast.

If the operator pastes **"sync PRO_CAPABILITIES.md from master"** or **"sync pro capabilities from master"**, sync this file only.

## 9. Pro template capabilities (inline reference for thin clients)

> This section mirrors `mem://reference/pro-template-capabilities.md` on master. It lives in `AGENTS.md` so every thin client gets it via "sync AGENTS.md from master" — thin clients cannot read master memory files. Keep the two in sync: when you update one, update the other.

### 9.0 When this applies

A site uses a Pro theme when `resolveBaseTheme(site)` returns `streamlined-home-pro` or `encore-page-pro`. Otherwise Pro-only blocks/fields are **silently dropped** by Kajabi. **NEVER use Pro blocks/fields on a Standard site.** Always check `site.base_theme` before composing Pro features.

Standard ↔ Pro is **additive only**: every Standard block/field renders identically in Pro. A Standard site can be safely re-exported against Pro without changes.

### 9.1 Pro header (Full-Time Hamburger / FTH)

Section-level toggle: `collapsed: true` (a.k.a. "Full-time hamburger menu") forces the mobile slide-in panel to also show on desktop. Identical behavior on both — slide-in from the right. Composes with overlay/sticky modes (still don't enable those unless explicitly asked, per §4.4). Knobs: `fth_menu_text_color`, `fth_menu_background_color`, `fth_close_button_color` (`dark`/`light`), `hamburger_icon_color`. Optional — leaving it off keeps the standard horizontal nav.

### 9.2 Pro footer (`footer_pro`)

A separate section type that exists alongside the standard footer for back-compat. **Mutual exclusion is author-managed** via per-section visibility toggles — both footers expose `Hide on Desktop` + `Hide on Mobile` fields under their Desktop/Mobile groups. **There is no theme-level "use_pro_footer" switch.** When emitting a Pro site that uses `footer_pro`, the serializer MUST also flip the standard footer's hide-on-desktop + hide-on-mobile to `true` (otherwise both render and the visitor sees two stacked footers).

`footer_pro` accepts ALL block types (not just the standard 5). Adds full section-level controls (padding, alignment, border, bg, 12-col grid) and a merged copyright + Powered-by-Kajabi mode.

### 9.3 Pro slider (any section, any blocks)

Section-level toggle: `enable_slider: true` turns the section's blocks into a Swiper carousel. Works with any block type. **Field IDs and defaults verified against `streamlined-home-pro/sections/section.liquid` + `snippets/column_one_slider.liquid` (also `_two`/`_three` — identical).**

**Schema fields (visible in Kajabi UI):**
- `blocks_per_slide` (range 1–12, default `3`) — desktop only. **Mobile is hardcoded to 1 in Liquid (`blocks_per_slide_mobile = 1`); there is NO `blocks_per_slide_mobile` setting.** Don't expose a mobile knob — it can't reach Kajabi.
- `hide_overflow` (checkbox, default `true`) — clips slides that would bleed past the section padding.
- `slider_preset` (select, default `"modern"`) — options: `"default"` (Classic: centered dots + arrows) and `"modern"` (dots bottom-left, arrows bottom-right, on one line below the slider). **This is the ONLY field controlling dot/arrow alignment** — there are no separate `dot_align` / `arrow_align` / `arrow_position` fields.
- `show_arrows` (default `true`), `arrow_color` (default `#333333`), `arrow_slider_margin` (range 0–50, default `0`).
- `show_dots` (default `true`), `dot_color` (default `#333333`).
- `transition_effect` (select, default `"slide"`) — **schema only exposes `slide` + `coverflow`**, but the runtime Swiper config whitelists `slide / fade / cube / coverflow / flip`. We support all 5 in serialization (Kajabi runtime accepts them even though the UI doesn't list them).
- `transition_speed` (range 100–3000, default `500`).
- `autoplay` (default `false`), `autoplay_delay` (range 500–10000, default `3000`).
- `loop` (default `false`).
- `block_offset` (range 0–20, default `0`) — N leading blocks kept OUTSIDE the slider but inside the section. **Field ID is `block_offset`, NOT `block_offset_before`.**
- `block_end_offset` (range 0–20, default `0`) — N trailing blocks. **Field ID is `block_end_offset`, NOT `block_offset_after`.** Canonical use: `block_offset: 1` to keep a heading text block above the carousel in the same section.

**Hidden settings referenced in CSS but NOT in the schema** (no Kajabi UI exposes them; they fall back to defaults via Liquid `| default:`):
- `arrow_size` (default `32px`) — font-size of the arrow button container.
- `dot_size` (default `10px`), `dot_margin_top` (default `20px`).
- `space_between_slide_blocks` (default `0`) — desktop gap between slides.
- `space_between_slide_blocks_mobile` (default `0`) — mobile gap.

We expose `spaceBetweenDesktop` / `spaceBetweenMobile` props in the React layer and serialize to these hidden fields — Kajabi reads them at runtime even though no UI sets them. The other hidden fields (`arrow_size`, `dot_size`, `dot_margin_top`) we don't expose — defaults are fine.

**Arrow markup (fixed, NOT customizable per-section):** Pro renders chevrons as inline SVG polylines, not Swiper's native font glyphs. The exact markup from `column_one_slider.liquid`:
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
Section CSS explicitly suppresses Swiper's default `::after` glyphs with `content: none !important;`. **Earlier guidance suggested arrows accept "custom SVG (paste icon SVG for prev/next)" — that was wrong, no such field exists.** Our preview in `src/blocks/sections.tsx` mirrors this exact markup.

**Runtime quirks:**
- The slider script re-initializes on `DOMContentLoaded`, the custom `section:load` event, and a debounced MutationObserver — necessary so sliders inside tabs (§9.5) rebuild when their tab becomes visible.
- The `data-effect` attribute is read fresh on each init; `fadeEffect.crossFade` is NOT set in Pro's runtime config (this is the bug `mem://reference/kajabi-fade-slider-bug.md` works around — the exporter auto-injects CSS when any section uses `transition_effect: "fade"`).

**Composition with Pro columns:** when a section has `columns: 2` or `columns: 3` (§9.4), an extra `slider_column` setting (`first` / `second` / `third`, default `first`) picks which column hosts the slider — only that column's blocks become slides; the other columns render normally.

**Mandatory authoring rules:**
- Default `slider_preset` to `"modern"` to match Kajabi's UI default.
- Don't set per-section `arrow_color` / `dot_color` randomly — pull from `themeSettings.color_button` or `color_primary` so all sliders on a site match.

#### 9.3a 🚨 SLIDER `block_offset` IS MANDATORY WHENEVER A SECTION HAS AN INTRO HEADLINE

**The #1 Pro slider mistake** — every single one of the section's blocks gets pulled into the slide pool by default, INCLUDING the section's intro/eyebrow/headline. So if you build a section like "12 Weeks · 24 Modules" + "A guided descent through every depth of the craft." + 6 module cards as a slider, the slider cycles through `[eyebrow] → [headline] → [card 1] → [card 2] → ...` and the headline appears as one of the slides. The expert sees their hero headline flicker past as a "slide" and reports: "the slider is sliding the wrong things" / "my title is in the carousel" / "you forgot to skip one block before starting the slider."

**The rule — count the intro blocks, set `block_offset` to that exact number.** Every time you set `enableSlider: true` on a section, walk the section's `blocks` array from the top and count every block that is NOT a slide (eyebrow text, headline text, lede paragraph, divider, intro CTA). Whatever that count is, set `block_offset: <count>` on the section's slider props. Same on the trailing side: count any outro blocks (final CTA, footnote) and set `block_end_offset: <count>`.

**Worked example — the canonical "intro + carousel" section:**

```jsonc
{
  "kind": "content",
  "name": "Curriculum",
  "props": {
    "background": "#FBF6EC",
    "enableSlider": true,
    "blocksPerSlide": 3,
    "transitionEffect": "slide",
    "block_offset": 2,        // ← skip eyebrow + headline (2 leading blocks)
    "block_end_offset": 0,    // no trailing blocks
    "slider_preset": "modern"
  },
  "blocks": [
    { "type": "text", "props": { "text": "<p class=\"eyebrow\">12 WEEKS · 24 MODULES</p>" } },     // ← block #0, intro (skipped)
    { "type": "text", "props": { "text": "<h2>A guided descent through every depth of the craft.</h2>" } }, // ← block #1, intro (skipped)
    { "type": "feature", "props": { /* Module 1 card */ } },   // ← block #2, slide 1
    { "type": "feature", "props": { /* Module 2 card */ } },   // ← block #3, slide 2
    { "type": "feature", "props": { /* Module 3 card */ } },   // ← block #4, slide 3
    { "type": "feature", "props": { /* Module 4 card */ } },   // ← block #5, slide 4
    { "type": "feature", "props": { /* Module 5 card */ } },   // ← block #6, slide 5
    { "type": "feature", "props": { /* Module 6 card */ } }    // ← block #7, slide 6
  ]
}
```

**Quick reference — what `block_offset` value matches your intro:**

| Intro shape above the carousel | `block_offset` |
|---|---|
| No intro — section is JUST the slider | `0` (default — fine) |
| Eyebrow OR headline only (1 block) | `1` |
| Eyebrow + headline (2 blocks) | `2` |
| Eyebrow + headline + lede paragraph (3 blocks) | `3` |
| Eyebrow + headline + lede + divider (4 blocks) | `4` |

**Pre-flight check — every time you set `enableSlider: true`:**
1. Walk the section's `blocks` array from index 0.
2. Count consecutive leading blocks that are NOT slides (intro copy, eyebrows, headlines, ledes, dividers, intro CTAs).
3. Set `block_offset` to that exact number.
4. Walk from the bottom; count consecutive trailing non-slide blocks. Set `block_end_offset` to that number.
5. Mentally simulate the slider: "the first slide should be `blocks[block_offset]`." If `blocks[block_offset]` is a heading, you've miscounted — increment.

**Symptom mapping — when the expert says any of these, fix `block_offset` FIRST:**
- "the headline is sliding past as a slide"
- "my title is in the carousel"
- "you forgot to skip one block before starting the slider"
- "the slider is sliding the wrong things"
- "the first slide is blank / shows the section title"
- "why does the slider include my eyebrow?"

**Never** put the intro into a separate section to "fix" this — that splits the visual rhythm and breaks the section's cohesion. `block_offset` is the correct, native Kajabi solution. Use it.

### 9.4 Pro columns (2 or 3 per section)

Section-level: `columns: 2` or `columns: 3`. Per-section — every section can have its own config. Per-column width via 12-col grid (e.g. 6/6, 9/3, 4/4/4) — must sum to 12. Per-block `column: 1 | 2 | 3` assignment (defaults to 1). **Block width inside a column** uses the block's own `width: "12"` to fill (block width is RELATIVE to the column, not the page). Multiple blocks in the same column stack vertically in array order. `column_gap` in px. Sliders work INSIDE a column. Mobile collapses 1 → 2 → 3 automatically.

#### 9.4a Vertical block stacking inside a column (THE Pro columns superpower)

The biggest reason to reach for Pro columns over the standard 12-col grid is **vertical stacking of multiple block types inside a single column**. The standard grid only places blocks side-by-side in one row; Pro columns let you stack heterogeneous blocks (text → stats → CTA → image → accordion → whatever) within a column, while still controlling each one independently.

**How it works:** every block in a section carries an optional `column: 1 | 2 | 3`. The serializer + preview group blocks by that value and render each group as its own vertical stack inside the corresponding column. Order within a column = order in the `blocks` array. There is no nesting — you do NOT wrap blocks in a "column container" block; you just tag each block with which column it belongs to.

**Canonical pattern — image left, stacked content right (intro + stats + CTA):**

```jsonc
{
  "kind": "content",
  "name": "Built for online business",
  "props": {
    "columns": 2,
    "columnWidths": [6, 6],
    "columnGap": 48,
    "vertical": "center"
  },
  "blocks": [
    // Column 1 — single image, fills its column
    { "type": "image", "props": { "column": 1, "colWidth": "12", "src": "https://...", "alt": "..." } },

    // Column 2 — three blocks stacked vertically
    { "type": "text", "props": { "column": 2, "width": "12", "align": "left",
        "text": "<p style='...eyebrow...'>Why Kajabi</p><h2>Built for the experts...</h2><p>...body copy...</p>" } },

    { "type": "text", "props": { "column": 2, "width": "12", "align": "left",
        "text": "<div style='border-top:1px solid #D8C9B0;padding-top:28px;margin-top:36px;display:flex;gap:40px;'>...stats...</div>" } },

    { "type": "cta", "props": { "column": 2, "width": "12", "align": "left",
        "buttonText": "Start Your Project", "buttonUrl": "/contact",
        "buttonStyle": "solid", "buttonBackgroundColor": "#2A211B", "buttonTextColor": "#FBF8F2", "buttonBorderRadius": "2",
        "padding": { "top": "32", "right": "0", "bottom": "0", "left": "0" } } }
  ]
}
```

**Authoring rules for stacked columns:**

1. **Use it instead of cramming everything into one giant text block.** If you find yourself writing one `text` block whose HTML contains a heading + body + a stats grid + a styled `<a>` button, split it into 2–4 blocks tagged to the same `column`. Stats become their own `text` block; the CTA becomes a real `cta` block (so it inherits the brand button system per §4.7 and §9.8a).
2. **`width: "12"` on every block in the same column.** Block width is RELATIVE to the column, not the page. `width: "6"` inside a column makes the block half-fill that column (rarely what you want when stacking).
3. **Vertical spacing between stacked blocks** comes from each block's own chrome `padding` (object form per §4.7's padding rule — `{ top, right, bottom, left }`, never scalar) or inline `margin-top` in the block's HTML. There is no built-in "row gap" between stacked blocks.
4. **Mix block types freely.** A column can hold `text + cta + image + accordion + feature` stacked in order. The grouping is purely by the `column` prop — type doesn't matter.
5. **Empty columns are valid.** A 3-column section can leave column 2 empty and put blocks only in 1 and 3 — Kajabi renders the empty column as whitespace. Useful for asymmetric reading layouts.
6. **Match the CTA to the rest of the site (§4.7).** When you split a baked-in `<a>` button out of HTML into a real `cta` block, audit existing CTAs and copy their `buttonBackgroundColor` / `buttonTextColor` / `buttonStyle` / `buttonBorderRadius` exactly. Don't introduce a new variant.
7. **Vertical alignment** is set on the SECTION (`vertical: "top" | "center" | "bottom"`) and applies to how the columns align relative to each other — not how stacked blocks align inside a column. Inside a column, blocks just flow top-to-bottom.

**When to reach for stacked columns vs other patterns:**

| Layout intent | Use this |
|---|---|
| Image left, headline+body+stats+CTA right (canonical hero/about split) | Pro columns 6/6, stack text+text+cta in column 2 |
| Three feature cards in a row, each with icon+title+body+button | Standard 12-col grid with `feature` blocks (no Pro needed) |
| Sidebar filter + product grid | Pro columns 3/9, search/filter blocks in column 1, products in column 2 |
| Hero with badge above headline above two CTAs | Single column, stack badge+text+cta+cta blocks |
| Pricing table with three tiers, each tier has heading+price+bullet list+CTA | Pro columns 4/4/4, stack text+text+text+cta in EACH column |

**Anti-pattern — DON'T do this:**

```jsonc
// ❌ One massive text block doing everything inline.
// Lose: brand CTA system, semantic structure, ability to A/B copy independently,
// Kajabi's per-block editor controls.
{ "type": "text", "props": { "column": 2, "text":
  "<h2>...</h2><p>...</p><div class='stats'>...</div><a class='button' href='/contact'>Start</a>" } }

// ✅ Three blocks in column 2 — text + text + cta.
```

**Pre-flight check when restructuring a section into Pro columns:** before saving, walk every block in the section and confirm (a) every block has an explicit `column` value (1, 2, or 3), (b) every block has `width: "12"` unless you specifically want fractional fill inside the column, (c) every `cta` block matches the site's brand button styling, (d) any inline `<a class="button">` previously baked into HTML has been extracted into a real `cta` block.

### 9.5 Pro tabs (sections-as-tabs)

> Verified against `streamlined-home-pro/snippets/block_code_tabs.liquid` + `sections/section.liquid` (tab pane wrapping). Engine support landed in `@k-studio-pro/engine@0.1.3`.

Pro tabs are **two cooperating pieces**: a `code_tabs` block that renders the tab strip, plus sibling `ContentSection`s flagged as tab panes. The tab block doesn't *contain* the panes — Kajabi (and our preview shim) match them up by slug.

#### Authoring shape (React / engine props)

```tsx
import { ContentSection, Tabs, PricingCard } from '@k-studio-pro/engine';

// 1. The tab strip — its own ContentSection ABOVE the panes.
<ContentSection name="Pricing tabs">
  <Tabs
    style="pills"           // "pills" (default) or "tabs"
    align="center"          // "left" | "center" | "right"
    accentColor="#1F2A44"   // active pill / underline color (preview + Kajabi via custom CSS)
    textColor="#475569"     // inactive tab label color
    tabs={[
      { name: 'Monthly', slug: 'monthly' },
      { name: 'Yearly',  slug: 'yearly'  },
    ]}
  />
</ContentSection>

// 2. One ContentSection per pane — siblings, NOT children of the tabs section.
<ContentSection name="Monthly pricing" useAsTab tabSlug="monthly" defaultTab>
  <PricingCard ... />
  <PricingCard ... />
  <PricingCard ... />
</ContentSection>

<ContentSection name="Yearly pricing" useAsTab tabSlug="yearly">
  <PricingCard ... />
  <PricingCard ... />
  <PricingCard ... />
</ContentSection>
```

In raw `design` JSON the same thing looks like:

```jsonc
{
  "kind": "content", "name": "Pricing tabs",
  "blocks": [{
    "type": "code_tabs",
    "props": {
      "style": "pills", "align": "center", "width": "12",
      "accentColor": "#1F2A44", "textColor": "#475569",
      "tabs": [
        { "name": "Monthly", "slug": "monthly" },
        { "name": "Yearly",  "slug": "yearly"  }
      ]
    }
  }]
},
{ "kind": "content", "name": "Monthly pricing",
  "props": { "useAsTab": true, "tabSlug": "monthly", "defaultTab": true },
  "blocks": [/* PricingCards */] },
{ "kind": "content", "name": "Yearly pricing",
  "props": { "useAsTab": true, "tabSlug": "yearly" },
  "blocks": [/* PricingCards */] }
```

#### Field mapping (engine prop → Kajabi `settings_data.json` field)

**On the `code_tabs` block:**

| React prop | Kajabi field | Values | Notes |
|---|---|---|---|
| `style` | `tabs_style` | `"pills"` \| `"tabs"` | default `"pills"` |
| `align` | `tabs_align` | `"left"` \| `"center"` \| `"right"` | default `"center"` |
| `tabs[N].name` | `first_tab_name` … `fifth_tab_name` | string | Up to 5 tabs |
| `tabs[N].slug` | `first_tab_slug` … `fifth_tab_slug` | lowercase string | MUST match a pane's `tab_slug` |
| `width` | `width` | `"1"`–`"12"` | default `"12"` |

> The Kajabi snippet uses **flat `first_*` / `second_*` / … / `fifth_*` fields**, NOT an array. The engine's serializer flattens `tabs[]` for you — just write the array.

**On each pane `ContentSection` (Pro section-level fields):**

| React prop | Kajabi field | Values |
|---|---|---|
| `useAsTab` | `use_as_tab` | `"true"` |
| `tabSlug` | `tab_slug` | lowercase string, unique among panes |
| `defaultTab` | `default_tab` | `"true"` on EXACTLY ONE pane |

#### Mandatory rules

1. **Exactly one pane** must set `defaultTab: true` — otherwise nothing shows on first load.
2. **Slugs are lowercase and must match exactly** between the `code_tabs` block and the pane sections. Typos silently hide panes (the section renders but with `display: none` and no tab button targets it).
3. **The tabs block lives in its own section ABOVE the panes.** Don't mix tab content into the same section as the strip.
4. **Up to 5 tabs.** The 6th `tabs[]` entry is silently dropped (Kajabi only has slots through `fifth_*`).
5. **Pane sections render normally** when not in tab mode — drop `useAsTab` and they become regular sections again.
6. **Pro-only.** On Standard sites the `code_tabs` block and `use_as_tab` field are silently dropped. Always check `resolveBaseTheme(site)` returns a `-pro` theme before composing tabs.
7. **CTA consistency still applies (§4.7).** When tabs hold `pricing_card` or `cta` blocks across panes, every CTA across every pane must share the same brand button styling. Audit before saving.

#### Runtime behavior

- **Kajabi runtime:** `block_code_tabs.liquid` emits real Bootstrap 5 markup (`nav-pills`, `data-bs-toggle="tab"`, `data-bs-target="#section-<id>-tab-pane"`). The Pro theme loads `bootstrap.bundle.min.js` so tab switching works without extra JS.
- **Editor preview:** the React `<Tabs>` component installs a click-delegator via `useEffect` that mimics Bootstrap's `tab` plugin (toggles `.show.active` + inline `display`) — Bootstrap isn't loaded in our preview iframe, but the DOM matches Kajabi's, so behavior is identical.
- **Pane wrapping:** when a section has `useAsTab: true`, the engine wraps its rendered output in `<div class="tab-content"><div class="tab-pane fade" id="section-<id>-tab-pane">…</div></div>` — same wrapper Kajabi's `section.liquid` produces. This is what lets the slider re-init logic (§9.3) find sliders inside tabs.

#### Worked example — Monthly / Yearly pricing toggle

This is the canonical use case (and the one this engine version was tested against on site `af814adc`):

```tsx
<ContentSection name="Plans" paddingDesktop={{ top: '120', bottom: '40' }}>
  <Text width="12" align="center"
    text="<p style='...eyebrow...'>Pricing</p><h2>Choose your plan</h2><p>...</p>" />
  <Tabs
    style="pills" align="center" width="12"
    accentColor="#1F2A44" textColor="#475569"
    tabs={[
      { name: 'Monthly',  slug: 'monthly' },
      { name: 'Yearly · save 20%', slug: 'yearly' },
    ]}
  />
</ContentSection>

<ContentSection name="Monthly tier grid" useAsTab tabSlug="monthly" defaultTab
  paddingDesktop={{ top: '0', bottom: '120' }}>
  <PricingCard width="4" title="Starter" price="$29" priceCadence="/ mo" .../>
  <PricingCard width="4" title="Pro"     price="$79" priceCadence="/ mo" .../>
  <PricingCard width="4" title="Studio"  price="$199" priceCadence="/ mo" .../>
</ContentSection>

<ContentSection name="Yearly tier grid" useAsTab tabSlug="yearly"
  paddingDesktop={{ top: '0', bottom: '120' }}>
  <PricingCard width="4" title="Starter" price="$279" priceCadence="/ yr" .../>
  <PricingCard width="4" title="Pro"     price="$759" priceCadence="/ yr" .../>
  <PricingCard width="4" title="Studio"  price="$1,910" priceCadence="/ yr" .../>
</ContentSection>
```

#### Pre-flight checklist

Before saving any page that uses tabs:
- [ ] Site `base_theme` is `streamlined-home-pro` or `encore-page-pro`.
- [ ] Tabs block's `tabs[].slug` values are all lowercase, unique, and ≤ 5 entries.
- [ ] Every slug in the tabs block has exactly one matching pane section with `tabSlug` set to the same value.
- [ ] Exactly one pane section has `defaultTab: true`.
- [ ] Pane sections are SIBLINGS of the tabs section in the page's `sections` array, not nested inside it.
- [ ] CTAs across all panes match the site's brand button styling (§4.7).

### 9.6 Search form + Search filter blocks

TWO Pro-only blocks that target sibling `feature` blocks in the SAME section (cannot reach other sections). Independent — keyword search and filters don't clear each other's data, but using one resets the other's UI state.

- **`block_search_form`** — keyword input, free-text match against features in the same section.
- **`block_search_filter`** — up to 5 filter groups (toggle each on/off). Per-filter: `filter_N_title` + comma-separated `filter_N_options`. Logic: within one group → OR; across groups → AND. Layouts: stacked checkboxes (default), `use_dropdown_filters: true`, `use_dropdowns_horizontally: true` (combine for horizontal dropdowns above the grid).

Canonical sidebar: Pro columns 3/9 with search+filter left, 3-up feature grid right. Set section `horizontal: left` so filtered cards collapse left.

### 9.6b Pro library / products section (custom filtering)

Pro upgrades the Kajabi `products` section with built-in filtering. **§4.10 still holds** — keep `library` as `{ kind: "raw", type: "products" }`. On Pro you can pass extra `settings`:

- **Static filter** (author-controlled): `static_filter_enabled: true`, `static_filter_mode: "include" | "exclude"`, `static_filter_keywords: "launch, business"` (CSV against product title keywords). Canonical: one section with `include` for "Featured", a second with `exclude` for "All products".
- **Dynamic filter** (visitor-controlled): `dynamic_filter_enabled: true`, `dynamic_filter_categories: "blogging, growth, launch"` (CSV; renders as dropdown). Static + dynamic compose.

Multiple `products` sections per library page is the supported pattern for category grouping. Still no hardcoded product cards.

### 9.7 26 pre-designed section presets

Layout starters (white-boxes, featured testimonial, team grid, gradient CTA, "as seen on" logos, splits, 3-feature grids, etc.). Inherit theme styles automatically. Optional — use as scaffolds, then customize.

### 9.8 Style guide / theme settings extras

#### 9.8a Pro button system (global + per-button overrides)

Pro replaces Kajabi's single-button styling with a **dark/light pair** model so the same site can ship buttons over both light and dark sections. Configure globally in **Page Settings → Style guide → Buttons**, override per-CTA. **Field IDs below are the literal Kajabi `settings_data.json` keys** — verified against `streamlined-home-pro/config/settings_schema.json`.

Global theme settings:
- `btn_background_color` (label "Button Color **Dark**") + `btn_text_color` (label "Button Color **Light**") — Pro repurposes these as the dark/light brand pair. **Counterintuitive:** `btn_text_color` does NOT mean text color — it's the LIGHT half of the pair. Authors pick ONE pair sitewide; each button picks which member via `btn_type`.
- `btn_type`: `"dark"` | `"light"` (default `"dark"`).
- `btn_style`: `"solid"` | `"outline"` | `"text"` (default `"solid"`). Pro adds `"text"` (no padding/border, just a styled link).
- `btn_size`, `btn_width`, `btn_border_radius` — same as Standard.
- **Advanced options gated behind `view_advanced_button_customizations: true`** (theme setting toggle). Until that's on, the fields below are hidden in the Kajabi UI but still emit/respect from JSON.
- `btn_override_shadow`: `"on"` | `"off"` (default `"on"`).
- `btn_inverse_on_hover`: `"normal"` | `"inverse"` (default `"normal"`) — `"inverse"` swaps fg/bg on hover (works on solid + outline; **no-op on `text`**).
- `btn_uppercase`: `"on"` | `"off"` (default `"off"`).
- `select_custom_btn_font`: `"inherit"` | `"primary"` | `"accent"` (default `"inherit"` = "Do Not Override").
- `btn_font_weight` — any of 9 weights (100–900) the loaded font supports.
- `custom_body_button_line-height`, `btn_letter-spacing` (note: **hyphens, not underscores**, in these keys).
- `custom_button_font_size_desktop` + `custom_button_font_size_mobile` (independent).
- `button_border_thickness` — px.
- `button_vertical_padding` + `button_horizontal_padding` (two separate fields, NOT a `padding` object).
- `custom_button_top_margin` + `custom_button_bottom_margin`.

Per-button overrides:
- Every global field above also exists as a per-block override on every `cta` block (and text blocks with inline buttons).
- **"Do Not Override" sentinel = the literal string `"inherit"` for EVERY override field** (verified in `snippets/block_cta.liquid` — every override field is checked with `{% if block.settings.X != 'inherit' %}`). Applies even to numerics (padding/margin/font-size) and colors. **Serializer rule:** to preserve global behavior, emit `"inherit"` — NOT `""`, NOT omit the key. Liquid's `default:` filter only triggers on `nil`; the override fields are explicitly compared to `'inherit'`, so empty string is treated as a real override and produces broken CSS like `font-size: ;`.

Style + hover behavior (verified in `snippets/block_cta.liquid`):
- `btn_style: "text"` **DOES respect the dark/light pair via `btn_type`** — there are dedicated `text + dark` and `text + light` branches. Text buttons use the pair color as the link color (no fallback to body text).
- `btn_inverse_on_hover: "inverse"` is implemented ONLY in the `solid` and `outline` branches — **no-op on `text`**.

Composition rule: still follow §4.7 — pick the dark/light pair ONCE per site, set globals, override only for genuine variant needs.

#### 9.8b Pro form input system (global + per-form overrides)

Mirrors the button system for opt-in / contact / search inputs. Configure globally in **Page Settings → Style guide → Form styles**. **Field IDs verified against `streamlined-home-pro/config/settings_schema.json`.**

Global theme settings:
- `form_input_color_dark` + `form_input_color_light` — input bg pair.
- `form_input_placeholder_color_dark` + `form_input_placeholder_color_light` — placeholder per pair member. (Plus the existing standard `color_placeholder` global.)
- `form_new_input_type`: `"dark"` | `"light"` (default `"light"`).
- `form_new_input_style`: `"solid"` | `"transparent"` (default `"solid"`) — `"transparent"` shows the section bg through (use on colored/dark sections for borderless fields).
- `form_input_border_radius` — px (Pro-only; Standard has no input rounding).
- **Advanced gated behind `use_pro_form_customizations: true`.**
- `form_input_border_thickness`.
- `form_input_font`: `"inherit"` | `"primary"` | `"accent"` (default `"inherit"`).
- `form_input_font_weight`, `form_input_line-height` (hyphen), `form_input_letter-spacing` (hyphen).
- `form_input_font_size_desktop` + `form_input_font_size_mobile`.
- `form_input_vertical_padding` + `form_input_horizontal_padding` (two separate fields).
- `form_input_top_margin` + `form_input_bottom_margin`.

Per-form overrides: every field above has a per-block override with the same `"inherit"` sentinel as buttons (literal string, every field, including numerics — never `""` or omitted).

#### 9.8c Custom font / size override system (any `<link>` tag — Google, Adobe, self-hosted)

> Verified against `streamlined-home-pro/config/settings_schema.json` ("Style Guide" tab) + `snippets/font_override_styles.liquid`. Master keeps the deep field reference at `mem://reference/pro-custom-fonts.md`; thin clients should treat this section as the canonical source.

**Why this exists.** Kajabi's default font picker is restricted to a small Google Fonts set, and its font-size selects skip values (e.g. 32px and 36px exist, 34px does not). Pro **keeps every default Kajabi font field intact** and layers a fully optional override system on top — leave overrides off → Kajabi defaults win exactly as on Standard. Touch one field → it wins for that scope. Don't reach for the override system unless the expert asks for a font Kajabi doesn't ship or a size Kajabi's picker can't produce.

**Cascade (lowest → highest priority):**
1. Kajabi defaults (`font_family_body`, `font_family_heading`, `font_size_h*_desktop`, etc.) — same fields as Standard.
2. Body overrides (`override_body_fonts: true`) and bold body overrides (`override_bold_body_fonts: true`) → apply to `body, p` / `body strong, p strong`.
3. **All headings** override (`override_heading_font_styles: true`) → applies to every `h1–h6` (and their `strong` variants).
4. **Per-element** override (e.g. `override_h3_font_styles: true`) — beats All headings for that element.
5. **Bold-per-element** override (e.g. `override_h3_bold_font_styles: true`) — beats per-element for the `strong` variant.
6. **Block-level** overrides on `cta` / form blocks — beat all template-level button/form settings.

**Standard Style Guide defaults must be honored as fallbacks (preview parity).** When the expert leaves Standard fields like `font_weight_heading`, `line_height_heading`, `font_size_h1_desktop`, `font_size_h1_mobile` (and h2–h6), `font_weight_body`, `line_height_body` empty, Kajabi falls back to **base-theme defaults** (headings 700, h1 48px desktop / 36px mobile, etc.) — NOT to browser UA defaults. The preview engine (`packages/engine/src/siteDesign/resolvePreviewFonts.ts → buildStandardThemeRules`) MUST therefore read each Standard field via `valWithDefault(ts, key)` which falls through to `TEMPLATE_SETTINGS_BY_ID[key].default` from `templateSettingsCatalog.ts`, and emit a CSS rule whenever the resolved value is non-empty. Without this, preview headings collapse to UA `h1 ≈ 32px` while the exported Kajabi site renders 48px — the expert reports "the headings look fine in Kajabi but tiny in the preview" (or vice-versa after they strip an inline `font-size`). Heading weight rules MUST also target `:is(h1..h6) strong` so inline `<strong>` inherits the heading weight instead of body weight. Per-heading desktop+mobile sizes go inside `@media (min-width: 768px)` / `@media (max-width: 767px)` blocks. This is preview-only plumbing; export is unaffected because Kajabi's runtime CSS already handles the fallbacks server-side.

**Visibility toggles (`hide_if`) — flip them when you emit overrides.** Most override fields have `hide_if: { <toggle_id>: false }`. The toggle controls **whether the field is visible in the Kajabi page builder**, not whether it's emitted. **Whenever you emit any field under a toggle, you MUST also flip the toggle to `true`** — otherwise the expert opens Kajabi and can't see/edit the values you wrote.

| Toggle ID (default `false`) | Unlocks |
|---|---|
| `view_advanced_button_customizations` | All advanced `btn_*` fields (button shadow/hover/uppercase/font/weight/lh/ls/size/border/padding/margin) |
| `use_custom_fonts` | `font_stylesheet_links` (paste `<link>` tags here) |
| `use_primary_custom_font` | `primary_custom_font_name`, `primary_custom_font_fallback` |
| `use_accent_custom_font` | `accent_custom_font_name`, `accent_custom_font_fallback` |
| `override_body_fonts` / `override_bold_body_fonts` | Body / bold body font + size/weight/lh/ls/margin |
| `override_heading_font_styles` | All-headings font + weight/lh/ls/bottom-margin (NO size — size goes per-element) |
| `override_h1_font_styles` … `override_h6_font_styles` | Per-element font + weight/lh/ls/size_desktop/size_mobile/bottom_margin |
| `override_h1_bold_font_styles` … `override_h6_bold_font_styles` | Per-element bold variant (same fields) |
| `use_pro_form_customizations` | All `form_input_*` fields (see §9.8b) |
| `use_font_css` | `font_css` raw CSS textarea |

**Wiring a custom font (Google / Adobe / self-hosted).** Two slots only — primary + accent. Pick them ONCE per site, then assign per-element.

1. `use_custom_fonts: true`
2. `font_stylesheet_links` ← paste the full `<link rel="stylesheet" href="...">` tag(s). Multi-line allowed (textarea). For Google Fonts: open the embed dialog → "Web" → "Link" → copy the `<link>` lines verbatim.
3. `use_primary_custom_font: true` (and/or `use_accent_custom_font: true`)
4. `primary_custom_font_name` ← the exact `font-family` name from the loaded stylesheet (e.g. `Roboto`, `Playfair Display`). **No quotes** — Liquid wraps it itself: `font-family: "{{ name }}", {{ fallback }};`
5. `primary_custom_font_fallback` ← generic family (`sans-serif`, `serif`, `monospace`, etc.). Goes in unquoted.

Then assign via any `select_custom_*_font` field: `"primary"` → primary slot, `"accent"` → accent slot, `"inherit"` → no custom font on this element.

**`"inherit"` semantics — verified from Liquid.** Every numeric/select override is checked against the literal string `"inherit"`:
```liquid
{% if settings.custom_h3_font_weight != 'inherit' %}font-weight: {{ settings.custom_h3_font_weight }};{% endif %}
```
**Empty string is NOT inherit** — it produces broken CSS like `font-weight: ;`. Serializer rule: emit `"inherit"`, never `""`, never omit the key. Same rule applies to button + form override fields.

For `select_custom_*_font` specifically: only `"primary"` / `"accent"` emit a `font-family` rule. `"inherit"` emits nothing → the element falls back to **Kajabi's normal heading/body font cascade**, NOT to the other slot. This is correct — it lets a site mix custom slots with Kajabi defaults (e.g. H1 = primary custom, H2/H3 = Kajabi default, body = accent custom).

**Per-element field shape (h1, identical for h2–h6 with the number swapped).** Note **hyphens, not underscores** in `*_line-height` and `*_letter-spacing` — they will silently fail if you serialize as snake_case.

| Field ID | Default |
|---|---|
| `override_h1_font_styles` | `false` |
| `select_custom_h1_font` | `inherit` |
| `custom_h1_font_weight` | `inherit` |
| `custom_h1_line-height` | `inherit` |
| `custom_h1_letter-spacing` | `inherit` |
| `custom_h1_font_size_desktop` | `inherit` |
| `custom_h1_font_size_mobile` | `inherit` |
| `custom_h1_bottom_margin` | `inherit` |

Bold variant: `override_h1_bold_font_styles` toggle, then `select_custom_bold_h1_font` + `custom_bold_h1_*` (same suffixes). All-headings override has the same shape minus the size fields.

**Body / bold body override fields:** same shape on `body, p` and `body strong, p strong, body b, p b`. Toggles `override_body_fonts` / `override_bold_body_fonts`. Field IDs: `select_custom_body_font`, `custom_body_font_weight`, `custom_body_font_line-height`, `custom_body_font_letter-spacing`, `custom_body_font_size_desktop`, `custom_body_font_size_mobile`, `custom_p_bottom_margin` (and the `_bold_` variants).

**Advanced button fields (gated by `view_advanced_button_customizations: true`).** Verified IDs from rows 22–35: `btn_override_shadow`, `btn_inverse_on_hover`, `btn_uppercase`, `select_custom_btn_font`, `btn_font_weight`, `custom_body_button_line-height` (hyphen!), `btn_letter-spacing` (hyphen!), `custom_button_font_size_desktop`, `custom_button_font_size_mobile`, `button_border_thickness`, `button_vertical_padding`, `button_horizontal_padding`, `custom_button_top_margin`, `custom_button_bottom_margin`. See §9.8a for the dark/light pair model that wraps these.

**Block-level overrides.** Every `cta` block carries its own copy of the advanced button fields, and form blocks carry their own copy of the form input fields. Per-block values **override the template-level settings** for that one block. Same `"inherit"` sentinel rule (literal string, every field, never `""`, never omit).

**Authoring rules (mandatory):**
1. **Default to Kajabi defaults.** Don't touch the override system unless the expert asked for a font Kajabi doesn't ship, or a specific size its picker can't produce (e.g. 34px).
2. **Whenever you emit any override field, also flip its visibility toggle to `true`.** Otherwise the expert can't see/edit it in Kajabi.
3. **Use `"inherit"` (literal string)** for every numeric/select override you don't want to change. Never `""`, never omit.
4. **Custom font name fields take the family name unquoted.** Liquid wraps it.
5. **Mind the hyphen-in-ID fields** (`*_line-height`, `*_letter-spacing`, `custom_body_button_line-height`) — they break if serialized as snake_case.
6. **One pair per site.** Pick primary + accent ONCE, then assign per-element. There are only two slots — don't try to use them as a per-heading font picker.

#### 9.8d Pro-only `custom_css_class` on every section

- Field key: **`custom_css_class`** (text input, default `""`) — added by Pro to `sections/section.liquid`. Standard themes do NOT have it.
- Liquid: `{% if section.settings.custom_css_class != blank %}{{ section.settings.custom_css_class }}{% endif %}` — rendered into the section's outer class list. Value is space-separated CSS class names (e.g. `"mm-dark-hero dark-hero-form"`), NOT a single class.
- Combined with the theme-wide `customCss` slot (`TemplateDef.customCss`), this is the **canonical way to target a single section** with bespoke CSS without touching base theme files. Workflow: assign `custom_css_class: "hero-gradient-cta"` on the section → write `.hero-gradient-cta { ... }` in `themeSettings.customCss`.
- Use cases: per-section gradients, scoped typography, hiding a single CTA on mobile, custom hover, animation triggers.
- **Pro-only — silently dropped on Standard sites.**

#### 9.8e Authoring workflow — prefer template controls over inline CSS

> This is the canonical "how to actually style a Pro site" workflow, distilled from real cleanup passes. **Read this before adding any inline `style="..."` for typography or buttons.** The single biggest mistake on Pro sites is duplicating typography/button rules as inline CSS in block HTML — it bypasses the template's global controls, fights the cascade, can't be edited from the Kajabi page builder, and silently breaks when the expert tweaks the style guide.

##### The hierarchy (use the highest level that solves the problem)

1. **Template `themeSettings`** (`TemplateDef.themeSettings`) — sitewide defaults via the §9.8a/b/c override system. **Always start here for fonts, headings, buttons, forms.**
2. **Block-level overrides** on `cta` / form blocks — only when ONE block legitimately needs a variant (e.g. a secondary outline next to a primary solid in the same section).
3. **`custom_css_class` + `themeSettings.customCss`** (§9.8d) — for genuinely bespoke per-section visual flourishes that the override system can't express (gradients, custom animations, layered backgrounds).
4. **Inline `style=""` in block HTML** — last resort. Only for content-specific inline decoration (a single `<span>` accent color in a headline, an inline divider) where lifting it to the template would pollute the global cascade.

##### Mandatory pre-flight before saving any styling change

When the expert asks "make the buttons match" / "fix the typography" / "the heading line-height feels off" / "tighten the form fields" — do this checklist:

1. **Audit existing inline CSS first.** `get-site-design` → walk every block → grep block HTML for `style="font-`, `style="line-height`, `style="letter-spacing`, `style="text-transform`, `padding:`, `font-size:`, `font-family:`. **Every match is a candidate for deletion** in favor of a `themeSettings` override.
2. **Lift recurring inline rules into `themeSettings`.** If you see the same `font-family: 'Playfair Display'` in 6 headings, that belongs in `themeSettings` (`use_custom_fonts: "true"`, `use_primary_custom_font: "true"`, `primary_custom_font_name: "Playfair Display"`, `select_custom_h1_font: "primary"` etc.) — not repeated inline.
3. **Lift recurring inline button styles into `themeSettings`.** If every CTA carries inline `padding: 16px 32px; text-transform: uppercase; letter-spacing: 2px`, that's the global button system speaking — set `view_advanced_button_customizations: "true"`, `btn_uppercase: "on"`, `btn_letter-spacing: "2px"`, `button_vertical_padding: "16px"`, `button_horizontal_padding: "32px"`. Then **delete the inline declarations**.
4. **Match the dark/light pair model (§9.8a).** Pick the brand pair ONCE (`btn_background_color` = dark member, `btn_text_color` = light member). Per-CTA, set `btn_type: "dark"` or `"light"` to choose which one renders. Don't set per-block `buttonBackgroundColor` / `buttonTextColor` unless the block genuinely uses an off-brand color.
5. **Use the value-formats memory.** Every `custom_*` / `btn_*` / `form_input_*` field is enum-validated. See `mem://reference/pro-custom-fonts-value-formats.md` (master) — bare numbers (`"42"`), `em` values (`"-0.02em"`), and gap values (`"13px"`, `"15px"`) are silently rejected. Always emit `"Npx"` strings on the documented px grid, unitless decimals on the 0.1 line-height grid, the 5px-grid for margins, and `"primary"`/`"accent"`/`"inherit"` (literal strings) for font slot pickers.
6. **Whenever you set any override field, flip its `hide_if` toggle to `"true"`** (§9.8c table) — otherwise the field is invisible in Kajabi's editor and the expert can't tweak it.
7. **Use `"inherit"` (literal string) for every override you DON'T want to change.** Never `""`, never omit. Empty string produces `font-weight: ;` — broken CSS that breaks the rendered page.
8. **Mind the hyphen-in-ID fields:** `custom_h*_line-height`, `custom_h*_letter-spacing`, `custom_body_font_line-height`, `custom_body_font_letter-spacing`, `custom_body_button_line-height`, `btn_letter-spacing`, `form_input_line-height`, `form_input_letter-spacing`. Snake_case versions (`custom_h1_line_height`) are silently dropped.
9. **Verify the preview matches.** The editor preview honors `themeSettings` overrides (see `mem://feature/preview-respects-pro-custom-fonts.md`). After changes, a refresh should show the new typography/buttons in the preview — if not, you likely emitted an invalid value or forgot the visibility toggle.

##### Anti-patterns (delete these on sight)

❌ **Inline font-family on every heading** instead of `select_custom_h*_font: "primary"`.
❌ **Inline `padding`, `text-transform`, `letter-spacing` on every `<a class="button">`** instead of the global `btn_*` system.
❌ **Inline `line-height: 1.05`** on h1s instead of `custom_h1_line-height: "1.0"` (snapped to the 0.1 grid).
❌ **Per-CTA `buttonBackgroundColor` set to the same brand value on every CTA** instead of one global `btn_background_color` + per-CTA `btn_type: "dark"`.
❌ **Setting numeric overrides as bare numbers** (`custom_h1_font_size_desktop: "42"`) — must be `"42px"`.
❌ **Setting overrides as `em`** (`btn_letter-spacing: "0.18em"`) — must be `"Npx"` clamped to `[-2px, 2px]`.
❌ **Setting overrides to `""`** (empty string) thinking it means "use default" — Kajabi treats it as a real override and emits broken CSS. Use `"inherit"`.
❌ **Emitting an override without flipping its `hide_if` toggle** — the value applies but the expert can't see/edit the field in Kajabi.
❌ **Using `select_custom_h1_font: "inherit"` and expecting it to route to the accent slot** — `"inherit"` means "no custom font, fall back to Kajabi's default heading font". Use `"accent"` to route to the accent slot.

##### Worked example — Bennett Studio cleanup pattern

Symptom: every heading carried inline `style="font-family: 'Playfair Display', serif; line-height: 1.05; letter-spacing: -0.02em;"` and every button carried inline `style="padding: 16px 32px; text-transform: uppercase; letter-spacing: 0.18em; font-size: 13px;"`. Sitewide style guide changes had no effect.

Fix:
1. **Set `themeSettings` once:**
   ```jsonc
   {
     "use_custom_fonts": "true",
     "font_stylesheet_links": "<link href=\"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap\" rel=\"stylesheet\">",
     "use_primary_custom_font": "true",
     "primary_custom_font_name": "Playfair Display",
     "primary_custom_font_fallback": "serif",
     "override_h1_font_styles": "true",
     "select_custom_h1_font": "primary",
     "custom_h1_line-height": "1.0",
     "custom_h1_letter-spacing": "-1.1px",
     "custom_h1_font_size_desktop": "56px",
     "custom_h1_font_size_mobile": "36px",
     "view_advanced_button_customizations": "true",
     "btn_uppercase": "on",
     "btn_letter-spacing": "2px",
     "custom_button_font_size_desktop": "14px",
     "custom_button_font_size_mobile": "12px",
     "button_vertical_padding": "16px",
     "button_horizontal_padding": "32px",
     "btn_background_color": "#2A211B",
     "btn_text_color": "#FBF8F2"
   }
   ```
2. **Delete every inline `style=` from heading and button HTML.** Headlines become plain `<h1>...</h1>`. Inline `<a class="button">` either stays as a styled `<a>` (if it must live inside HTML) or — preferred — gets lifted into a real `cta` block which inherits all global button styling for free.
3. **Refresh preview.** All headings and buttons render with the new template-level settings. Expert can now tweak any of these in the Kajabi style guide and the change propagates everywhere.

The key insight: **inline CSS is the symptom of a missed template-level control.** Almost every typography/button rule belongs in `themeSettings`. Reach for inline styles only for true one-off content decoration.

### 9.9 Pro-only block snippets

All Pro-only blocks below are now wired into the React block library and engine — exporters, preview renderer, field schema, and `ALLOWED_BLOCKS_PER_SECTION` set all recognize them. Use them only on Pro sites (`base_theme: streamlined-home-pro` | `encore-page-pro`); they're silently dropped on Standard.

| Snippet | React component | `kajabiType` | Use for |
|---|---|---|---|
| `block_feature_icon` | `<FeatureIcon>` | `feature_icon` | Icon-led feature cards. Inline SVG via `iconCode`, recolored via `iconColor`, sized via `iconSize`. Includes native button (`showButton`+`buttonText`+...). |
| `block_image_icon` | `<ImageIcon>` | `image_icon` | Standalone decorative SVG (hero sticker, divider). Independent `iconWidth` + `iconHeight`. |
| `block_code_tabs` | `<Tabs>` | `code_tabs` | Tab strip — see §9.5. Up to 5 tabs; pair with sibling `useAsTab` panes. |
| `block_search_filter` | `<SearchFilter>` | `search_filter` | Faceted filter — see §9.6. Targets sibling `feature` blocks in same section. |
| `block_search_form` | `<SearchForm>` | `search_form` | Standalone keyword search input (also see §9.6). |
| `block_test` | — | — | Internal Kajabi placeholder, **do not wire**. |

**SVG icon blocks (`feature_icon`, `image_icon`):** the `iconCode` prop takes raw inline SVG markup (e.g. `<svg viewBox="0 0 24 24"><path d="..."/></svg>`). Kajabi's runtime CSS forces `fill` and `width`/`height` on the rendered `<svg>` via `!important`, so the SVG should NOT bake in its own width/height/fill — just supply the path. Our preview mirrors that behavior with a scoped `<style>` block. Source any SVG icon set (Lucide, Heroicons, Feather, custom) — paste the raw `<svg>...</svg>` into `iconCode`.


### 9.10 Pro-only section snippets (column sliders)

Layout switches set via section settings (not new block types):
- `column_one_slider.liquid`, `column_two_slider.liquid`, `column_three_slider.liquid`

### 9.11 Pro-only sections

- `sections/footer_pro.liquid` — see §9.2.
- `sections/cta_popup.liquid`, `sections/exit_pop.liquid`, `sections/two_step.liquid` — sitewide overlays enabled via theme settings, not per-page blocks.

### 9.12 Pro-only section-level fields

`sections/section.liquid` in Pro adds ~50 new fields:
- **Animation**: `animation_type`, `animation_duration`, `animation_delay`, `animation_offset`.
- **Slider** (§9.3): `enable_slider`, `slider_autoplay`, `slider_speed`, `slider_dots`, `slider_arrows`, `slider_infinite`, `slides_to_show_*`, `block_offset_before`, `block_offset_after`, plus arrow/dot positioning.
- **Columns** (§9.4): `columns`, `column_widths`, `column_gap`, per-block `column`.
- **Tabs** (§9.5): `use_as_tab`, `tab_slug`, `default_tab`.
- **Advanced borders**: per-side `border_top_*`, `border_right_*`, `border_bottom_*`, `border_left_*`.
- **Per-breakpoint columns**: `columns_desktop`, `columns_tablet`, `columns_mobile`.
- **Background video**: `bg_video_loop`, `bg_video_muted`, `bg_video_autoplay`, `bg_video_overlay_color`, `bg_video_overlay_opacity`.
- **Spacing precision**: per-breakpoint padding/margin.

To add support: extend `kajabiFieldSchema.ts` SECTION schema (mark new fields `proOnly: true`), extend `Section`/`ContentSection` React props, gate in `serialize.ts` so they only emit when the export target is a `-pro` theme.

### 9.13 Adding new Pro blocks (procedure)

All Pro snippets currently shipped by Kajabi are wired (see §9.9). If Kajabi adds a new Pro-only snippet:

1. Create `packages/engine/src/blocks/components/<BlockName>.tsx` matching the Liquid output.
2. Export it from `packages/engine/src/blocks/index.ts`.
3. Register it in the `BLOCK_COMPONENTS` map in `packages/engine/src/siteDesign/render.tsx`.
4. Add a field schema entry in `packages/engine/src/engines/kajabiFieldSchema.ts` (`BLOCK_FIELD_SCHEMAS` map).
5. Add the `kajabiType` string to the appropriate `ALLOWED_BLOCKS_PER_SECTION` set.
6. Bump `packages/engine/package.json` version → thin clients pick it up via `bun update @k-studio-pro/engine`.

