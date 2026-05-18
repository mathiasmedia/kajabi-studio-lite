---
name: PricingCard auto-themes for dark surfaces
description: PricingCard.tsx detects luminance of card bg and flips ink/muted text colors; outline buttons render transparent bg with border (not solid black)
type: reference
---
`packages/engine/src/blocks/components/PricingCard.tsx` ships an `isDarkColor(hex|rgba)` helper that calculates luminance and toggles:
- `ink` → light (`#F4ECDC`) on dark surfaces, dark (`#111`) on light
- `muted` → matching translucent

Without this, dark-surface tier cards (e.g. brand-color middle tier) render black bullets/checkmarks/body copy on a near-black background — invisible.

Outline button branch MUST set:
- `backgroundColor: 'transparent'` (NOT `buttonBackground`)
- `border: '1.5px solid {buttonBackground}'`
- `color: buttonText`

Default fallback to `'solid'` produces a black-fill button with dark text on a dark card — also invisible.

`PricingCardProps` includes `buttonStyle: 'solid' | 'outline' | 'text'` and `buttonBorderRadius`. Persist these on every pricing_card block in `design`, especially when authoring multi-tier grids where the highlighted tier inverts the palette.

Symptom of regression: bullets and CTAs disappear on the highlighted/middle pricing tier. Fix: confirm `isDarkColor` is still exported and that the button renderer branches on `buttonVariant === 'outline'` BEFORE applying `backgroundColor`.
