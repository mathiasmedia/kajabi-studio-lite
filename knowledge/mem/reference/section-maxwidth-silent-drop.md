---
name: Section maxWidth is renderer-only (silent-drop on export)
description: Section-level maxWidth/width are dropped by Kajabi serializer; constrain layout via 12-col block grid (width 6/8/10) + align center, never via section CSS
type: constraint
---

🚨 **Verified silent-drop.** `ContentSection` props like `maxWidth: 920` work in the Lovable preview (renderer applies the CSS clamp) but Kajabi's `settings_data.json` section schema has NO `max_width` field, so the serializer drops the prop. Live site renders the section at full container width and any inner block with `width: "12"` goes edge-to-edge. Tidy in preview, full-bleed in Kajabi.

**The rule:** never use section-level `maxWidth` (or any renderer-only CSS) to constrain inner column width. Use Kajabi's 12-column block grid:

| Visual goal | Block `width` | Block `align` |
|---|---|---|
| Tight reading column | `"6"` | `"center"` |
| Standard centered (accordion/FAQ/agenda) | `"8"` | `"center"` |
| Loose centered | `"10"` | `"center"` |
| Full bleed | `"12"` | center/left |

Apply the chosen width to EVERY block in the section, including the section-heading `text` block — otherwise the heading goes full-bleed while the accordions sit centered, breaking visual rhythm.

**Forbidden on `ContentSection` props (all silently dropped on export):**
- `maxWidth` (any value)
- `width` on the section itself
- Inline `<style>` / `<div style="max-width:...;margin:0 auto">` wrappers inside `text` HTML to clamp width

**Symptom → diagnosis:**
- "centered narrow in preview but full-bleed on Kajabi" → section has `maxWidth` set; inner blocks are `width: "12"`
- "FAQ accordions stretch edge-to-edge on live site" → same root cause
- "agenda fine here, huge after export" → same

**Fix:** delete `maxWidth` from section props; rewrite every block inside to `width: "8"` (or `"6"`/`"10"` per the recipe) + `align: "center"`. The 12-col grid is the only width primitive that survives export.

**Companion rule:** §4.12 forbids the inverse mistake (`fullWidth: true` to break OUT of the container). Both bugs share the same root cause — trying to control layout with section-level props instead of the block grid Kajabi actually serializes.

See AGENTS.md §4.28 and `mem://feature/preview-grid-parity.md` (which confirms preview honors the 12-col grid identically to Kajabi).
