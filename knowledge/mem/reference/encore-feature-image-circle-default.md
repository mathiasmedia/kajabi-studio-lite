---
name: Encore theme rounds feature images by default
description: Encore + Encore-Pro themes auto-round feature block images via theme CSS — override with imageBorderRadius:"0" + customCss on every premium/editorial site
type: constraint
---

🚨 **Verified silent default (Encore + Encore-Pro themes, 2026-05-08).** The Encore base theme's `block_feature.liquid` + theme CSS apply heavy `border-radius` (often 50% or 9999px) to feature block images, producing **circular/oval crops** by default. Looks playful/casual — wrong for premium consulting/editorial brands.

**The fix — every Encore/Encore-Pro site with feature blocks rendering photos:**

1. Set on EVERY `feature` block carrying a photo:
   ```jsonc
   {
     "type": "feature",
     "props": {
       "image": "...",
       "imageWidth": "1200",
       "imageBorderRadius": "0",      // camelCase for editor
       "image_border_radius": "0"     // snake_case for Liquid (per §4.29)
     }
   }
   ```
2. Add `design.customCss` override (block-level prop alone is not always sufficient; the theme CSS uses `.feature__image` with high specificity):
   ```css
   .block-feature .feature__image,
   .block-feature img,
   .feature__image img {
     border-radius: 0 !important;
     aspect-ratio: 4 / 3 !important;
     object-fit: cover !important;
   }
   ```

**Pre-flight on every Encore/Encore-Pro site build:** if any `feature` block has `image` set AND the brand is premium/editorial/consulting (not playful/wellness/lifestyle), apply the override above. Default to rectangular unless the expert explicitly asks for circular.

**Streamlined-home themes are unaffected** — they render feature images as plain rectangles by default.
