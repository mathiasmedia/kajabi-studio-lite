---
name: Bundle assets relative-URL extension bug
description: bundleAssets.ts extractExtension() threw on relative `assets/<hash>.jpg` refs (imported sites), defaulted to `.bin` — Kajabi can't render. Fixed in engine 0.4.4.
type: reference
---
**Symptom (verified site cf550fb4 on engine ≤0.4.3):** Site imported from a Kajabi zip, then re-exported. Bundled zip contains all images but with `.bin` extensions (`b0f44cea681f490b.bin` etc.). Kajabi's `asset_url`/`image_picker_url` filters can't render `.bin` as images → live site shows broken/missing images. `[bundleAssets] Bundled 16 asset(s), 0 failed` logs successfully (bytes ARE bundled, just wrong extension).

**Root cause:** `packages/engine/src/engines/bundleAssets.ts::extractExtension(url, contentType)` called `new URL(url)` to parse pathname. For imported entries, `entry.sourceUrl` is a relative path like `"assets/85aa8622d822548e.jpg"`. `new URL()` rejects relative URLs → throws → catch returns fallback `'bin'`. The pathname-regex never ran.

**Fix (engine 0.4.4):** Try `new URL().pathname` first; on throw, fall back to manual querystring/fragment strip + same `/\.([a-z0-9]{2,5})$/i` regex against the raw string. Handles both absolute (`https://.../foo.jpg?x=1`) and relative (`assets/foo.jpg`) refs.

**Pre-flight when touching bundleAssets:** any helper that calls `new URL(entry.sourceUrl)` must guard against the imported-asset relative-path branch (line 492 sets `source: 'imported'` with bare `assets/...` ref).
