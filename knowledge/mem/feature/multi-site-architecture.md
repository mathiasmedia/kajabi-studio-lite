---
name: Multi-site architecture
description: localStorage-backed multi-site dashboard with template registry — sites are data, templates are code
type: feature
---
The app is a multi-site manager, not a single hardcoded demo.

**Storage**: `src/lib/siteStore.ts` — pure localStorage CRUD under key `lovable.kajabi.sites.v1`. Functions: `listSites`, `getSite`, `createSite`, `updateSite`, `duplicateSite`, `deleteSite`, `enabledPageCount`. Site shape: `{ id, name, templateId, brandName, pages, createdAt, updatedAt }`.

**Templates**: `src/templates/<id>.tsx` exports a `TemplateDef` with `buildPages(site)` (returns PageTrees map for export) and `renderPage(site, pageKey)` (single ReactNode for live preview). Registered in `src/lib/templates.ts`. Currently: `pixel-perfect` (8 pages) and `blank` (index only). Add a new template = drop file + register.

**Routes**:
- `/` → `SitesDashboard` (grid + new/rename/duplicate/delete)
- `/sites/:siteId` → `SiteEditor` (preview + page tabs + export)
- `/export` → redirects to `/` (legacy)

**v1 editable fields**: only `name` + `brandName` (synced together) + per-page enable/disable. Block content is template-driven. Future: colors, fonts, copy overrides.

**Header/footer** still shared per Kajabi rules — each template's page builders include their own SharedHeader/SharedFooter; serializer dedupes (last wins).
