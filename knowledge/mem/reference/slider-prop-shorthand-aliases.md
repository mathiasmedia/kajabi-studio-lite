---
name: Slider prop shorthand aliases
description: Engine accepts both canonical (slidesPerViewDesktop) and shorthand (blocksPerSlide) slider props on ContentSection — silent fallback to 1-per-slide if missed
type: feature
---
ContentSection slider props accept BOTH the canonical engine names and the shorthand names (which mirror Kajabi's actual `settings_data.json` field IDs). Real authored sites use the shorthand — if the engine only reads canonical, the preview falls back to `slidesPerView=1` (one block per slide) and the export ships defaults instead of the author's values. Both `packages/engine/src/blocks/sections.tsx` (renderSlider) and `packages/engine/src/blocks/serialize.ts` normalize via `??` chains.

| Shorthand (also accepted) | Canonical engine prop | Kajabi field |
|---|---|---|
| `blocksPerSlide` | `slidesPerViewDesktop` | `blocks_per_slide` |
| `autoplay` | `sliderAutoplay` | `autoplay` |
| `autoplayDelay` | `sliderAutoplayDelay` | `autoplay_delay` |
| `loop` | `sliderLoop` | `loop` |
| `transitionEffect` | `sliderTransition` | `transition_effect` |
| `transitionSpeed` | `sliderSpeed` | `transition_speed` |

Symptom when this regresses: Pro slider shows ONE block per slide in preview while Kajabi correctly shows N. Author swears they set "blocks per slide = 3" but the JSON key is `blocksPerSlide` and engine was looking for `slidesPerViewDesktop`. Per-slide width math (`(100% - (n-1)*gap) / n`) is correct in both Kajabi (via Liquid CSS calc in `pro-unlocked/sections/section.liquid` ~line 340) and engine preview (Swiper's `slidesPerView`) — the bug is only ever in prop name resolution.
