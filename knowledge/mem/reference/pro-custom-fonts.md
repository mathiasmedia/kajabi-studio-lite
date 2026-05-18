---
name: Pro custom fonts (full reference)
description: Verified field IDs, cascade order, visibility toggles, and "inherit" semantics for the Pro template's custom font / button / form override system in config/settings_schema.json
type: reference
---

# Pro custom fonts — full reference

Source of truth: `streamlined-home-pro/config/settings_schema.json` ("Style Guide" tab) + `snippets/font_override_styles.liquid`. All field IDs below are verified against the unzipped Pro base theme.

## Why this exists

Kajabi's default font system has two limits the expert hits constantly:
1. **Font picker is restricted to a small Google Fonts set** — no Adobe, no self-hosted, no arbitrary `<link>` tags.
2. **Font sizes are a fixed select list** — e.g. 32px and 36px exist but 34px doesn't.

The Pro template **keeps the default Kajabi fonts/sizes intact** and layers a **fully optional override system** on top. Leave overrides off (defaults: `false` checkboxes + `"inherit"` selects + empty text) → Kajabi defaults win exactly as on Standard. Turn an override on → it wins for that scope.

## Cascade (lowest → highest priority)

1. Kajabi defaults (`font_family_body`, `font_family_heading`, `font_size_h*_desktop`, etc.)
2. **Body overrides** (`override_body_fonts: true` → `select_custom_body_font` + size/weight/etc) and **bold body overrides** (`override_bold_body_fonts: true`)
3. **All headings overrides** (`override_heading_font_styles: true` → `select_custom_all_headings_font` + size/weight/etc)
4. **Per-element overrides** (e.g. `override_h3_font_styles: true` beats All headings for H3)
5. **Bold-per-element overrides** (e.g. `override_h3_bold_font_styles: true` for `h3 strong`)
6. **Block-level overrides** (per-CTA / per-form fields beat all template-level settings)

## Visibility toggle pattern (`hide_if`)

Most override fields have `hide_if: { <toggle_id>: false }`. The toggle controls whether the field is **visible in the Kajabi page builder** — it does NOT gate emission. But: **whenever the serializer emits any override under a toggle, it MUST also flip the toggle to `true`**, otherwise the expert opens Kajabi and can't see/edit the field they were given.

Toggles to flip:

| Toggle ID | Default | Unlocks |
|---|---|---|
| `view_advanced_button_customizations` | `false` | All `btn_*` advanced fields (rows 22–35) |
| `use_custom_fonts` | `false` | `font_stylesheet_links` |
| `use_primary_custom_font` | `false` | `primary_custom_font_name`, `primary_custom_font_fallback` |
| `use_accent_custom_font` | `false` | `accent_custom_font_name`, `accent_custom_font_fallback` |
| `override_body_fonts` | `false` | `select_custom_body_font` + body size/weight/lh/ls/margin |
| `override_bold_body_fonts` | `false` | `select_bold_custom_body_font` + bold body fields |
| `override_heading_font_styles` | `false` | All-headings overrides (no size — use per-element for size) |
| `override_h1_font_styles` … `override_h6_font_styles` | `false` | Per-element font/weight/lh/ls/size_desktop/size_mobile/bottom_margin |
| `override_h1_bold_font_styles` … `override_h6_bold_font_styles` | `false` | Per-element bold variant (same fields) |
| `use_pro_form_customizations` | `false` | All `form_input_*` fields |
| `use_font_css` | `false` | `font_css` raw CSS textarea |

## Custom font slot setup

Two slots only: **primary** and **accent**. To wire a font (Google, Adobe, or self-hosted):

1. `use_custom_fonts: true`
2. `font_stylesheet_links` ← paste the full `<link rel="stylesheet" href="...">` tag(s). Multi-line allowed (textarea). For Google Fonts: open the embed dialog → "Web" → "Link" → copy the shown `<link>` lines.
3. `use_primary_custom_font: true` (or `_accent_`)
4. `primary_custom_font_name` ← exact `font-family` declared by the loaded stylesheet (e.g. `Roboto`, `Playfair Display`). NO quotes — Liquid wraps in quotes itself: `font-family: "{{ theprimaryfont }}", {{ theprimaryfallback }};`
5. `primary_custom_font_fallback` ← generic family (`sans-serif`, `serif`, `monospace`, etc.). Goes in unquoted.

Then assign via any `select_custom_*_font` field:
- `"primary"` → uses primary slot
- `"accent"` → uses accent slot
- `"inherit"` → emits NOTHING; element falls back to Kajabi's default font picker (NOT to the other slot)

## "inherit" semantics — verified from Liquid

From `snippets/font_override_styles.liquid`:
```liquid
{% if settings.select_custom_h3_font == 'primary' %}font-family: "{{ theprimaryfont }}", {{ theprimaryfallback }};{% endif %}
{% if settings.select_custom_h3_font == 'accent' %}font-family: "{{ theaccentfont }}", {{ theaccentfallback }};{% endif %}
{% if settings.custom_h3_font_weight != 'inherit' %}font-weight: {{ settings.custom_h3_font_weight }};{% endif %}
{% if settings.custom_h3_line-height != 'inherit' %}line-height: {{ settings.custom_h3_line-height }};{% endif %}
```

**Every numeric/select override is checked against the literal string `"inherit"`. Empty string is NOT inherit** — it produces broken CSS like `font-weight: ;`. Serializer rule: emit `"inherit"`, never `""`, never omit the key.

The `font-family` selects use `'primary'` / `'accent'` only — anything else (including `"inherit"`) emits no `font-family` rule. This means `select_custom_*_font: "inherit"` **does NOT make the element use Kajabi's heading/body font** — it makes the element NOT have a custom font-family rule at all, so it inherits from Kajabi's normal cascade. Net effect for the expert: same outcome (Kajabi default wins).

## Per-element override field shape (h1 example, identical for h2–h6)

| Field ID | Type | Default | Notes |
|---|---|---|---|
| `override_h1_font_styles` | checkbox | `false` | Visibility toggle |
| `select_custom_h1_font` | select | `inherit` | `inherit` / `primary` / `accent` |
| `custom_h1_font_weight` | select | `inherit` | `100`–`900` (whatever the loaded font ships) |
| `custom_h1_line-height` | select | `inherit` | **Note hyphen, not underscore, in the ID** |
| `custom_h1_letter-spacing` | select | `inherit` | **Note hyphen** |
| `custom_h1_font_size_desktop` | select | `inherit` | px values (the whole point — finer than Kajabi's defaults) |
| `custom_h1_font_size_mobile` | select | `inherit` | px values |
| `custom_h1_bottom_margin` | select | `inherit` | px |

Bold variant is identical with `_bold_` infix on the toggle and `bold_` prefix on the override IDs (e.g. `override_h1_bold_font_styles`, `select_custom_bold_h1_font`, `custom_bold_h1_font_size_desktop`).

## All-headings override shape

Same as per-element BUT no size fields (size must go on the per-element override or stay with Kajabi defaults):

| Field ID | Type | Default |
|---|---|---|
| `override_heading_font_styles` | checkbox | `false` |
| `select_custom_all_headings_font` | select | `inherit` |
| `custom_all_headings_font_weight` | select | `inherit` |
| `custom_all_headings_line-height` | select | `inherit` |
| `custom_all_headings_letter-spacing` | select | `inherit` |
| `custom_all_headings_bottom_margin` | select | `inherit` |

## Body & bold body override shape

Same idea, on `body, p` and `body strong, p strong, body b, p b`:

| Field ID | Default |
|---|---|
| `override_body_fonts` | `false` |
| `select_custom_body_font` | `inherit` |
| `custom_body_font_weight` | `inherit` |
| `custom_body_font_line-height` | `inherit` |
| `custom_body_font_letter-spacing` | `inherit` |
| `custom_body_font_size_desktop` | `inherit` |
| `custom_body_font_size_mobile` | `inherit` |
| `custom_p_bottom_margin` | `inherit` |
| `override_bold_body_fonts` | `false` |
| `select_bold_custom_body_font` | `inherit` |
| `custom_bold_body_font_weight` | `inherit` |
| `custom_bold_body_line-height` | `inherit` |
| `custom_bold_body_letter-spacing` | `inherit` |
| `custom_bold_body_font_size_desktop` | `inherit` |
| `custom_bold_body_font_size_mobile` | `inherit` |
| `custom_bold_p_bottom_margin` | `inherit` |

## Buttons (template level — see also §9.8a)

Gated by `view_advanced_button_customizations: true`. Verified field IDs (rows 22–35 in schema):

`btn_override_shadow`, `btn_inverse_on_hover`, `btn_uppercase`, `select_custom_btn_font`, `btn_font_weight`, `custom_body_button_line-height`, `btn_letter-spacing`, `custom_button_font_size_desktop`, `custom_button_font_size_mobile`, `button_border_thickness`, `button_vertical_padding`, `button_horizontal_padding`, `custom_button_top_margin`, `custom_button_bottom_margin`.

Hyphen IDs to remember: `custom_body_button_line-height`, `btn_letter-spacing`.

## Forms (template level)

Gated by `use_pro_form_customizations: true`. Field IDs:

`form_input_color_dark`, `form_input_placeholder_color_dark`, `form_input_color_light`, `form_input_placeholder_color_light`, `form_new_input_style` (`solid` / `transparent`, default `solid`), `form_new_input_type` (`dark` / `light`, default `light`), `form_input_border_radius` (range, default `0`), `form_input_border_thickness`, `form_input_font`, `form_input_font_weight`, `form_input_line-height`, `form_input_letter-spacing`, `form_input_font_size_desktop`, `form_input_font_size_mobile`, `form_input_vertical_padding`, `form_input_horizontal_padding`, `form_input_top_margin`, `form_input_bottom_margin`.

All overrides default to `"inherit"` (literal string).

## Block-level overrides

Every `cta` block carries its own copy of the advanced button fields, and form blocks carry their own copy of the form input fields. Per-block values **override the template-level settings** for that one block. Same `"inherit"` sentinel rule (literal string, every field, never `""`, never omit).

## Authoring rules (mandatory)

1. **Default to Kajabi defaults.** Don't reach for the override system unless the expert specifically asked for a font Kajabi doesn't ship, or a specific size Kajabi's picker doesn't have (e.g. 34px).
2. **Whenever you emit any override field, also flip its visibility toggle to `true`.** Otherwise the expert can't see/edit it in Kajabi.
3. **Use `"inherit"` (literal string) for every numeric/select override you don't want to change** — never `""`, never omit.
4. **Custom font name field takes the family name unquoted.** Liquid wraps it in quotes.
5. **Note the hyphen-in-ID fields:** `*_line-height`, `*_letter-spacing`, `custom_body_button_line-height`. They'll bite you on serialization if you assume snake_case.
6. **One pair per site.** Pick primary + accent ONCE, then assign to elements. Don't use one font for H1 and a different font for H2 by hijacking the slots — that's what per-element font selectors are for (and you only have 2 slots anyway).
7. **`select_custom_*_font: "inherit"` on a heading does NOT route to a custom slot — it uses Kajabi's default heading font.** That's the correct behavior when you want a mixed cascade (e.g. H1 = primary custom, H2/H3 = Kajabi default).
