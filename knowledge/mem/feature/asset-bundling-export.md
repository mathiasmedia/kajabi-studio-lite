---
name: Asset bundling export pipeline
description: Bundles every external image URL into the exported theme zip as the PRIMARY (only) image source. JSON URL is stripped after bundling so exports are fully self-contained — no Supabase dependency at runtime.
type: feature
---

# Asset bundling export pipeline (verified working)

## The problem this solves
Kajabi's image picker (`image_picker_url` Liquid filter) reliably renders external `https://` URLs in `bg_image` / `image` JSON fields — EXCEPT in some encore-page-pro landing-page contexts where Kajabi's import pipeline strips or rewrites them, leaving sections rendering as their fallback color (usually black) on the live site even though the preview was perfect. v5/v7 of the event landing page were the first exports that survived Kajabi import with all images intact.

**Beyond that bug, there's a longer-term concern:** even when external URLs DO work, every exported zip becomes a hostage to the Supabase CDN. If that hosting ever goes down (or the bucket is rotated, or a row is deleted), every shipped Kajabi site silently loses its imagery. Self-contained zips eliminate that risk.

## The verified mechanism (NOT a JS shim — it's a Liquid snippet)

The export bundles real image bytes into the theme's `/assets/` folder AND injects `snippets/bundled_assets.liquid` that maps section/block IDs to those filenames. Three caller snippets (`section_styles`, `block_image`, `block_feature`) are patched so they consult the bundle resolver as the **PRIMARY** source. The JSON `bg_image` / `image` fields are stripped after bundling — they're no longer in the codepath.

### snippets/bundled_assets.liquid

```liquid
{%- comment -%}
  Bundled-asset resolver. Maps section.id and block.id to a filename in /assets/.
  Returns `bundled_asset_url` (empty string if no match).
{%- endcomment -%}
{%- assign bundled_asset_url = '' -%}
{%- if kind == 'section' -%}
  {%- case id -%}
    {%- when '1777637325857' -%}{%- assign bundled_asset_url = '0378e5060620eb57.jpg' | asset_url -%}
  {%- endcase -%}
{%- elsif kind == 'block' -%}
  {%- case id -%}
    {%- when '1777637325872' -%}{%- assign bundled_asset_url = '80b69f71cb2b3607.jpg' | asset_url -%}
  {%- endcase -%}
{%- endif -%}
```

### Caller patch in snippets/section_styles.liquid (bundle-as-primary)

```liquid
{% if section.settings.bg_type == "image" %}
  #section-{{ section.id }} {
    {%- include 'bundled_assets', kind: 'section', id: section.id -%}
    {%- if bundled_asset_url != blank -%}
      {%- assign _section_bg_url = bundled_asset_url -%}
    {%- else -%}
      {%- assign _section_bg_url = '' | image_picker_url: "background.jpg" -%}
    {%- endif -%}
    background-image: url({{ _section_bg_url }});
    background-position: {{ section.settings.bg_position }};
  }
{% endif %}
```

Same shape in `block_image.liquid` (placeholder `'placeholder.png'`, var `_image_url`) and `block_feature.liquid` (placeholder `'feature.png'`, var `_feature_image_url`). All three patches replace the upstream half of the existing pipe chain (`block.settings.image | image_picker_url: 'placeholder.png'` → `_image_url`) so any downstream filters (`| image_tag: ...`) keep working unchanged.

## Bundle is the ONLY source — JSON URL is stripped

Previous design kept the original `https://` URL in `bg_image` / `image` as a "primary tier" with the bundle as fallback. That's REMOVED. After bundling, the engine sets the field to `""`. Reasons:

1. **Self-contained.** The exported zip stands alone. No external CDN dependency. If Supabase Storage goes down in 5 years, every shipped Kajabi site keeps working.
2. **No silent ambiguity.** With both tiers, an outsider reading `settings_data.json` can't tell which one the live site is actually using. Stripping forces the bundle to be the source of truth.
3. **Simpler Liquid.** Two-branch (`bundle | placeholder`) is half the cognitive load of three-branch (`json | bundle | placeholder`).

If a download fails during bundling, the URL is **left in place** so the live site has at least a chance — but the snippet patch no longer reads it. (The placeholder will render instead.) That failure already shows up as `failed > 0` in the export report, so the operator knows.

## Supabase remains the source of truth — for re-exports only
The image URL written to `bg_image` / `image` in the LIVE `design` JSON (the one master holds in the database) is still the permanent Supabase Storage URL from `upload-site-image` / `generate-site-image`. On every re-export, the engine `fetch()`es those bytes fresh from Supabase to bundle into the new zip. **Without Supabase, every re-export would require the expert to re-upload everything.** The bundle is a disposable copy generated per-export; Supabase is the home for the source bytes.

The KEY distinction: Supabase is depended on at **export time** (one-shot, in the engine). It is NOT depended on at **render time** (every Kajabi page view). The shipped zip has zero references to the Supabase host.

## Default ON for both site and landing_page kinds
`bundleAssets: true` is the default in `ExportThemeZipOptions`. Set to `false` only for debugging or if you explicitly want the legacy behavior (URLs trusted directly).

## Image compression (engine 0.3.51+) — keeps zips under Kajabi's 10MB upload cap

`bundleAssets()` accepts an options object (`{ compressImages?, maxEdgePx?, quality?, minSourceBytes? }`). Defaults: compress on, max edge 2000px, JPEG quality 0.82, skip files smaller than 150KB. For each downloaded image we:

1. Skip SVG (vector — already small) and files below `minSourceBytes` (icons/logos rarely benefit; re-encoding can grow them).
2. Decode via `createImageBitmap` (browser-only — Node test runners get the original bytes).
3. Resize so the longest edge ≤ `maxEdgePx`, draw to `OffscreenCanvas` (or `<canvas>` fallback), re-encode as JPEG at `quality`.
4. Use the new bytes ONLY if they're < 90% of the original — otherwise keep the source.
5. When re-encoded, the bundled filename's extension flips to `.jpg` (the bundle resolver maps section/block ID → whatever filename was emitted, so this is invisible to Liquid).

Verified on the studio-meridian site (10 PNG photos, 13.9MB total → ~1.3MB after re-encode at default settings; 16× compression on AI-generated photos). The "exceeds maximum allowed size of 10 MB" Kajabi import error this fixes was the trigger for adding compression in the first place.

`BundleResult` now reports `totalOriginalBytes` + `totalBundledBytes` + per-entry `originalBytes` / `bundledBytes` / `compressed` so the export report shows how much was saved.

To opt out (e.g. when shipping a logo grid where source PNGs MUST stay PNG): `exportThemeZip(..., { /* no per-image override yet — pass bundleAssets directly to bundleAssets() in custom flows */ })`. The default options on `exportThemeZip` cover the 99% case.


## Implementation in code
- **`packages/engine/src/engines/bundleAssets.ts`** — pure pipeline. Takes a JSZip + rootPrefix, walks `settings_data.json` for external URLs, downloads + writes assets, emits `bundled_assets.liquid`, patches the three snippets, strips JSON URLs, re-writes `settings_data.json`. Idempotent (using `crypto.subtle.digest` SHA-256 → first 8 bytes hex → stable filenames).
- **`packages/engine/src/engines/exportEngine.ts`** — calls `bundleAssets(zip, rootPrefix)` after templates are emitted, before the export report is built. Bundle stats land in `export_report.json` under `assetBundle`.

## Failure modes to watch
- If a base theme's `block_image.liquid` differs structurally from the verified shape (no `block.settings.image | image_picker_url: 'placeholder.png'` substring), the patch silently no-ops. Confirm by inspecting `snippets/block_image.liquid` after export — it should start with the `{%- include 'bundled_assets' -%}` block.
- If a section/block id used in the map doesn't actually exist in `settings_data.json` (stale), the snippet still ships harmlessly — the `case` just never matches and the placeholder renders.
- Section/block IDs MUST match between JSON and snippet — they are the join key. Both come from the same walk of `settings_data.current.sections`, so they always agree.
- Bundle-as-primary means: if `bundleAssets: false` AND Kajabi strips the JSON URL on import → black sections. The escape hatch is intentional but only to be used when debugging.

## Verified with
- `event-page-bundled-v7.zip` — uploaded successfully as Landing Page in Kajabi, all 9 bundled images rendered correctly on live site.
- `encore-page-pro` base theme.
- Engine smoke test against synthetic settings_data + 3 picsum.photos URLs — bundling, dedup (one URL → one filename, two sections share it), JSON stripping, all three snippet patches verified end-to-end.
