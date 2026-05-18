---
name: Opaque-block importer
description: importSettingsData() reconstructs SiteDesign from Kajabi settings_data.json; unknown block types wrapped __opaque + raw settings preserved via __settings; raw section types (products, blog_listings, login, etc.) become kind:"raw" sections; known blocks (text, cta, logo, etc.) reconstructed but full snake_case→camelCase inverse-serialize is a separate task. Lives at packages/engine/src/engines/importEngine.ts; exported from engine barrel; test at scripts/test-import-roundtrip.ts.
type: feature
---
## What it does
Inverse of `serializeTree`. Takes `{ current: { sections, content_for_<name> } }` (the shape Kajabi exports) and returns `{ design: SiteDesign, warnings, opaqueBlockTypes }`.

## Algorithm
1. Iterate `current.sections`. For each section:
   - `type: "header"` → `{ kind: "header", props: settings, blocks }`
   - `type: "footer"` → `{ kind: "footer", ... }`
   - `type: "section"` → `{ kind: "content", ... }`
   - anything else → `{ kind: "raw", type, settings, blocks, blockOrder, hidden }` (preserves products, blog_listings, blog_post_body, login, newsletter, etc. byte-identical)
2. For each block in a section, look up `type` in `KNOWN_BLOCK_TYPES` (built from every block component's `kajabiType`):
   - Known → `{ type, props: settings }` (passthrough; renderer handles snake_case)
   - Unknown → `{ type, __opaque: true, props: { __settings: settings } }` matching what `<OpaqueBlock>` reads + what serialize.ts emits verbatim
3. Walk every `content_for_<name>` array to assemble pages. Header (id `header`) and footer (id `footer`) prepended/appended to every page (matches Kajabi's shared-section model).
4. Always guarantee `pages.index` exists (mirrors serializer invariant).

## Round-trip guarantee (verified by test)
Opaque blocks survive **export → import → export byte-identical**: `newsletter_signup`, `offer`, any unknown type → settings preserved exactly. Raw sections (`products`) too. Test: `bun run test:import-roundtrip`.

## Known limitation
Known blocks reconstructed by passing snake_case settings as `props` directly. The renderer accepts snake_case in many cases but for full lossless round-trip of known blocks (e.g. text→html, padding_desktop→paddingDesktop) we need the full inverse of every block component's `.serialize()`. Tracked separately. Opaque path is the headline deliverable here.

## Public API
```ts
import { importSettingsData, getKnownBlockTypes } from '@k-studio-pro/engine';
const { design, warnings, opaqueBlockTypes } = importSettingsData(parsedJson);
```

## Why opaque > skipping
Opaque preserves Kajabi data we don't model. Future-proof: when Kajabi adds a new block type, imports don't lose it — they just render as a "passthrough" placeholder in the editor and re-export verbatim.
