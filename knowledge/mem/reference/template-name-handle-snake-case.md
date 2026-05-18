---
name: Template name → handle must be snake_case
description: Page keys may be authored with hyphens but the dynamic_sections_for handle, content_for_<x> key, and templates/<x>.liquid filename must all be snake_case. Engine sanitizes via sanitizeTemplateHandle() at serialize time.
type: constraint
---
Kajabi's `{% dynamic_sections_for "<handle>" %}` REJECTS hyphens, spaces, uppercase, and punctuation in the handle. Only `[a-z0-9_]` is safe.

Engine behavior (serialize.ts → `sanitizeTemplateHandle`): hyphens in page keys are auto-replaced with underscores when emitting `content_for_<handle>`, the templates/<handle>.liquid filename, and the `dynamic_sections_for` argument. Authors MAY use hyphenated keys in `design.pages` (e.g. `level-1-foundation`) — they get normalized at export.

**But normalization is one-way.** Storing hyphenated keys works for export, but the public Kajabi page URL also uses the handle, so for clarity prefer snake_case in `design.pages` directly:

✅ `pages.level_1_foundation`, `pages.first_strokes`, `pages.vip_1_1_application`
❌ `pages["level-1-foundation"]` (works via auto-sanitize, but noisy)

**Why:** Verified failure — Kajabi rejects exports containing `dynamic_sections_for "level-1-foundation"` as Invalid Template. Symptom: theme upload succeeds but custom pages 404 / show "Invalid template" in the editor.

**How to apply:** When creating new custom pages in `design.pages`, use only `[a-z0-9_]` for the key. Public URLs / page titles can be whatever the brand wants — the handle is internal.
