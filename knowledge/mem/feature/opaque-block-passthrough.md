---
name: Opaque block passthrough
description: Mechanism for surviving Kajabi block types the engine doesn't model (offer, user, newsletter_signup, sidebar_*) — round-trips byte-identical via __opaque marker + OpaqueBlock React component + serializer fork
type: feature
---

**Problem solved:** Kajabi has dozens of block types we don't model in React (`offer`, `user`, `newsletter_signup`, `sidebar_*`, future Kajabi additions). Without passthrough, importing a real Kajabi site dropped them silently and re-export shipped a hole.

**Mechanism (4 pieces, all in engine package):**

1. **`DesignBlock.__opaque?: true`** (`siteDesign/types.ts`) — marker. When set, the importer also stored the original Kajabi `settings` on `props.__settings` verbatim.

2. **`<OpaqueBlock blockType settings />`** (`blocks/components/OpaqueBlock.tsx`) — placeholder React component. Carries static `__opaqueBlock = true` marker. Renders a read-only "passthrough" card in the editor preview showing the block type + field count.

3. **Renderer (`siteDesign/render.tsx → renderBlock`)** — when `block.__opaque`, emits `<OpaqueBlock>` instead of looking up `BLOCK_COMPONENTS`. The header/footer allowlist filter also lets opaque blocks through (Kajabi accepts header `dropdown`/`user`/`hello_bar` and other types we don't model).

4. **Serializer (`blocks/serialize.ts → collectBlocks`)** — detects `<OpaqueBlock>` via `isOpaqueBlockComponent` (checks static `__opaqueBlock`). Reads `blockType` + `settings` props and writes them straight into the section's `blocks[id] = { type, settings: {...settings} }` — no `BlockComponent.serialize()` call, no field validation, no schema enforcement.

5. **Validator (`engines/kajabiFieldSchema.ts → validateAndRepairSections`)** — for any block whose `type` is not in `BLOCK_FIELD_SCHEMAS`, treats it as opaque-passthrough: emits `level: 'warning'` instead of `blocking_error` on the allowlist check, and `continue`s past all field-type / section-only / min-content checks. Alias repair still runs (safe, only renames known aliases).

**Result:** byte-identical round-trips for unknown blocks. Future-proof against Kajabi adding new block types.

**Hard rule for AI:** NEVER author opaque blocks by hand in `design` JSON. They are produced ONLY by the importer for unknown Kajabi block types. Authored sites must use real block components (Logo, Text, CTA, Feature, etc.).

**Where opaque blocks come from in practice:**
- Kajabi import/parse path encounters a block type not in the React component map → tags it `__opaque: true`, copies original `settings` to `props.__settings`.
- That's it. No other production path creates opaque blocks.
