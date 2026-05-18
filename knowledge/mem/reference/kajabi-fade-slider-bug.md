---
name: Kajabi Pro fade slider bug + workaround
description: Kajabi Pro section.liquid initializes Swiper without fadeEffect.crossFade — old slides stay visible underneath new ones. Auto-injected CSS workaround in export.ts handles it.
type: feature
---
**Bug:** `streamlined-home-pro/sections/section.liquid` initializes Swiper for `effect: "fade"` WITHOUT `fadeEffect: { crossFade: true }`. Result: previous slide stays at opacity 1 while next fades in over it → visible stacking/overlap during transition. Affects every Pro site that uses `transition_effect: "fade"` on a slider section.

**Fix (engine-side, automatic):** `src/blocks/export.ts` → `hasFadeSlider(settingsData)` walks `current.sections` looking for any section with `enable_slider: "true"` AND `transition_effect: "fade"`. When found, appends `FADE_SLIDER_CSS` (forces inactive fade slides to `position:absolute + opacity:0`, active slide to `position:relative + opacity:1`, with a 400ms opacity transition) to the exported theme's `customCss`. Composes with template-declared `customCss` — both are joined.

**Selector used:** `.swiper[data-effect="fade"] .swiper-slide` — Kajabi's section.liquid puts `data-effect="..."` on the section element, but the `.swiper` wrapper inside also receives it via the section's outer dataset cascade, so this selector works without depending on section IDs.

**No code change needed in templates** — just pick `sliderTransition: 'fade'` and the workaround ships automatically. Slide/cube/coverflow/flip transitions are unaffected (Kajabi's defaults work for those).
