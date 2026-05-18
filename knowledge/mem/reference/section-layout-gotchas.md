---
name: Section + block render gotchas
description: Counterintuitive Kajabi field semantics — bg images, fullWidth, horizontal alignment, rgba overlay tint, social icon URLs required to render
type: reference
---

Section-level fields whose behavior is NOT what the name suggests. Always check this list before emitting these settings.

## `background_color` with a bg image/video
- When `bg_image` or `bg_video` is set, `background_color` acts as an **overlay tint** rendered on top of the media.
- A fully opaque hex (e.g. `"#0F172A"`) hides the image entirely.
- Always emit it as `rgba(r, g, b, a)` with `a < 1` (typical: `0.35`–`0.6`) when media is present.
- Do NOT auto-convert hex → rgba in the serializer — the caller decides the alpha. Upstream extraction / recipe assembly must produce the rgba string.

## `full_width` (a.k.a. `fullWidth` prop) is NOT for background images
- Background images already cover the full section width on their own.
- `full_width` only controls whether the **inner content container** breaks out of the page max-width.
- Don't set `full_width: 'true'` just because a section has a bg image.

## `horizontal` (section-level) is BLOCK alignment, not text alignment
- `horizontal: left | center | right | space-between | space-around` aligns **blocks** within the 12-column grid when they don't fill all 12 columns.
  - e.g. a single `width: '6'` block in a section with `horizontal: 'right'` sits flush-right.
- Text alignment inside a block is controlled by the block-level `text_align` field instead.
- Don't conflate the two — setting section `horizontal: 'right'` will NOT right-align text in a width-12 block.

## `vertical` (section-level)
- Centers blocks vertically when the section has `full_height: 'true'` or a tall fixed height. Without one of those, it has no effect.

## `full_height`
- Makes the section `min-height: 100vh`. Required for `vertical: 'center'` to actually do anything visible.

## `background_fixed` (parallax)
- Only applies when `bg_type: 'image'`. Ignored for color/video.
- iOS Safari historically ignores `background-attachment: fixed` — accept that parallax may degrade to a normal scrolling bg on mobile.

## `social_icons` block — icons only render with a URL
- Kajabi only renders an icon when its `social_icon_link_<platform>` field is non-empty.
- Always default 3–4 common platforms (twitter, instagram, linkedin, youtube) to placeholder URLs (e.g. `https://twitter.com/`) so a fresh export visibly shows icons.
- Pass `''` explicitly to hide a platform that is in the defaults.
- Field name is **singular** `social_icon_size` (not `social_icons_size`).
