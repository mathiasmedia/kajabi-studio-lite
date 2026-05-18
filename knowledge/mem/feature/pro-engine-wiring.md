---
name: Pro engine wiring
description: serializeTree accepts { baseTheme } and emits Pro-only section fields (custom_css_class, enable_slider + slider opts, FTH collapsed) only on -pro themes
type: feature
---
`serializeTree(tree, { baseTheme })` is the new signature. `exportFromTree` threads `opts.baseTheme` into it. Module-level `activeBaseTheme` + `isProTheme()` gate emission so Standard sites silently drop Pro keys.

Supported Pro section props (all flavors):
- `customCssClass` → `custom_css_class` (also applied as React `className` in preview).

Content sections (Pro):
- `enableSlider` → `enable_slider`
- `slidesPerViewDesktop`/`slidesPerViewMobile` → `slides_per_view_{desktop,mobile}`
- `sliderAutoplay` / `sliderAutoplayDelay` → `slider_autoplay` / `slider_autoplay_delay`
- `sliderSpeed` / `sliderLoop` / `sliderTransition` → `slider_speed` / `slider_loop` / `slider_transition`
- `blockOffsetBefore` / `blockOffsetAfter` → `block_offset` / `block_end_offset` (verified against `streamlined-home-pro/sections/section.liquid` — Kajabi labels them "Start Slider After This Many Blocks" / "End Offset (blocks after slider)" but the field IDs are short)
- `showArrows` (boolean) → `show_arrows` (Pro default true; emit explicit `'false'` to hide)
- `arrowColor` → `arrow_color`
- `arrowSliderMargin` (px) → `arrow_slider_margin` (pushes arrows further from slider edge)
- `showDots` (boolean) → `show_dots` (NOT `show_pagination_dots` — that's the editor label) (Pro default true)
- `dotColor` → `dot_color`

Header (Pro):
- `collapsed` → `collapsed` (Full-Time Hamburger)

Preview rendering:
- **Real Swiper renders in preview** (added 2026-04). `ContentSection` splits children into `[before(blockOffsetBefore) | slides | after(blockOffsetAfter)]`. Before/after go through `wrapContentChildren` (Bootstrap grid). Slides become one `<SwiperSlide>` each (per-block width inside the slider is bypassed — `slidesPerViewDesktop`/`slidesPerViewMobile` controls layout). Effects supported: slide/fade/cube/coverflow/flip.
- Arrow + dot props honored: `showArrows: false` removes nav module entirely; `showDots: false` removes pagination + the 48px bottom padding. `arrowColor`/`dotColor` set Swiper CSS vars (`--swiper-navigation-color`, `--swiper-pagination-color`, `--swiper-pagination-bullet-inactive-color`). `arrowSliderMargin` adds px to the slider wrapper's left/right padding, pushing arrows outward (matches Kajabi's `arrow_slider_margin` semantics).
- The `customCssClass` IS applied in preview via React `className`, so `themeSettings.customCss` rules verify locally.
- Per-block `column` (Pro 2/3 column layouts) and section `tabs`/`use_as_tab` are NOT yet wired — add when needed via the §9.13 procedure.
