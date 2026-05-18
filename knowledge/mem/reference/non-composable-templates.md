---
name: Non-composable Kajabi templates
description: Auth/checkout templates Kajabi ships with hardcoded Liquid — never compose with dynamic_sections_for AND never omit; backfill if missing
type: reference
---
Kajabi's `register`, `forgot_password`, `forgot_password_edit`, `reset_password`, and `sales_page` templates ship with hardcoded Liquid that uses platform tags like `{% section "login" %}`, `{% section "register" %}`, `{% include "block_password_edit" %}` — they are NOT `dynamic_sections_for` pages.

Two failure modes both produce **"Invalid Template"** on Kajabi import:
1. Emitting `templates/<name>.liquid` containing `{% dynamic_sections_for "<name>" %}` for these names.
2. Omitting `templates/register.liquid` or `templates/reset_password.liquid` entirely (Kajabi requires them present in the zip).

Three protections (all required), all in `src/blocks/serialize.ts` + `src/engines/exportEngine.ts`:
1. `SYSTEM_TEMPLATES` lists them so the custom-page emitter skips them.
2. `NON_COMPOSABLE_TEMPLATES` in the serializer drops any tree provided for these names — no `content_for_*` array emitted, so Kajabi's defaults survive.
3. `AUTH_TEMPLATE_LIQUID` in `exportEngine.ts` backfills `register.liquid` + `reset_password.liquid` with the correct hardcoded Liquid whenever they're not already in the base zip. `forgot_password*` always ships in the base zip, so they don't need backfill.

Reference Liquid (mirrors what streamlined-home ships):
- `register.liquid`: `{% layout "minimal" %} {% section "header" %} {% section "register" %} {% section "footer" %}`
- `reset_password.liquid`: same shape as `forgot_password_edit.liquid` — uses `{% include "block_password_edit" %}` inside a `<section class="section">` wrapper, header/footer gated on `settings.include_password_reset_header/footer`.

Symptom checklist when "Invalid Template" appears on every Saved Template after upload:
- Does the zip contain `templates/register.liquid` AND `templates/reset_password.liquid`?
- Do they contain `dynamic_sections_for`? (BAD — should be hardcoded Liquid above.)
- Are `forgot_password.liquid` and `forgot_password_edit.liquid` still present from the base zip?
