---
name: readField dual-shape prop reader
description: Engine 0.6.10+. `readField(props, ...keys)` from `@k-studio-pro/engine` lets block components tolerate both camelCase author shape and snake_case Kajabi-schema shape. Use it whenever a registry field flows through the schema-driven editor but the block component reads the camelCase alias.
type: feature
---

# `readField` — dual-shape prop reader

Shipped in engine **0.6.10**. Source: `packages/engine/src/blocks/readField.ts`. Exported from the engine barrel and from `@k-studio-pro/engine/blocks`.

## Why it exists

After Phase 1+2 (schema-driven `BlockFieldForm`, registry-aware export passthrough, hardcoded-default cleanup):
- ✅ Editor surfaces every registry field automatically.
- ✅ Author values reach `settings_data.json` correctly (passthrough inversion in `serialize.ts` keeps unknown snake_case keys verbatim).
- ✅ Re-import round-trips losslessly via `importSettingsData`.

**Remaining gap — render time only.** When the editor writes a field that has no `.deserialize()` alias in the block component, the JSON ends up with the snake_case key (`btn_background_color`, `input_label`). The block reads camelCase (`buttonBackgroundColor`, `inputLabel`). Save: ✅. Export: ✅. Preview: ❌ (renders default).

## The fix

```ts
import { readField } from '@k-studio-pro/engine';

const bg = readField<string>(props, 'buttonBackgroundColor', 'btn_background_color');
const label = readField<string>(props, 'label', 'buttonText', 'btn_text');
```

First non-empty match wins. Returns `undefined` if every alias is empty/null/missing — preserves existing default-fallback patterns (`readField(...) ?? '#000'`).

## When to apply it

**On demand, not pre-emptively.** The default for new code: keep using `props.buttonBackgroundColor`. The first time someone reports "I edited X in the new field editor and the preview ignored it":

1. Find the camelCase prop name the block reads.
2. Find the snake_case schema field id (in `schemaRegistry.ts` or the matching `block_*.liquid` `{% schema %}`).
3. Wrap the read with `readField(props, '<camel>', '<snake>')`.

That's it. One line per gap, zero risk.

## What this is NOT

- ❌ Not a DB migration — existing `props` shapes are untouched.
- ❌ Not a forced retrofit — only patch blocks when a real preview gap appears.
- ❌ Not for chrome props — those go through `serializeChromeProps` / `getBlockChromeStyle`, which are camelCase-only by design (see `mem://reference/block-chrome-key-hygiene.md`).

## Architecture position

This closes the last bug class from the "schema-driven editor" thread:
1. ✅ Schema-driven editor (BlockFieldForm)
2. ✅ Hardcoded-default cleanup (SearchForm, etc.)
3. ✅ Author-wins export (registry passthrough inversion in serialize.ts)
4. ✅ **Render-time tolerance (this)** — apply `readField` per-block as gaps surface.

No further structural work needed for forward correctness. Existing sites are untouched (the gaps that already exist in their JSON will surface as preview misses if/when they're re-edited; one `readField` per affected block fixes them).
