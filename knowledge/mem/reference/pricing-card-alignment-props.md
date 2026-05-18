---
name: PricingCard alignment uses textAlign + mobileTextAlign (NOT align)
description: pricing_card content/bullet alignment is controlled by `textAlign` + `mobileTextAlign` ('left' | 'center' | 'right'). The generic `align` prop (used on text/cta/feature blocks) is silently ignored — drives nothing in PricingCard.tsx and isn't serialized.
type: reference
---

# pricing_card alignment — use `textAlign`, NOT `align`

Verified in `packages/engine/src/blocks/components/PricingCard.tsx`:

- `textAlign?: 'left' | 'center' | 'right'` — drives card content + bullet alignment (Kajabi `text_align`).
- `mobileTextAlign?: 'left' | 'center' | 'right'` — mobile override (Kajabi `mobile_text_align`).
- The button's `alignSelf` also follows `textAlign` (`left` → `flex-start`, `right` → `flex-end`, else `center`).

The generic `align` prop that other blocks use (`text`, `cta`, `feature`, etc.) is **NOT read by PricingCard** and is **NOT serialized** for `pricing_card` blocks. Setting `align: "left"` on a pricing card is a silent no-op — classic §4.26 wrong-prop-name silent drop.

## Symptom

"I asked to left-align the pricing cards. AI set `align: "left"` and saved 200 OK. Refresh shows no change. Cards still center-aligned."

## Fix

```ts
{
  type: "pricing_card",
  props: {
    textAlign: "left",
    mobileTextAlign: "left",
    // delete any leftover `align` prop — it's noise on pricing cards
    ...
  }
}
```

For center (default): omit both, or set `textAlign: "center"`.
For right: `textAlign: "right"`.

## Pre-flight

When the expert asks to align pricing cards (left / center / right, desktop and/or mobile):
1. Set `textAlign` for desktop.
2. Set `mobileTextAlign` for mobile (or copy from desktop if they want both to match).
3. **Delete `align`** from the props object if previously set — it's invalid for `pricing_card` and adds confusion.
