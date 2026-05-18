---
name: Pro slider field IDs and gotchas
description: Verified Kajabi field IDs, defaults, and hidden settings for the Pro slider — read before editing serialize.ts, sections.tsx, or composing slider sections
type: reference
---

Verified against `streamlined-home-pro/sections/section.liquid` + `snippets/column_one_slider.liquid`. The full Pro slider reference lives in `mem://reference/pro-template-capabilities.md` §3 and `AGENTS.md` §9.3 — keep all three in sync.

## Field-ID gotchas (most-confused)

- **`block_offset`** (NOT `block_offset_before`) — leading blocks kept outside the slider.
- **`block_end_offset`** (NOT `block_offset_after`) — trailing blocks kept outside the slider.
- **`blocks_per_slide`** — desktop only, range 1–12, default 3. **Mobile is hardcoded to 1 in Liquid** (`{% assign blocks_per_slide_mobile = 1 %}`); there is NO mobile setting. Don't expose `slidesPerViewMobile` to authors.
- **`slider_preset`** default is `"modern"` (NOT `"default"`). Options: `"default"` (Classic) and `"modern"`. This is the ONLY field controlling dot/arrow alignment — no separate align/position fields exist. **CRITICAL: ALWAYS emit `slider_preset` in `settings_data.json`.** The Pro section.liquid composes its outer class as `slider-preset-{{ section.settings.slider_preset }}` — when the field is missing, the class becomes `slider-preset-` (empty), and NEITHER preset's CSS targets the arrows/dots. Result: arrows render in the DOM but with no positioning rules, so they're invisible (or clipped by `hide_overflow: true`). The schema's `default: "modern"` only applies when Kajabi creates a fresh section in its UI, not when we omit the key on export. The serializer in `src/blocks/serialize.ts` defaults to `"modern"` whenever `enable_slider` is on — never gate it on `if (layout.sliderPreset)`.
- **`transition_effect`** schema only lists `slide` + `coverflow`, but the runtime JS whitelists `slide / fade / cube / coverflow / flip`. Serialize all 5 — Kajabi accepts them.

## Hidden settings (referenced in CSS, no UI exposes them)

These rely on Liquid `| default:` fallback. We serialize the spaceBetween pair so authors can override; the others use Pro's defaults.

- `space_between_slide_blocks` — default `0`, desktop slide gap. We expose `spaceBetweenDesktop`.
- `space_between_slide_blocks_mobile` — default `0`, mobile slide gap. We expose `spaceBetweenMobile`.
- `arrow_size` — default `32px`. Not exposed.
- `dot_size` — default `10px`. Not exposed.
- `dot_margin_top` — default `20px`. Not exposed.

## Arrow markup is fixed (NOT customizable per-section)

Pro renders chevrons as inline SVG polylines inside `<span class="slider-arrow-icon">` — NOT Swiper's native font glyphs. The native `::after` content is explicitly suppressed with `content: none !important;`. There is NO "custom SVG arrows" field — earlier walkthrough notes about pasting icon SVG were wrong.

Exact paths (24×24 viewBox, stroke-width 2.25, stroke-linecap/join round):
- Prev: `<polyline points="15 18 9 12 15 6"/>`
- Next: `<polyline points="9 18 15 12 9 6"/>`

The preview in `src/blocks/sections.tsx` mirrors this markup exactly so the editor matches the export.

## Color defaults

- `arrow_color` and `dot_color` both default to `#333333` in Liquid. Don't set random per-section colors — pull from `themeSettings.color_button` / `color_primary` so all sliders on a site match.

## Slider inside Pro columns

When a section has `columns: 2` or `columns: 3`, the extra `slider_column` setting (`first` / `second` / `third`, default `first`) picks which column hosts the slider. Only that column's blocks become slides.

## Known runtime bug — `transition_effect: "fade"`

Pro's runtime Swiper init forgets to set `fadeEffect.crossFade`, causing flicker. Our exporter auto-injects a CSS workaround when any section uses `fade`. See `mem://reference/kajabi-fade-slider-bug.md`.
