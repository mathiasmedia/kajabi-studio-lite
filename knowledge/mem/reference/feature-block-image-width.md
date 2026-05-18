---
name: Feature block imageWidth must be large for photos
description: feature block's imageWidth defaults to 80px (icon size); for any real card photo set "480" or higher explicitly — omitting does NOT auto-fill the card
type: constraint
---

🚨 THE RULE: Unless you want the image SMALLER than the card (i.e. it's an icon), you MUST set `imageWidth` explicitly to a large pixel value on every `feature` block. Omitting it falls back to **80px** (icon default). There is no auto-fill mode.

Verified in `packages/engine/src/blocks/components/Feature.tsx`:
```ts
const hasExplicitImageWidth = !!props.imageWidth;
const imageStyle = hasExplicitImageWidth
  ? { width: '100%', maxWidth: `${props.imageWidth}px` }
  : { width: '80px', maxWidth: '100%' };  // ← icon fallback
```

**Values to use:**

| Image role | `imageWidth` |
|---|---|
| 3-up / 4-up service-card hero photo | `"480"` – `"640"` (default `"640"` if unsure) |
| 2-up split-feature photo | `"800"` – `"1200"` |
| Full-bleed 1-up photo | `"1400"+` |
| Inline icon above a label | omit (= 80px) or `"80"`–`"120"` |
| Tiny bullet icon | `"32"`–`"64"` |

**Forbidden on photo-bearing feature blocks:** omitted, empty, or any value `< 320`.

**Symptom → check `imageWidth` FIRST:**
- "images are tiny / small / postage stamps / icons"
- "make the images bigger" (especially repeated)
- "service cards look broken — text huge, photo a dot"

**Pre-flight every site/template build:** walk every `feature` block with `image` set; if it's a photo, confirm `imageWidth >= "320"` (default to `"480"`).

Why so loud: #1 most-repeated complaint. Experts ask "make it bigger" 5× in a row because the AI bumps 100→160→200 instead of jumping to 480. There is NO middle ground — either icon (≤120) or photo (≥320, usually 480+).

See AGENTS.md §4.17.
