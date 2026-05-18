---
name: Slider transitionEffect "fade" stacks all blocks
description: Swiper fade mode renders one slide at a time regardless of blocksPerSlide; combine with blocksPerSlide:1 only
type: reference
---
Swiper's `fade` effect crossfades between full-width slides — `blocksPerSlide` is effectively forced to 1 even if you set 3. Symptom: testimonial slider with `blocksPerSlide:3` + `transitionEffect:"fade"` shows ONE testimonial at a time, looking broken next to a sibling slider with the same `blocksPerSlide:3` + `slide` effect that correctly shows 3-up.

Rule:
- Want a 3-up grid carousel → `transitionEffect: "slide"` (default)
- Want fullscreen testimonial crossfade → `transitionEffect: "fade"` + `blocksPerSlide: 1`
- Never mix `fade` with `blocksPerSlide > 1`

Also see `mem://reference/kajabi-fade-slider-bug.md` — Pro section.liquid forgets `fadeEffect.crossFade`, so even valid fade sliders need the CSS workaround in `export.ts`.
