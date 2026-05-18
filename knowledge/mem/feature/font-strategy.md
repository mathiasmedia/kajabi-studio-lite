---
name: Font strategy
description: Single source of truth — every TemplateDef declares `fonts: { heading, body, extras? }`. SiteEditor preview injects a Google Fonts <link> for those families; export passes them to exportFromTree's `global` so settings_data.json @imports them too. Same families render in preview AND export.
type: feature
---

# Template fonts — one declaration, two consumers

Every `TemplateDef` MUST declare its web fonts in a single `fonts` field:

```ts
export const myTemplate: TemplateDef = {
  // ...
  fonts: {
    heading: 'Cormorant Garamond', // Google Fonts family name
    body: 'Inter',
    extras: ['Caveat'],            // optional — other families used inline
  },
};
```

## Two consumers read this declaration

1. **Preview** (`src/pages/SiteEditor.tsx`): a `useEffect` builds a Google
   Fonts URL from `tpl.fonts` and appends a `<link rel="stylesheet">` to
   `document.head` on mount, removes it on unmount/template change. The
   preview iframe now renders the same families the export ships.

2. **Export** (`SiteEditor.handleExport`): builds a `TreeGlobal` —
   `{ headingFont, bodyFont, fontImports }` — and passes it as
   `exportFromTree(trees, { global, ... })`. The existing
   `injectGlobalCss` pipeline (in `src/blocks/export.ts`) resolves families
   via `fontStrategy.ts`, generates `@import` URLs + CSS vars, and writes
   them into `settings_data.json`'s global `css` field.

## Rules for new templates

- ALWAYS set `fonts` on the `TemplateDef`. Without it, the preview falls
  back to system fonts and the user sees Georgia / system sans where the
  export will load Cormorant / Inter.
- Family names should match `fontStrategy.ts`'s `GOOGLE_FONTS` whitelist
  (or its aliases). Unknown families speculatively load and may 404.
- `extras` is for inline-only fonts (e.g. a script accent on one block).
  If a font appears in `style="font-family:..."` but NOT in `fonts`, both
  preview and export will fall back.
- NEVER hardcode font `<link>` tags in `index.html`. Per-template
  declaration + dynamic injection is the only correct pattern — otherwise
  font lists drift between preview and export.

## Files
- `src/lib/templates.ts` — `TemplateDef.fonts` field
- `src/pages/SiteEditor.tsx` — preview link injection + export wiring
- `src/blocks/export.ts` — `injectGlobalCss` (export side)
- `src/engines/fontStrategy.ts` — Google Fonts whitelist + resolver
