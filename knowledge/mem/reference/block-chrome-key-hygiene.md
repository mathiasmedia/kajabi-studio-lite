---
name: Block chrome props key hygiene (silent-drop trap)
description: Chrome props on every block MUST be camelCase, padding MUST be a 4-sided object — snake_case keys and scalar padding sit valid in JSON and produce zero visual effect
type: constraint
---

🚨 TWO silent-drop failure modes for chrome props on `feature` / `pricing_card` / `accordion` / `card` / any chrome-bearing block:

**1. Scalar padding is dropped.** `padding: "32"` (string) or `padding: 32` (number) → `paddingToCss` calls `normalizePaddingObject` → `JSON.parse("32")` returns `32` (number, not object) → returns `undefined` → NO padding rules emitted. Symptom: "I set padding 32 but text is flush to the edge."

**ALWAYS:** `padding: { top: "32", right: "32", bottom: "32", left: "32" }` — even for uniform 32-on-all-sides.

**2. snake_case keys are ignored.** The serializer (`packages/engine/src/blocks/blockChrome.ts`) only reads camelCase. Writing snake_case keys (copying Kajabi's Liquid field names) sits valid in JSON and does nothing.

| ✅ camelCase (correct) | ❌ snake_case (silently dropped) |
|---|---|
| `borderRadius: "16"` | `border_radius: "16"` |
| `backgroundColor: "#F3EAD6"` | `background_color: "..."` |
| `boxShadow: "small"` | `box_shadow: "small"` |
| `imageWidth: "480"` | `image_width: "480"` |
| `imageBorderRadius: "12"` | `image_border_radius: "12"` |
| `buttonBackgroundColor: "..."` | `btn_background_color: "..."` |
| `buttonTextColor: "..."` | `btn_text_color: "..."` |
| `buttonBorderRadius: "999"` | `btn_border_radius: "999"` |

**Why the confusion:** Kajabi's `settings_data.json` exports use snake_case — you SEE those keys reading exports/Kajabi guide. Engine React props are camelCase; serializer translates camelCase → snake_case at export. **Author camelCase in `design` JSON. snake_case is output-only.**

**Border radius gotcha:** value has NO `px` suffix. `"16"` correct; `"16px"` produces `16pxpx`.

**Symptom → diagnosis:**
- "padding 32 but text flush to edge" → scalar padding, expand to object
- "rounded corners but still square" → `border_radius` instead of `borderRadius`
- "background color isn't showing" → `background_color` instead of `backgroundColor`
- "shadow isn't applying" → `box_shadow` instead of `boxShadow`
- "feature image still tiny even though image_width 480" → `image_width` ignored, use `imageWidth` (also re-read §4.17)

**Pre-flight every block authored:**
1. Scan props for any underscore in chrome-prop keys → rename to camelCase, DELETE the snake_case key.
2. Confirm `padding` is the 4-sided object (never string/number).
3. Confirm `borderRadius` value has no `px`.

**Verified in code:** `serializeChromeProps(p)` + `getBlockChromeStyle(p)` destructure `p.padding`, `p.borderRadius`, `p.backgroundColor`, `p.boxShadow` directly. No snake_case fallback, no key normalization, no warning on unknown keys. Silent drop is the default.

See AGENTS.md §4.25.
