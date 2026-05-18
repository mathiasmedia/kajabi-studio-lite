---
name: Vite alias trailing-slash bug breaks engine deep imports
description: Thin client vite.config alias `{ find: /^@\/blocks\//, replacement: path.resolve(...) }` mangles deep paths because path.resolve strips trailing slash; symptom is sliders/tabs rendering blank or 1-up while text/cta/image blocks work fine
type: reference
---

## Symptom

On a thin client, Slider/Tabs (and other engine modules with deep imports) render blank, 1-up, or fall back to a stub — while simple blocks (text, cta, image, logo) render correctly. `bun update @k-studio-pro/engine` does NOT fix it; often makes it worse as new engine versions add more deep imports.

## Root cause

Vite alias of the form:

```ts
{ find: /^@\/blocks\//, replacement: path.resolve(__dirname, "./node_modules/@k-studio-pro/engine/src/blocks/") }
```

`path.resolve` **strips the trailing slash** → returns `".../blocks"`. The regex `/^@\/blocks\//` consumes the slash from the import specifier. Result:

- `@/blocks/components/Slider` → `".../blocks"` + `"components/Slider"` → `".../blockscomponents/Slider"` ❌

Vite fails to load the mangled module. The engine's `@/blocks/index.ts` barrel does deep re-exports; when one fails, Swiper-backed components like Slider silently fall back to single-slide rendering (Swiper's defensive init), so the bug looks like "sliders are broken" rather than "module not found."

Same bug pattern affects every alias that uses the `/^@\/foo\//` regex form: `@/blocks`, `@/engines`, `@/lib/siteDesign`, `@/types`.

## Fix

Append `/` to the replacement so `path.resolve`'s slash-stripping is undone:

```ts
{ find: /^@\/blocks\//, replacement: path.resolve(__dirname, "./node_modules/@k-studio-pro/engine/src/blocks") + "/" }
```

Equivalent alternatives:
- `{ find: /^@\/blocks($|\/)/, replacement: ... }` — match optional trailing slash
- Use array-of-strings alias form (Vite handles slash internally)

## Why it's latent until it isn't

Older engine versions (≤0.1.14) had few deep imports — most code lived in `index.ts`. Bug existed but didn't surface. Engine 0.1.16+ split Slider/Tabs/PreviewHelpers into their own files; thin clients started hitting the broken alias on `bun update`.

## Permanent fix

Run AGENTS §8.0 migration (`migrate to engine package`) — deletes local `src/blocks/` etc. and points aliases at `node_modules/@k-studio-pro/engine` cleanly. Eliminates the regex-rewrite resolution path entirely.

## Diagnostic

If a thin client reports "sliders/tabs broken but text blocks fine" after a `bun update`:
1. Check `vite.config.ts` resolve.alias — any `/^@\/.../` regex with `path.resolve(...)` replacement is suspect.
2. Verify by running `vite --debug` and watching for "failed to resolve" errors with mangled paths like `blockscomponents`.
3. Apply trailing-slash fix OR run §8.0 migration.
