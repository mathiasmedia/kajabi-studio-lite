---
name: Section Style Slots
description: Per-section deterministic color/style assignment via SectionStyleSlots — sectionBg, cardBg, panelBg, accentBg, textTone, borderTone, emphasisColor
type: feature
---

## Engine Location
- `src/engines/sectionStyleSlots.ts`

## Style Slot Model
Each body section gets explicit style slots resolved from: styleHints → archetype defaults → global palette.

Slots:
- `sectionBg` — section background color
- `cardBg` — card/item background color
- `panelBg` — branded panel background (e.g. split section visual panel)
- `accentBg` — accent/highlight background
- `textTone` — 'light' or 'dark' (determines text color contrast)
- `borderTone` — border color for cards/panels
- `emphasisColor` — emphasis/highlight color

## Resolution Priority
1. `styleHints` (per-section detected colors from vision analysis)
2. Archetype-aware defaults (cta_band → primary, testimonials → #f9f9f9, etc.)
3. Global palette colors

## Archetype Defaults
- `cta_band` → palette.primary (dark)
- `testimonials` → #f9f9f9 (light gray)
- `stats_row` → #f7f7f7 (light gray)
- `content_media_split` → alternating white / #f8f8f8
- `feature_cards` / `icon_card_row` → palette.background

## Diagnostics
- `StyleSlotDiagnostic` tracks source of each resolved slot (hint vs archetype-default vs computed)

## Integration
- All body-section recipes (feature_cards, testimonials, content_media_split, cta_band, stats_row) use `resolveSectionStyle()` instead of hardcoded colors
