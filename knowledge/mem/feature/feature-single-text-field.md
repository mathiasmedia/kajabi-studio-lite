---
name: feature block collapsed to single text field
description: featureHandler now mirrors Kajabi 1:1 with one `text` HTML field; legacy {heading, body, extraHtml} fold into text via harden() migration; setBlockHeading/Body splice into text; summary builder strips HTML for preview
type: feature
---
# Feature block: single `text` HTML field

The Kajabi `feature` block (`snippets/block_feature.liquid`) has ONE rich-text
field: `text`. We mirror that 1:1 to eliminate "which slot wins?" bugs.

## Value shape

```ts
interface FeatureValues { text: string; imageUrl?: string }
```

No `heading`, `body`, or `extraHtml` slots. The model edits a single field
with the FULL composed HTML (heading + body + decoration).

## Migration

Two equivalent migration surfaces, both using the same folding rule:

1. **Runtime (stored sites)** — `featureHandler.harden()` in
   `src/recipes/buildPresetRecipe.tsx` detects legacy `{heading, body, extraHtml}`
   on load and folds them into `text`.
2. **Build-time (engine exports)** — `normalizeLegacyFeatureContent()` in
   `src/engines/kajabiFieldSchema.ts` is the shared helper used by
   `buildFeatureBlock`, `exportParityAudit`, and `exportTransforms`. Rule:

```
text != null ? text : `${extraHtml ?? ''}${heading ? `<h3>${heading}</h3>` : ''}${body ? `<p>${body}</p>` : ''}`
```

Explicit `text` (including `''`) is always authoritative — legacy opts are
only folded when `text` was not provided. Legacy keys are then stripped so
they never re-emit to `settings_data.json`.

## Surgical ops still work

- `setBlockHeading` on a feature: replaces the first `<hN>...</hN>` in `text`
  (or prepends one), preserving body/decoration.
- `setBlockBody` on a feature: replaces the LAST `<p>...</p>` in `text`
  (or appends one), preserving heading/decoration.
- `setBlockField path="text"`: AI rewrites the whole HTML — preferred path
  because it's explicit.

## Summary surface (`src/lib/patchOps.ts → summarizeTree`)

For feature blocks:
- `preview`: stripped text inside the first `<hN>` (the visible card title)
- `body`: 200-char stripped snippet of the FULL `text` HTML so the AI can
  read the quote/body before rewriting
- `headings`: every `<hN>` tag actually present in `text`
- `has`: `heading` flag iff `text` contains an `<hN>`
- NO `extra_html` flag (that flag is now text-block-only)

## Sanitizer

`text` is run through `richHtml(8192)` from `_shared.ts` — strips dangerous
tags (`<script>`, `<iframe>`, `<img>`, on*= handlers, `javascript:` URLs)
but keeps block + inline (`h1-h6`, `p`, `div`, `span`, `ul`, `ol`, `li`,
`a`, `br`, `hr`, `strong`, `em`, `b`, `i`, `u`, `blockquote`, `small`,
`sub`, `sup`) plus `style`/`class`/`href`/`target`/`rel` attrs. `<img>` is
intentionally blocked so the model can't invent CDN URLs.
