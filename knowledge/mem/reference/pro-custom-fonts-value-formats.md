---
name: Pro custom-font value formats (px/em/unitless)
description: Exact enum value formats Kajabi accepts for every custom_* themeSettings field — bare numbers and `em` are silently rejected
type: reference
---

Kajabi's Pro themes validate every `custom_*` / `btn_*` / `form_input_*` themeSetting against a fixed `select` enum (verified against `streamlined-home-pro/config/settings_schema.json`). Bare numbers (`"42"`, `"16"`) and `em` units (`"-0.02em"`, `"1.25em"`, `"0.18em"`) are NOT valid enum members — Kajabi silently falls back to the default. Always emit the exact format below.

## Font sizes — `Npx` strings, NO `13px` (jumps 12→14)
**Fields:** `custom_h{1-6}_font_size_{desktop,mobile}`, `custom_bold_h{1-6}_font_size_*`, `custom_body_font_size_*`, `custom_bold_body_font_size_*`, `custom_button_font_size_*`, `form_input_font_size_*`
**Valid values:** `"inherit"`, `"8px"`, `"10px"`, `"12px"`, `"14px"`–`"80px"` (every px), then `"82px"`, `"84px"`, `"86px"`, `"88px"`, `"90px"`, `"92px"`, `"94px"`, `"96px"`, `"98px"`, `"100px"`, `"102px"`, `"104px"`, `"106px"`, `"108px"`, `"110px"`, `"115px"`, `"120px"`, `"125px"`, `"130px"`, `"135px"`, `"140px"`, `"145px"`
**Gaps:** no `9px`, `11px`, `13px`, `15px`, `81px`, `83px`, etc. — snap UP to the next valid value.

## Line-heights — unitless decimal strings, leading dot for <1
**Fields:** `custom_h{1-6}_line-height`, `custom_bold_h{1-6}_line-height`, `custom_all_headings_line-height`, `custom_body_font_line-height`, `custom_bold_body_line-height`, `custom_body_button_line-height`, `form_input_line-height`
**Valid values:** `"inherit"`, `".5"`, `".6"`, `".7"`, `".8"`, `".9"`, `"1.0"`, `"1.1"`, `"1.2"`, `"1.3"`, `"1.4"`, `"1.5"`, `"1.6"`, `"1.7"`, `"1.8"`, `"1.9"`, `"2.0"`
**Snap to nearest 0.1.** `"1.05"` is INVALID — round to `"1.0"` or `"1.1"`. `"1.65"` → `"1.6"` or `"1.7"`.

## Letter-spacings — `Npx` strings ONLY, NEVER `em`
**Fields:** `custom_h{1-6}_letter-spacing`, `custom_bold_h{1-6}_letter-spacing`, `custom_all_headings_letter-spacing`, `custom_body_font_letter-spacing`, `custom_bold_body_letter-spacing`, `btn_letter-spacing`, `form_input_letter-spacing`
**Valid values:** `"inherit"`, `"-2px"`, `"-1.9px"`, `"-1.8px"` … (0.1 increments) … `"-1px"`, `"-.9px"`, `"-.8px"` … `"-.1px"`, `"0px"`, `".1px"`, `".2px"` … `".9px"`, `"1px"`, `"1.1px"` … `"2px"`
**Range:** `[-2px, 2px]` in 0.1px increments. **Leading dot for sub-1px** (`.5px` not `0.5px`). **NO em** — `"0.18em"` (uppercase tracking @ 14px ≈ 2.5px) clamps to max `"2px"`.

## Padding (vertical & horizontal) — `Npx` strings 0–50px integer
**Fields:** `button_vertical_padding`, `button_horizontal_padding`, `form_input_vertical_padding`, `form_input_horizontal_padding`
**Valid values:** `"inherit"`, `"0px"`, `"1px"`, `"2px"` … `"50px"` (every integer)

## Border-thickness — `Npx` strings 0–10px integer
**Fields:** `button_border_thickness`, `form_input_border_thickness`
**Valid values:** `"inherit"`, `"0px"` … `"10px"`

## Margins (top, bottom, paragraph) — `Npx` strings, sparse 5px grid
**Fields:** `custom_h{1-6}_bottom_margin`, `custom_bold_h{1-6}_bottom_margin`, `custom_all_headings_bottom_margin`, `custom_p_bottom_margin`, `custom_bold_p_bottom_margin`, `custom_button_top_margin`, `custom_button_bottom_margin`, `form_input_top_margin`, `form_input_bottom_margin`
**Valid values:** `"inherit"`, `"-25px"`, `"-20px"`, `"-15px"`, `"-10px"`, `"-5px"`, `"0px"`, `"5px"`, `"10px"`, `"15px"`, `"20px"`, `"25px"`, `"30px"`, `"35px"`, `"40px"`, `"45px"`, `"50px"`, `"55px"`, `"60px"`
**5px grid only.** No `"12px"`, no `"1.25em"` — snap to nearest 5.

## Font weights — bare digit strings
**Fields:** `btn_font_weight`, `custom_h{1-6}_font_weight`, `custom_bold_h{1-6}_font_weight`, `custom_all_headings_font_weight`, `custom_body_font_weight`, `custom_bold_body_font_weight`, `form_input_font_weight`
**Valid values:** `"inherit"`, `"100"`, `"200"`, `"300"`, `"400"`, `"500"`, `"600"`, `"700"`, `"800"`, `"900"`

## Radio toggles — string `"on"`/`"off"` or pair labels (NOT booleans)
- `btn_uppercase`: `"on"` | `"off"` (default `"off"`)
- `btn_override_shadow`: `"on"` | `"off"` (default `"on"`)
- `btn_inverse_on_hover`: `"normal"` | `"inverse"` (default `"normal"`)
- `btn_type`: `"dark"` | `"light"` (default `"dark"`)
- `btn_style`: `"solid"` | `"outline"` | `"text"` (default `"solid"`)
- `btn_size`: `"small"` | `"medium"` | `"large"` (default `"medium"`)
- `form_new_input_type`: `"dark"` | `"light"` (default `"light"`)
- `form_new_input_style`: `"solid"` | `"transparent"` (default `"solid"`)

## Range fields — bare integer strings (the only place bare numbers are valid)
- `btn_border_radius` (default `"0"`) — px slider, no enum
- `form_input_border_radius` (default `"0"`) — px slider, no enum

## Checkbox toggles — string `"true"`/`"false"` (Kajabi accepts both bool and string)
All `override_*`, `use_*`, `view_*` toggles. Use `"true"` to flip on. **Whenever you emit any field gated by a `hide_if` toggle, also flip the toggle to `"true"`** — otherwise the field is invisible in Kajabi's editor (per AGENTS.md §9.8c).

## Font slot picker — exact string sentinels
**Fields:** `select_custom_btn_font`, `select_custom_h{1-6}_font`, `select_custom_bold_h{1-6}_font`, `select_custom_body_font`, `select_bold_custom_body_font`, `select_custom_all_headings_font`, `form_input_font`
**Valid values:** `"inherit"` | `"primary"` | `"accent"` (default `"inherit"`)

## Font fallback — generic family
**Fields:** `primary_custom_font_fallback`, `accent_custom_font_fallback`
**Valid values:** `"serif"` | `"sans-serif"` | `"monospace"` | `"cursive"` | `"fantasy"`

## How to derive correct values from designer-friendly inputs

| Designer says | Correct emit |
|---|---|
| "h1 line-height 1.05" | `"1.0"` (snap to 0.1 grid) |
| "body line-height 1.65" | `"1.6"` or `"1.7"` |
| "h1 tracking -0.02em" | px @ target font-size; e.g. h1 ≈ 56px → `"-1.1px"` |
| "button uppercase tracking 0.18em" | px @ button size 14px = 2.5px → clamp `"2px"` |
| "h2 size 42" | `"42px"` |
| "button size 13" | `"14px"` (no `13px` in enum) |
| "p margin 1.25em" | px @ 16px = 20px → `"20px"` |
| "button padding 16/32" | `"16px"` / `"32px"` |
| "border 1" | `"1px"` |

## Rule
**Always check `streamlined-home-pro/config/settings_schema.json` enums before emitting a value.** When in doubt: `unzip public/base-theme/streamlined-home-pro.zip`, `grep -A2 '"id": "<field>"' config/settings_schema.json`. Bare numbers and em values fail SILENTLY — Kajabi reverts to the default and the expert reports "my custom typography didn't apply."
