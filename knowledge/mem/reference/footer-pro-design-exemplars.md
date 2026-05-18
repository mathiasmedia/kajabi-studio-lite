---
name: footer_pro design exemplars
description: Two reference sites with well-designed Pro footers — read their footer JSON before authoring a new footer_pro
type: reference
---
When designing a `footer_pro` footer, look to these two sites as exemplars of good Pro footer composition (block selection, 12-col grid layout, spacing, brand-line placement, link columns):

- `6e052319-fbd9-430a-a420-f775cf5f0471`
- `e902482e-2d2e-4f5c-b3d5-db4037ed84bd`

Workflow: `get-site-design` (master: `SELECT design FROM sites WHERE id = ...`) → inspect the `footer` section's blocks + widths + props → pattern-match composition (NOT verbatim copy) for the new footer. Apply AGENTS §4.35e (no `logo` block in `footer_pro`; treat it as a 12-col grid; widths must sum to 12; `copyright` typically `width:"12"` on its own row).
