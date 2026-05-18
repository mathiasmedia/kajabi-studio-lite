---
name: block-field-catalog
description: Authoritative per-block field lists for streamlined-home, extracted directly from snippets/block_*.liquid files. Use as ground truth before adding/changing any block serializer.
type: reference
---

# Streamlined-home Block Field Catalog

**Source of truth**: `snippets/block_<type>.liquid` — grep for `block.settings.<field>` accesses. Section schemas (`sections/section.liquid`, `header.liquid`, `footer.liquid`) only declare *which block types* are allowed, not their fields.

## Universal block-base fields (snippets/block.liquid wrapper)
Always valid on every content block. Injected by `withBlockDefaults`:
`width, text_align, box_shadow, background_color, animation_type, animation_direction, delay, duration, hide_on_desktop, hide_on_mobile, make_block, reveal_event, reveal_units, reveal_offset`

## Per-block real fields

### text  (also gets btn_* via `{% include "block_cta" %}` when use_btn=true)
`text, text_align, mobile_text_align, use_btn, btn_text, btn_action, btn_text_color, btn_background_color, btn_border_radius, btn_style, btn_size, btn_width, drop_cap, cap_color`

### feature  (also gets btn_* via block_cta when use_btn=true)
`text` (SINGLE rich-text HTML field — heading + body + decoration ALL live here)
`text_align, mobile_text_align, image, image_alt, image_width, image_border_radius, hide_image, img_action, new_tab_image, use_btn, btn_text, btn_action, btn_text_color, btn_background_color, btn_border_radius, btn_style, btn_size, btn_width`
**No `heading`/`body`/`extraHtml` fields.** The recipe value shape is `{ text, imageUrl }` to match Kajabi 1:1. Legacy `{heading, body, extraHtml}` shapes are migrated into `text` automatically by featureHandler.harden() on load.

### image
`image, image_alt, image_first, image_width, image_border_radius, img_action, overlay_text, enable_overlay, overlay_background_color, overlay_text_color, image_align_desktop, image_align_mobile, image_caption, gallery, always_show_on_mobile, new_tab`

### card
`image, image_alt, description, action, show_cta, btn_text, btn_width, btn_style, btn_size, btn_border_radius, btn_text_color, btn_background_color, footer, footer_text_color, text_align, new_tab`

### cta
`btn_text, btn_action, btn_width, btn_style, btn_size, btn_border_radius, btn_text_color, btn_background_color, alignment, text_align, img_action, new_tab`

### form
`form, text, disclaimer_text, disclaimer_text_color, input_label, inline, btn_text, btn_width, btn_style, btn_size, btn_border_radius, btn_text_color, btn_background_color, text_align, thank_you`
**No `heading` field.** Fold heading HTML into `text`.

### video
`video, image (poster), controls_on_load, auto_play, loop, play_button, small_play_button, full_screen, playbar, video_settings, video_color`
Wrong names previously used: `poster`→`image`, `show_controls`→`controls_on_load`, `muted`→`full_screen`.

### video_embed
`code` (raw embed HTML/iframe). Single field.
**Wrong name previously used**: `video_url`. The component should emit `code`.

### link_list
`menu, title, show_title, link_color, title_color, vertical, text_align, mobile_text_align, new_tab`
`vertical` = layout direction (`row`|`column`). **No `heading`/`alignment`/`layout`/`items` fields.**

### social_icons
`social_icons_size, social_icons_background_color, social_icon_background_style`
**Note plurals**: `social_icons_size` (plural), `social_icon_background_style` (singular). Per-platform URLs (`facebook`, `twitter`...) are theme-global settings, not block fields.

### accordion
`heading, body, accordion_icon, icon_color, text_align, mobile_text_align`

### pricing
`heading, name, price, text, image, image_alt, show_image, price_color, price_name_color, ...` (full set in kajabiFieldSchema.ts)

### code
`code` (single field). Custom HTML/JS.

### logo (header/footer)
`logo, logo_text, logo_type, logo_width, logo_text_color, image_alt, stretch, alignment`

### menu (header/footer)
`menu, stretch, alignment`

### copyright (footer only)
`copyright` — text only. **Never include `©` or year** — Kajabi auto-prepends `© <year>`.

### hello_bar (header only)
`text, text_color, background_color, action, horizontal, new_tab`
**Header schema requires `hello_bar` to be in the allowed-blocks set.**

## Section-level layout fields (sections/section.liquid)
These collide with same-named block fields and must be registered as section-level in the validator:
`vertical, horizontal, full_width, full_height, equal_height, bg_type, bg_image, bg_video, bg_position, background_fixed`
Plus: `max_width, hide_on_mobile, hide_on_desktop, background_type, background_color, background_image, background_overlay, background_overlay_opacity, text_color, padding_desktop, padding_mobile`

## Validation enforcement

`src/test/blockSchemaRoundTrip.test.ts` renders every block component, runs the real serialize tree walker, validates against `BLOCK_FIELD_SCHEMAS`, and asserts:
1. Zero blocking errors from `validateAndRepairSections`
2. Every emitted field name is either in the per-block schema or universal block defaults
3. Block type matches `kajabiType`
4. Block type is in `ALLOWED_BLOCKS_PER_SECTION` for its parent section

Add a case here whenever a new block component lands.
