---
name: Section passthrough already-emitted guard
description: Engine 0.6.47+. Section registry-aware passthrough in serialize.ts skips ANY snake_case key buildSectionSettings already wrote in this pass — no SNAKE_TO_CAMEL skip-map to maintain. Eliminates "imported __rawSettings overwrites freshly-serialized header_menu_style/bg_image/full_width" bug class structurally.
type: feature
---

## What changed (engine 0.6.47)

`serialize.ts` section registry-aware passthrough no longer maintains a hand-coded `SNAKE_TO_CAMEL` skip-map. Instead it snapshots `Object.keys(sectionSettings)` BEFORE the passthrough runs, and any field already in that snapshot is skipped — meaning whatever `buildSectionSettings` (and footer/header branches) emitted from the canonical camelCase prop wins over a potentially-stale snake_case value sitting on `props.__rawSettings`.

## The bug it kills

Editor sets `props.collapsed = true` → `buildSectionSettings` writes `header_menu_style: 'hamburger'` → passthrough loop sees `header_menu_style: 'normal'` still on props (from import snapshot) and overwrites the fresh value. Save returns 200, JSON looks right (`collapsed: true` AND `header_menu_style: 'normal'` both present), but live Kajabi renders the "normal" menu because the snake_case key wins on export.

Same shape applied to `bg_image`, `background_color`, `full_width`, `max_width`, every header Pro field — any time a derived field had a stale snake_case sibling on imported props, last write won.

## Why structural > skip-map

Old fix: add `header_menu_style: 'collapsed'` to a `SNAKE_TO_CAMEL` map. Worked for that one field. Every NEW derived field (camelCase → snake_case) had to be added to the map or the bug returned silently. Easy to forget on PR review.

New rule: "the passthrough never touches a field the serializer already wrote." Adding a new derived field in `buildSectionSettings` is sufficient; no second place to update; impossible to forget.

## Where the rule lives

`packages/engine/src/blocks/serialize.ts` line ~615 — section registry passthrough block. The `alreadyEmitted = new Set(Object.keys(sectionSettings))` snapshot is the entire mechanism.

## Maintenance

If you add a new section field that maps from a camelCase prop to a snake_case Kajabi key, just add the `if (layout.foo) settings.foo_bar = ...;` branch in `buildSectionSettings` (or the header/footer-only branches). Do NOT touch the passthrough — the snapshot picks it up automatically.

If you add a NEW snake_case-only Pro field with no camelCase alias, do nothing — the passthrough copies it through as before (that's its original purpose).

## Per-block passthrough is unaffected

The per-block passthrough at line ~770 already uses author-wins semantics (the value on `childProps[k]` overwrites the serializer output unconditionally — by design, because the schema-driven editor writes snake_case). That's a different policy and intentional. The section passthrough only fires for fields the serializer LEFT EMPTY because section-level "author wins on snake_case" would silently revert every camelCase-driven section setting on every imported site.
