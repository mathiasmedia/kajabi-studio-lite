---
name: setCtaPair op + extraHtml inline-HTML layering
description: Two-button hero/CTA layout via canonical inline HTML on a text block's ctaPairHtml field; general extraHtml slot for arbitrary inline patterns (badge strips, etc.) — all additive on top of structured eyebrow/heading/body, never replacing.
type: feature
---

## Layering contract (Phase 2)

The `text` block recipe (in `src/recipes/buildPresetRecipe.tsx`) renders, top to bottom:

1. **Structured fields** — `eyebrow` + `heading` (with `accentWord`) + `body`. ALWAYS render when non-empty.
2. **`extraHtml`** — arbitrary inline-HTML appended below body. For badge strips, "as seen in" rows, inline icon lists, secondary callouts. Set via `setBlockField path="extraHtml"`. Capped at 4KB.
3. **`ctaPairHtml`** — canonical two-button flexbox snippet. Written by the dedicated `setCtaPair` op. Suppresses the structured solo CTA (`ctaLabel`/`ctaUrl`) so we never get three buttons.
4. **Solo CTA button** — only when `ctaPairHtml` is empty AND `ctaLabel` is set.

**Back-compat fallback:** if heading + body + eyebrow are ALL empty AND the raw `text` field has content, `text` renders directly. Preserves legacy trees where the planner wrote straight to `text`.

The Phase 1 bug ("rawText replaces everything") is fixed: structured fields now always win. The model can never accidentally nuke the heading by setting raw HTML.

## setCtaPair op

Kajabi has no native "two buttons side-by-side" primitive. Faking it with two text blocks (width 8/4) collapses on mobile and orphans the secondary CTA.

`setCtaPair` (in `src/lib/patchOps.ts`) writes a canonical inline-HTML flexbox snippet into the target text block's `ctaPairHtml` field. The op also clears `ctaLabel` + `ctaUrl` for safety.

### Op shape

```ts
{
  op: 'setCtaPair',
  sectionIndex: number,
  blockIndex: number,
  primary:   { label: string, href?: string },
  secondary: { label: string, href?: string, style?: 'outline' | 'ghost' },
  brandColor?: string,       // defaults to block's brandColor or #0F766E
  foregroundColor?: string,  // defaults to #FFFFFF (good for dark heroes)
}
```

Target MUST be a `text` block in a `dynamic.*` section — anything else throws.

## extraHtml (general escape hatch)

For patterns Kajabi has no native primitive for, use `setBlockField path="extraHtml"` on a text block. Inline styles only. Use sparingly — prefer `setCtaPair` for two CTAs and `addBlock feature/card` for icon rows or card layouts. `extraHtml` is the escape hatch, not the default.

## Summary signal

`summarizeTree` flags blocks with `ctaPairHtml` as `has: ['button', 'cta_pair']` and blocks with `extraHtml` as `has: ['extra_html']`, so the model can refuse honestly when the user references content the page doesn't actually contain.

## System prompt

The chat-refine system prompt lists `setCtaPair` as op #12 and `extraHtml` as op #13, with explicit forbid-rules against the `addBlock`-sibling-text-block hack and against writing raw HTML to the `text` field when structured heading/body are populated.
