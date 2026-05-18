---
name: Kajabi block + section ID convention
description: Sections use unix-ms timestamp (e.g. "1593045036549"); blocks use "<section_id>_<index>" (e.g. "1593045036549_0"). Numbers + underscore only — never slugs.
type: reference
---

Kajabi's `settings_data.json` uses a strict ID convention; anything else is non-standard and looks foreign in the editor:

- **Section ID** = unix timestamp in milliseconds, as a string. Example: `"1593045036549"`.
- **Block ID** = `<section_id>_<block_index>`. Example: `"1593045036549_0"`, `"1593045036549_1"`, `"1593045036549_2"`.

Shape in `settings_data.json`:
```json
"1593045036549": {
  "name": "Text",
  "type": "section",
  "blocks": {
    "1593045036549_0": { "type": "text", "settings": { ... } },
    "1593045036549_1": { "type": "cta",  "settings": { ... } }
  }
}
```

These IDs render into the live DOM as `id="block-1593045036549_0"` and `class="... block-1593045036549_0 ..."` — that's what custom CSS targets.

**The `_N` suffix is the block's POSITION in the section (0-indexed), not a stable identifier.** `_0` = first block rendered, `_1` = second, `_2` = third, etc. If you reorder the blocks inside a section, the IDs follow the new order — the index is positional. So `#block-<sectionId>_1` reliably hits "the middle card in a 3-up grid" because it IS literally the block at index 1.

Implication for CSS targeting: when you write `customCss` against `#block-<sectionId>_N`, you're targeting "the Nth block in this section" — which is stable as long as the section's block order is stable. If you later insert a new block at position 0, every existing selector shifts by one. Plan section composition before writing the selectors.

**For our `__rawId` overrides**: when we need a stable ID for CSS targeting, follow the same convention:
- Pick a unix-ms-style numeric string for the section.
- Use `<sectionId>_<index>` for the blocks within it.

Slugs like `vanguard_price_mid` will work (Kajabi accepts arbitrary string keys), but they're **non-standard** and stand out in the editor. Always prefer numeric IDs.
