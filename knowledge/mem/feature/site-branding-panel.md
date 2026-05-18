---
name: Sitewide branding panel
description: design.branding (2 colors + 2 fonts) + 🎨 toolbar button + DEFAULT_BRANDING fallback + export_report.json round-trip; lightweight equivalent of Kajabi's account-level Branding panel
type: feature
---
Engine 0.3.47+. Optional `design.branding: SiteBranding` field on `SiteDesign` carrying `colorPrimary` / `colorAccent` / `fontFamilyHeading` / `fontFamilyBody`. (Note: `colorButtonText` was removed in 0.3.46 — Kajabi has no equivalent global brand field; CTA text color is per-button via `themeSettings.color_button_text` or block overrides.)

`DEFAULT_BRANDING` (exported from `siteDesign/types.ts`) provides per-field fallbacks: colorPrimary `#ff3e14`, colorAccent `#ff3e14`, fontFamilyHeading `Fira Sans`, fontFamilyBody `Open Sans`. Both the panel (pre-fills empty fields with defaults) and `applyBrandingForExport` (falls back per-field when value is empty) honor them — so every site ships with a sensible Kajabi-flavored brand even if the expert never opens the panel.

PREVIEW PARITY (0.3.47+) — `resolvePreviewFonts` calls `applyBrandingForExport(design)` first, so the editor preview, dashboard thumbnails, and Pro custom-font cascade all see branding-merged themeSettings + fonts. Result: a brand-new site with no themeSettings/fonts immediately renders Fira Sans headings + Open Sans body in the preview, matching what will export to Kajabi. Explicit themeSettings still win.

Edited via 🎨 Branding button in `SiteEditor` toolbar (`packages/engine/src/shell/components/BrandingPanel.tsx`). Saves via existing `updateSite` — no schema migration; lives inside the existing `design` jsonb.

At export time `applyBrandingForExport(design)` (in `packages/engine/src/siteDesign/branding.ts`) merges branding INTO themeSettings/fonts, ONLY filling empty slots — explicit `themeSettings.color_primary` etc. on the design always win. Mapping: colorPrimary→color_primary, colorAccent→color_button + color_accent, fontFamilyHeading→font_family_heading + fonts.heading, fontFamilyBody→font_family_body + fonts.body.

Round-trip: `exportFromTree({ branding })` → `exportThemeZip({ branding })` writes `branding` verbatim into `config/export_report.json`. `importSiteFromZip` reads `export_report.json` and restores `result.design.branding`. Hand-authored Kajabi zips have no report → branding stays empty (DEFAULT_BRANDING kicks in on next export), expert fills via panel.

Engine root re-exports: `applyBrandingForExport`, `isEmptyBranding`, `SiteBranding`, `DEFAULT_BRANDING`. Shell re-exports: `BrandingPanel`, `BrandingPanelProps`. Master AGENTS rule §4.7 (CTA consistency) still applies — branding gives sitewide defaults; per-block CTA styling overrides them.
