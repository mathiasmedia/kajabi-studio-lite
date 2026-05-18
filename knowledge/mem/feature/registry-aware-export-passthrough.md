---
name: Registry-aware export passthrough (Phase B3)
description: serializeTree consults the base-theme schema registry as a second-opinion allowlist; registry-only block types (dropdown/user/hello_bar/footer_pro blocks) survive to settings_data.json instead of being silently dropped
type: feature
---

**Engine 0.4.x+ (Phase B3 of the schema-registry rollout).** The hand-curated `HEADER_ALLOWED` / `FOOTER_ALLOWED` / `CONTENT_ALLOWED` sets in `packages/engine/src/blocks/sections.tsx` are no longer the sole authority for which block types can sit inside a section.

### What changed
`packages/engine/src/blocks/serialize.ts::walkSection` now consults the base-theme schema registry (built in Phase B1 from the 4 base-theme zips, ~14k fields, 62 sections) as a second-opinion allowlist. The new gate is:

```ts
if (
  !allowed.has(ChildType.kajabiType) &&            // hard-coded set (fast path, no theme needed)
  !isBlockAllowedByRegistry(flavor, ChildType.kajabiType)  // registry (auth source of truth)
) {
  console.warn(`[serialize] Block type "..." is not allowed in <flavor>Section (theme "...").`);
  return;
}
```

`isBlockAllowedByRegistry` resolves the registry section type from the React flavor (`header` → `header`, `content` → `section`, `footer` → `footer` or `footer_pro` for Pro themes) via `resolveRegistrySectionType`, then calls `getAllowedBlockTypes(theme, sectionType)`.

### Why
The hand-curated allowlists were missing block types that Kajabi's actual schemas accept (e.g. `dropdown`, `user`, `hello_bar` in headers; the Pro-only blocks under `footer_pro`). Engine maintainers had to manually mirror Kajabi's schema into `sections.tsx` every time the base theme changed. Now the schema registry IS that mirror — and it's regenerated from the source zips by `packages/engine/scripts/generateSchemas.ts`.

### Behavior matrix

| Call site | Hard-coded set | Registry consulted? | Net allowlist |
|---|---|---|---|
| `serializeTree(tree)` (no theme) | enforced | no | hard-coded only — same behavior as pre-B3, fail closed |
| `serializeTree(tree, { baseTheme: 'streamlined-home' })` | enforced first | yes, falls back to it | UNION of hard-coded + registry |
| `serializeTree(tree, { baseTheme: 'streamlined-home-pro' })` | enforced first | yes, with `footer_pro` rebinding | UNION; footer accepts Pro-only blocks |

### Verified by `scripts/test-serialize-registry-passthrough.ts`
- Without baseTheme: a fake `dropdown` block in `<HeaderSection>` is dropped with a warning. ✅
- With `baseTheme: 'streamlined-home'`: the same block survives and lands in `settings_data.current.sections.header.blocks` with `type: "dropdown"`. ✅

### What this does NOT change
- `<OpaqueBlock>` passthrough (importer-only, bypasses every allowlist) is unchanged.
- The `__opaque` block model for round-tripping unknown imported blocks is unchanged.
- Authoring guidance in AGENTS §4.27 stands: prefer the canonical block (logo for wordmarks, link_list for footer columns) because the renderer still needs a React component to draw registry-only blocks in the editor.
- Without a `baseTheme` argument, the silent-drop class returns — so any tooling that expects passthrough MUST pass `baseTheme` explicitly.

### Companion phases
- **B1** (`schemaRegistry.ts` + `schemas.generated.json`): build-time generator parses `{% schema %}` blocks from base-theme zips into a runtime-queryable JSON sidecar.
- **B2** (`kajabiFieldSchema.ts::validateAndRepairSections`): validator uses the registry for field-name + block-type validation when a theme is provided. Ghost fields surface as warnings instead of silent drops.
- **B3** (this entry): serializer uses the registry to decide which block types are allowed per section.

### Files touched
- `packages/engine/src/blocks/serialize.ts` — added `resolveRegistrySectionType` + `isBlockAllowedByRegistry` helpers; loosened the gate in `walkSection`.
- `scripts/test-serialize-registry-passthrough.ts` — smoke test.
- `AGENTS.md` §4.27 — note added under the schema table linking back here.
