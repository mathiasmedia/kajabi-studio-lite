---
name: Accordion block styling defaults
description: Accordion blocks need real internal padding, soft shadow, narrower width, and styled body HTML — never ship them as bare width=10/12 with default chrome.
type: design
---

# Accordion block — required styling pattern

Each `<Accordion>` is its own Kajabi block in a 12-col grid row. With default
chrome (no padding, no shadow, full width) they render as detached lines with
the heading glued to the top of the panel — looks broken in production.

## Required props on every Accordion in a list

```tsx
<Accordion
  heading={q}
  body={`<div style="font-family:${SANS};font-size:16px;line-height:1.7;color:${BODY}">${a}</div>`}
  width="8"                    // narrower than full row — feels intentional
  backgroundColor="#FFFFFF"    // or template's PANEL color (cream/sand)
  borderRadius="16"            // soft rounded corners
  boxShadow="small"            // subtle elevation
  padding={{ top: '24', right: '28', bottom: '24', left: '28' }}
  iconColor={ACCENT}           // template accent color for +/−
/>
```

## Why each piece

- **`width="8"`** — full-width accordions look like horizontal bars; col-8 centered reads like a curated FAQ stack. Use `6` for tighter editorial templates.
- **Internal `padding`** — Accordion's built-in style is only `12px 0`. Without explicit padding, the heading hugs the panel's top edge.
- **`boxShadow="small"`** — separates each item from the section background; without it, white-on-cream panels disappear.
- **`borderRadius` 14–18** — matches card radius elsewhere in the template.
- **Body wrapped in styled `<div>`** — Accordion's body is `dangerouslySetInnerHTML`d raw; without an outer `<div style="font-family:…;font-size:…;line-height:…;color:…">` it inherits the button's bold sans, looking off.
- **`iconColor`** — the +/− glyph defaults to inherit; setting it to the template accent keeps the glyph from disappearing on light panels.

## Anti-patterns (don't ship these)

- ❌ `<Accordion width="10" backgroundColor={PANEL} borderRadius="14" />` (no padding, no shadow, raw body)
- ❌ Multiple accordions with `width="12"` stacked — looks like a divider list, not cards.
- ❌ Body string with no wrapper styling — answer text inherits heading font.
