---
name: Import-zip asset rehydration + Liquid preview asset URLs
description: How imported Kajabi zips get their bundled images back into design JSON AND into the Liquid preview (editor + dashboard thumbnail). Covers the two silent-failure modes verified 2026-05.
type: reference
---

# Import-zip asset rehydration + Liquid preview asset URLs

Two-part fix for "I exported a site, re-imported the zip, and the images are placeholders" — verified end-to-end in engine 0.3.72 / 0.3.73.

## Part 1 — Re-hydrate `bg_image` / `image` from `bundled_assets.liquid` on import

**The trap.** Our exporter (`bundleAssets.ts`, see `mem://feature/asset-bundling-export.md`) **strips** the external URL from `settings_data.json` after bundling — the `bg_image` / `image` fields end up `""`. The bytes live in `assets/<hash>.<ext>` and the section/block-id → filename map lives in `snippets/bundled_assets.liquid`. If the importer doesn't read that snippet, every imported site boots with empty image fields and renders placeholders forever.

**The fix lives in `packages/engine/src/engines/importZip.ts`.** Before calling `importSettingsData(parsed)`:

1. Open `snippets/bundled_assets.liquid`. Parse the two `{%- case id -%}` blocks (split on `elsif kind == 'block'`) with the regex `/when\s+'([^']+)'\s*-?%}\s*\{%-\s*assign\s+bundled_asset_url\s*=\s*'([^']+)'/g` to build `sectionMap` + `blockMap` (id → filename).
2. Walk `parsed.current.sections`. For each section whose id is in `sectionMap` and whose `settings.bg_image` is empty, set `settings.bg_image = "assets/<filename>"` and force `settings.bg_type = "image"` if it's `none`/missing.
3. Same loop for blocks: empty `settings.image` → `"assets/<filename>"`.

The `assets/<file>` form is what `loadSiteAssetMap` already knows how to resolve from the persisted zip at render/export time.

## Part 2 — Liquid preview must consume the asset map (TWO places)

**The second trap.** Even after Part 1, the React preview rendered images correctly but the **Liquid previewer** (`LiquidPagePreview` in `packages/engine/src/preview-liquid/`) ignored the asset map entirely — `image_picker_url` saw `assets/<file>.jpg` and returned it as a literal relative URL, which the iframe couldn't fetch. Symptom: section background images load, block images don't (because section bg goes through CSS in a different snippet).

**The fix touches three files plus the dashboard preview:**

1. `preview-liquid/engine.ts` — extended the `image_picker_url` filter so any `assets/<file>` or `file-uploads/...` ref is resolved through the engine's `assetUrls` Map (which holds blob URLs minted from the persisted zip) BEFORE falling through to `normalizePreviewAssetRef`.
2. `preview-liquid/renderSection.ts` — added `extraAssetUrls?: Map<string,string>` to `RenderSectionInput`; merges into the engine's base `assetUrls` via `new Map([...assetUrls, ...input.extraAssetUrls])` before `createLiquidEngine`.
3. `preview-liquid/LiquidPagePreview.tsx` — added `assetUrls?: Map<string,string>` prop, passes it as `extraAssetUrls` into every `renderKajabiSection` call.
4. `shell/pages/SiteEditor.tsx` — passes `assetUrls={assetMap?.urls}` (where `assetMap` already comes from `loadSiteAssetMap`) to `<LiquidPagePreview>`.
5. `siteDesign/SitePreview.tsx` — the **dashboard thumbnail** also uses `LiquidPagePreview`, so it had the same gap. Added `importedZipPath?: string | null` to `SitePreviewSite`, a `useEffect` that calls `loadSiteAssetMap(site.importedZipPath)` on mount, and `assetUrls={assetMap?.urls}` on the embedded `<LiquidPagePreview>`.

## Symptom → diagnosis

- "Imported the zip but every image is a placeholder" → Part 1 missing (importer didn't parse `bundled_assets.liquid`).
- "Section background images render but block images don't" in editor preview → Part 2 #1–#4 (Liquid previewer not consuming assetUrls).
- "Editor preview shows images, dashboard thumbnail doesn't" → Part 2 #5 (SitePreview not loading the asset map).

## Re-import requirement

The Part 1 fix only runs at import time. Sites imported **before** the fix have empty `bg_image`/`image` strings persisted in `design` and need to be re-imported from the same zip to rehydrate. There is no migration — the zip is the source of truth for the bundled-asset filenames.
