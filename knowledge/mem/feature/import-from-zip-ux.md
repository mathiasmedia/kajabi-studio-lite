---
name: Import-from-zip UX
description: "Import Kajabi site" menu item on the dashboard — drop a .zip, get a new site row with all blocks (including unmodeled types) preserved + visualization of preserved blocks on the dashboard card and in the editor preview
type: feature
---
Engine 0.3.23+ ships `importSiteFromZip(blob)` (`packages/engine/src/engines/importZip.ts`) which composes JSZip + `importSettingsData` and detects `kind` (landing_page vs site, by looking for `templates/index.liquid` or template count >=4) and `baseTheme` (from `theme.json` meta or kind default).

Dashboard wiring (`packages/engine/src/shell/pages/SitesDashboard.tsx`):
- New menu item "Import Kajabi site" in `NewMenu` (alongside New website / New landing page)
- `ImportSiteDialog`: file picker → parses on-select → shows detected kind/baseTheme/page count/opaque block summary → name input → Import button
- Calls new `createSiteFromImport({ name, brandName, kind, baseTheme, design })` siteStore helper which inserts the row with the imported design verbatim (bypasses `buildBlankDesign`)
- Navigates to the new site editor on success
- Shows toast warning when opaque blocks were preserved with a list of types

Round-trip is byte-identical for unknown blocks (per `mem://feature/opaque-block-passthrough.md`). Operators can now drop any Kajabi expert's existing theme zip and get an editable site instantly.

## Engine 0.3.24 — visualization

Operators couldn't tell at a glance which sites were imported vs newly created, or how many "preserved" Kajabi-native blocks an imported site contained. Two upgrades:

1. **Dashboard "Imported" badge** — `ItemCard` in `SitesDashboard.tsx` shows an indigo `Imported` chip next to the Pro/Standard chip whenever `isImportedTemplateId(site.templateId)` matches (`'imported'` or `'landing-page-imported'`). When the site contains opaque blocks, the chip also shows `· N preserved` and a hover tooltip lists the per-block-type breakdown (`offer × 2, newsletter_signup × 1, …`).

2. **OpaqueBlock placeholder upgrade** — `packages/engine/src/blocks/components/OpaqueBlock.tsx` now renders a bordered indigo-tinted card with a `passthrough` tag, the Kajabi block type in monospace, the field count, an explanatory line ("Kajabi-native block — not editable here, but exports verbatim. Edit in Kajabi after publishing."), and a comma-separated preview of the first 6 settings keys (with `+N more` overflow). The `title` attribute on the wrapper exposes the full settings JSON as a browser tooltip for inspection.

Helpers live at `packages/engine/src/siteDesign/opaqueBlocks.ts` and are re-exported from the engine barrel:
- `countOpaqueBlocks(design)` — total `__opaque: true` blocks across every page
- `countOpaqueInSection(section)` — per-section count
- `summarizeOpaqueBlockTypes(design)` — `{ blockType: count }` map
- `isImportedTemplateId(templateId)` — boolean for `'imported'` / `'landing-page-imported'`

Raw sections are intentionally NOT counted as opaque blocks — the whole section is raw, and counting their inner blocks would inflate numbers without giving operators useful signal.
