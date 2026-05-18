---
name: Pro all-headings font override — exact field IDs
description: The all-headings font selector is `select_custom_all_headings_font` (NOT `select_custom_heading_font`); same `_all_headings_` infix on weight/line-height/etc. Wrong key = silent no-op, h4/h5/h6 fall back to Kajabi default heading font.
type: reference
---

# Pro all-headings override — verified field IDs

🚨 **Easy-to-miss naming asymmetry.** The toggle is `override_heading_font_styles` (singular "heading") but EVERY child field uses `_all_headings_` (plural). Mixing them up emits an unknown key, the serializer ships it verbatim, the Liquid `{% if settings.<wrong_key> %}` is always false, and **nothing renders** — h4/h5/h6 keep using Kajabi's default heading font (Inter-ish), not your custom primary.

## Verified IDs (from `pro-unlocked/config/settings_schema.json` + `snippets/font_override_styles.liquid`)

| Field | Correct ID | Common wrong guess |
|---|---|---|
| Visibility toggle | `override_heading_font_styles` | — |
| Font slot picker | `select_custom_all_headings_font` | ❌ `select_custom_heading_font` |
| Font weight | `custom_all_headings_font_weight` | ❌ `custom_heading_font_weight` |
| Line height | `custom_all_headings_line-height` (hyphen!) | ❌ `..._line_height` |
| Letter spacing | `custom_all_headings_letter-spacing` (hyphen!) | ❌ `..._letter_spacing` |
| Bottom margin | `custom_all_headings_bottom_margin` | — |

The Liquid selector at `snippets/font_override_styles.liquid:78` covers ALL six heading levels (and their `strong` variants):

```
h1, .h1, h1 strong, .h1 strong,
h2, .h2, h2 strong, .h2 strong,
h3, .h3, h3 strong, .h3 strong,
h4, .h4, h4 strong, .h4 strong,
h5, .h5, h5 strong, .h5 strong,
h6, .h6, h6 strong, .h6 strong { ... }
```

## When to use it

This is the **default** way to apply a custom heading font sitewide. Per-element `select_custom_h<N>_font` overrides only beat the all-headings rule on the elements you author — every level you skip silently falls back to Kajabi's stock heading font, which usually looks wrong next to your custom primary (different weight, different proportions, different vertical rhythm).

**Rule of thumb:** if the expert wants their primary custom font on headings, set `select_custom_all_headings_font: "primary"` FIRST. Add per-element overrides only when a specific level needs different sizing/weight than the all-headings baseline.

## Symptom of the wrong key

- "h1, h2, h3 are in my custom font but pricing card titles (h4) are still Inter / a different font"
- "the section headings look right but the small headings don't match"
- "I set the all-headings override and saved but only some headings changed"

→ Check the field id. If it's `select_custom_heading_font` (singular, no `_all_`), it's a silent no-op. Rename to `select_custom_all_headings_font`.

## Authoring snippet

```ts
ts.override_heading_font_styles = "true";
ts.select_custom_all_headings_font = "primary";
// optional sitewide tweaks:
ts.custom_all_headings_font_weight = "600";        // or "inherit"
ts["custom_all_headings_line-height"] = "1.1";     // or "inherit"
ts["custom_all_headings_letter-spacing"] = "-0.5px"; // or "inherit"
```

Note: the `*_line-height` / `*_letter-spacing` keys use a literal hyphen (per AGENTS §9.8c), so JS object literal access requires bracket notation.
