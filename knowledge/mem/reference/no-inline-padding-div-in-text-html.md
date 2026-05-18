---
name: No inline padding div in block text HTML
description: Never wrap a feature/pricing_card/card/accordion text HTML in <div style="padding:..."> — button is a sibling of text inside chrome, so inline div pads text only and leaves button flush; use the block's chrome padding prop (4-sided object) instead. Verified Aurelian House services overview 2026-05-08.
type: constraint
---

🚨 **The trap.** When a `feature` (or `pricing_card`/`card`/`accordion`) needs internal padding around its copy, wrapping the entire `text` HTML in `<div style="padding:36px 36px 0 36px">…</div>` looks fine for the text but the block's button — rendered from `showButton:true` + `buttonText` — is a SIBLING of the text HTML inside the chrome, NOT a child of your inner `<div>`. Result: text is padded, button is flush to the card edges, card looks unbalanced.

**The rule.** Internal card padding ALWAYS goes on the block's chrome `padding` prop (4-sided object per `mem://reference/block-chrome-key-hygiene.md`), NEVER inline in HTML.

```jsonc
// ❌ Wrong
{ "type": "feature", "props": {
  "padding": { "top":"0","right":"0","bottom":"40","left":"0" },
  "showButton": true, "buttonText": "Explore →",
  "text": "<div style=\"padding:36px 36px 0 36px;\"><h3>…</h3><p>…</p></div>"
}}

// ✅ Right
{ "type": "feature", "props": {
  "padding": { "top":"36","right":"36","bottom":"36","left":"36" },
  "showButton": true, "buttonText": "Explore →",
  "text": "<h3>…</h3><p>…</p>"
}}
```

**Same rule for** inline `margin` / `background` / `border-radius` on a wrapper div around the whole text → lift to chrome `margin`/`backgroundColor`/`borderRadius`.

**Allowed inline styles in `text` HTML:** typography of individual elements (`<h3 style="font-family:...">`, `<p style="color:...">`), tactical paragraph spacing (`<p style="margin:0 0 12px 0">`), inline link colors. NOT card-level layout.

**Pre-flight on every feature/pricing_card/card/accordion save:** scan `text` HTML for leading `<div style="padding:` (or any layout-only wrapper div). If found, lift values into chrome props and strip the wrapper.

See AGENTS §4.25a (companion to §4.25 chrome key hygiene).
