---
name: Header + footer block allowlist (registry-driven)
description: Per-theme verified header/footer/footer_pro block allowlists from schemaRegistry; engine 0.4.x consults registry as truth, hard-coded set is fast-path fallback. Pro themes serialize footer as footer_pro and unlock ~20 extra block types.
type: reference
---

**The truth comes from each base theme's `{% schema %}`, not a frozen list.** Engine 0.4.x+ generates `packages/engine/src/engines/schemas.generated.json` from the four base-theme zips and serializes against it via `schemaRegistry.ts`. The hard-coded React allowlist in `sections.tsx` is just a fast-path fallback for callers that don't pass `baseTheme`.

**Verified per-theme allowlists (extracted 2026-05-04):**

| Theme | Header blocks | Footer (`footer`) blocks | `footer_pro` extra blocks |
|---|---|---|---|
| `streamlined-home` | logo, menu, dropdown, user, cta, hello_bar, social_icons | logo, link_list, copyright, social_icons | — |
| `streamlined-home-pro` | same | same | accordion, audio, assessment, blog, cta, countdown, code, card, event, event_video, feature, form, image, multi_video, offer, pricing, text, video, video_embed, external_widget (+ link_list, copyright, social_icons) |
| `encore-page` | same | same | — |
| `encore-page-pro` | same | same | same Pro footer set |

**Notes:**
- **Header is identical across all themes.** `dropdown`, `user`, `hello_bar` are valid Kajabi block types but no first-class React renderer yet — they round-trip as opaque blocks.
- **Standard footer is the small 4-block set everywhere.**
- **Pro footer (`footer_pro`)** is what makes Pro footers richer — 20+ extra blocks including `form` (newsletter signup), `feature` cards, `cta`, `countdown`, etc.
- The exporter chooses `footer` vs `footer_pro` automatically based on `base_theme` (`exportEngine.ts:252`, `kajabiFieldSchema.ts:1090`). Pro themes always serialize the footer slot as `footer_pro`.
- Putting Pro-footer-only blocks on a Standard site → silently dropped on export.

**Authoring guidance still applies:**
1. **Prefer canonical first-class blocks** even when the registry would accept other types. `logo` for wordmarks (not `text`), `link_list` for footer columns (not `menu`), `copyright` for the legal line. The registry is wide; the editor's React renderer is narrower — unknown types render as opaque placeholders.
2. **Pro footer blocks only work on Pro themes.** Confirm `base_theme` is `*-pro` before reaching for the extended set.
3. **`serializeTree` MUST be called with `baseTheme`.** Without it, the hard-coded fast-path fallback is the only fence and the historical silent-drop bug returns.

**Engine enforcement:**
- `packages/engine/src/blocks/sections.tsx` — `HEADER_ALLOWED` / `FOOTER_ALLOWED` sets, hard-coded fast path.
- `packages/engine/src/engines/schemaRegistry.ts` — registry-aware passthrough (Phase B3); see `mem://feature/registry-aware-export-passthrough.md`.
- `packages/engine/src/siteDesign/render.tsx` (engine ≥0.3.10) — same allowlists in the renderer; disallowed blocks emit `[siteDesign] Block type "X" is not allowed in <YSection>...` and are visibly dropped.

**Symptom → diagnosis:**
- "live site has no logo / header brand mark" → text/image in header (should be `logo`)
- "footer missing brand line / tagline" → text in footer (should be `logo`/`copyright` or moved above footer on Standard; can use `text`/`feature` in footer_pro on Pro)
- "footer column links don't show up" → `menu` in footer (should be `link_list`)
- "Pro newsletter signup not on live site" → `form` block in footer on Standard theme (only works on Pro themes' `footer_pro`)
- "block shows in editor preview but not on exported site" → allowlist violation; check `baseTheme` was passed to `serializeTree`

See AGENTS.md §4.27 for full reference + per-theme tables.
