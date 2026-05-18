---
name: Text button color quirk (Pro)
description: For btn_style "text", the visible color comes from the dark/light pair slot matching btn_type — NOT from buttonTextColor. Default btn_type is "dark" so accent goes on buttonBackgroundColor.
type: constraint
---

🚨 Verified in `streamlined-home-pro/snippets/block_cta.liquid` lines 181–211.

When `btn_style: "text"`, Pro takes the visible link color from the **dark/light button pair** according to `btn_type`:

- `btn_style: "text"` + `btn_type: "dark"` (default) → color = `btn_background_color`
- `btn_style: "text"` + `btn_type: "light"` → color = `btn_text_color`

**Mnemonic:** "the color matches `btn_type`." For a default (dark) text button, the accent goes on `buttonBackgroundColor`, NOT `buttonTextColor`.

**Why it's confusing:** the field NAMED `btn_text_color` is the LIGHT half of the pair (per §9.8a), not "the text color of this button". `buttonTextColor: "#A88251"` on a default text button is a silent no-op — link renders in body color.

**Fix:**
```jsonc
// ❌ Silently broken
{ "buttonStyle": "text", "buttonTextColor": "#A88251" }

// ✅ Right — dark text button (default)
{ "buttonStyle": "text", "buttonBackgroundColor": "#A88251" }

// ✅ Right — light text button (if exposed)
{ "buttonStyle": "text", "buttonType": "light", "buttonTextColor": "#FBF8F2" }
```

**Pre-flight whenever you set `buttonStyle: "text"`:**
1. Decide dark or light (default: dark).
2. Put accent on the slot matching the type (`buttonBackgroundColor` for dark, `buttonTextColor` for light).
3. Leave the other slot empty `""`.
4. When auditing: text buttons with `buttonTextColor` set but `buttonBackgroundColor` empty are silently broken — swap them.

Solid + outline buttons keep the intuitive mapping (`buttonBackgroundColor` = bg, `buttonTextColor` = text). Quirk is **only** on `buttonStyle: "text"`.

Full reference: AGENTS.md §4.16.
