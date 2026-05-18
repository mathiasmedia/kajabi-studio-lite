---
name: Slider lives in sections.tsx, not components/Slider.tsx
description: There is NO Slider.tsx file in the engine; the slider is rendered inline in sections.tsx via Swiper. Trailing-slash and src/types fixes cannot affect slider rendering — they're red herrings for that symptom.
type: reference
---

**Verified 2026-04-30 against master engine 0.1.18.**

`packages/engine/src/blocks/components/` contains: Accordion, CallToAction, Card, Copyright, CustomCode, Feature, FeatureIcon, Form, Image, ImageIcon, LinkList, Logo, Menu, PricingCard, SearchFilter, SearchForm, SocialIcons, Tabs, Text, Video, VideoEmbed.

**There is NO `Slider.tsx` file.** The slider is rendered inline inside `sections.tsx`'s `renderSlider()` function (around line 315), which imports Swiper directly:

```ts
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination, EffectFade, ... } from 'swiper/modules';
```

The gate in `ContentSection` (sections.tsx ~line 589):
```ts
const useSlider = !!props.enableSlider;
```

**Implications when debugging "slider renders 1-up instead of multi-up":**

- The trailing-slash vite alias bug **CANNOT cause this symptom** by itself. There is no deep `@/blocks/components/Slider` import anywhere; the docstring in `packages/engine/src/vite.ts` references it as a *hypothetical* example only. Bare npm imports (`swiper/react`, `swiper/modules`) are totally unaffected by `@/...` aliases.
- The `src/types/` shadow folder bug **CANNOT cause this symptom** by itself for the same reason — the slider code path doesn't import any types from `@/types/*`.
- What CAN cause it:
  1. **Engine package version too old** — versions before `enableSlider` was added to `ContentSection.props` rendered the section as a static column even when `props.enableSlider: true` was set. Check `node_modules/@k-studio-pro/engine/src/blocks/sections.tsx` for `useSlider = !!props.enableSlider`.
  2. **`swiper` not installed** — `bun add swiper` must be in the thin client's deps.
  3. **Stale local `src/blocks/sections.tsx` shadowing the engine** — if the thin client still has a local `src/blocks/` directory, its `sections.tsx` lacks the slider code path entirely. Check `ls src/blocks 2>&1`.
  4. **Stale local `src/lib/siteDesign/render.tsx` shadowing the engine** — if it filters props before spreading them onto `ContentSection`, `enableSlider` may be stripped. Check `ls src/lib/siteDesign 2>&1`.

**Diagnostic command for any thin client reporting "slider stuck at 1-up":**
```bash
echo "=== engine version ===" && cat node_modules/@k-studio-pro/engine/package.json | grep version
echo "=== swiper installed? ===" && ls node_modules/swiper/package.json 2>&1
echo "=== local shadow folders (should ALL be missing) ===" && ls src/blocks src/engines src/lib/siteDesign src/types 2>&1
echo "=== engine sections.tsx has slider gate? ===" && grep -n "enableSlider" node_modules/@k-studio-pro/engine/src/blocks/sections.tsx
```

If all four checks pass and slider STILL renders 1-up, look for a console error during render (Swiper module failure, missing CSS) — the inline `renderSlider` may throw and React's error boundary swaps in static markup.
