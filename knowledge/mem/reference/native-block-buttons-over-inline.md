---
name: Native block buttons over inline anchors
description: For feature/pricing_card CTAs ("Explore →", "Learn more"), use native button props (showButton + buttonStyle "text") not inline <a> in HTML — same lift-into-template rule as §9.8e
type: preference
---

When a card-style block (`feature`, `pricing_card`) needs a CTA link at the bottom ("Explore →", "Learn more", "Read story"), use the block's native button props — NEVER bake an `<a>` tag into the HTML `text` field.

**Why:** inline `<a>` in HTML bypasses Kajabi's global button system (Style Guide can't restyle it, dark/light pair can't apply, no per-block `btn_*` overrides). Inline buttons are also invisible to the §4.7 "audit every CTA before changing one" pass — they silently drift out of brand consistency.

**How to apply:**
- `feature` block → set `showButton: true`, `buttonText`, `buttonUrl`, `buttonStyle: "text"` (for low-emphasis explore links — `feature` accepts `text` style; Pro renders full `block_cta` text-link styling), `buttonTextColor` (the site accent color), `buttonSize: "small"`. Then strip the inline `<a>` from `props.text`.
- `text` block → has no native button. Use a SIBLING `cta` block in the same section/column instead of inline `<a>`.
- `image` block → use `imageHref` for click-the-image; sibling `cta` block for any text CTA.

**Allowed inline `<a>` cases:** (a) link inside a sentence ("read about our [process]..."), or (b) multiple links in the same paragraph. Standalone CTA at the bottom of a card → native button.

**Pre-flight check:** on every site edit, scan every `feature` / `pricing_card` text HTML for trailing `<p>...<a>...</a></p>` or `<a class="button">` / `<a style="...border:1px...">`. Lift each into `showButton: true` + `button*` props.

**Consistency:** all `feature` buttons on a site should share `buttonStyle`, `buttonTextColor`, `buttonSize` (§4.7).

Full reference + canonical example: AGENTS.md §4.15.
