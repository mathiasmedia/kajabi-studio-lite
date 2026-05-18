---
name: footer_pro link_list title centered by default
description: Pro footer_pro centers .link_list__title by default; restyling font/color without resetting text-align leaves titles centered while lists go left. Always pin text-align in customCss when restyling, and emit alignment props in BOTH shapes (align + text_align + textAlign) so the editor toggle round-trips.
type: constraint
---

## The trap

Pro `footer_pro` ships CSS that centers `.link_list__title` by default. When you write `customCss` to restyle the title (font, color, letter-spacing), the title KEEPS centered alignment unless you explicitly reset `text-align`. The `<ul>/<li>` underneath inherit normal block flow → left-aligned. Result: titles centered, lists left, looks broken.

## The fix — two parts, BOTH required

**1. CSS must explicitly pin `text-align` when restyling footer blocks:**

```css
.footer_pro .link_list__title,
.footer_pro .link_list h4,
.footer_pro .link_list h3 { text-align: left !important; ...font/color... }
.footer_pro ul li { text-align: left !important; }
.footer_pro .copyright,
.footer .copyright { text-align: left !important; ...font/color... }
```

`!important` is required — Pro's stylesheet wins specificity otherwise.

**2. Block alignment props must emit ALL THREE shapes:**

The editor writes snake_case (`text_align`) for schema fields without a `.deserialize()` alias on the block (§4.29). If you only set `align` (camelCase generic prop), the editor's Text Alignment toggle writes `text_align`, but the block reads `align` — toggle saves, preview ignores it.

```jsonc
{
  "type": "link_list",
  "props": {
    "align": "left",
    "text_align": "left",
    "textAlign": "left",
    "title": "My Title",
    "links": []
  }
}
```

Apply on every `link_list`, `copyright`, and `text` block in any `footer` / `footer_pro` section.

## Pre-flight check

Whenever you author/restyle a Pro footer:
1. CSS targeting `.link_list__title` / `.footer_pro h3` / `.footer_pro h4` MUST include `text-align: <value> !important`.
2. Every footer block's props MUST carry `align` + `text_align` + `textAlign` together.

## Why both fixes are needed

CSS alone fixes the visible bug but leaves the editor toggle broken — expert clicks "left" in the toggle and nothing happens. Props alone don't override Pro's centered default for `.link_list__title`. Ship both.

## Related

- §4.29 — schema-driven editor writes snake_case for unaliased fields; first-class blocks need dual-shape on read or `readField`. This memory is the footer-specific instance.
- §4.5 — by default, footer `link_list` blocks should NOT have titles. This rule applies when the expert explicitly asks for column titles.
