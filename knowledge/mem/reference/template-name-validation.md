---
name: Template name validation
description: Page/template name regex must allow hyphens — Kajabi template filenames use slug-style names (navigating-autism.liquid)
type: constraint
---
Kajabi template filenames are slug-style: `navigating-autism.liquid`, `terms-of-use.liquid`, `beyond-burnout-course.liquid`. The page-name validator lives in TWO places and BOTH must allow hyphens:

- `src/blocks/serialize.ts` → `VALID_TEMPLATE_NAME = /^[a-z0-9_-]{1,48}$/`
- `src/engines/exportEngine.ts` → custom-template emitter regex (same pattern)

If the regex is `/^[a-z0-9_]{1,48}$/` (no hyphen), every hyphenated page silently fails: `serializeTree` skips the tree (no sections in `settings_data.json`) and `exportEngine` skips emitting `templates/<name>.liquid`. Symptoms: dashboard says "11 pages", export contains 4. Only a console warning is emitted.

**Why:** Discovered when Auticate template's `navigating-autism`, `supporting-an-autistic-person`, `autistic-roadmap`, `beyond-burnout-course`, `autistic-energy-system`, `terms-of-use`, `privacy-policy` were silently dropped from exports.

**How to apply:** When adding new validation for page/template names anywhere in the export pipeline, the allowed character class is `[a-z0-9_-]`, never `[a-z0-9_]`.
