---
name: Archetype Visual Tokens
description: Per-archetype calibrated typography, spacing, and element styling tokens for near-pixel fidelity
type: feature
---

## Engine Location
- `src/engines/archetypeVisualTokens.ts`

## Token Model
Each archetype gets explicit calibrated tokens for:

### Typography (per slot)
- `fontSize`, `lineHeight`, `fontWeight`, `letterSpacing`, `textTransform`, `opacity`
- Slots: heading, subheading, body, meta, eyebrow, quote, name, role, list

### Spacing
- `sectionPaddingTop/Bottom` — section-level vertical padding
- `headingToSubheading`, `subheadingToBody`, `bodyToButtons` — intra-section gaps
- `cardRowGap`, `textMediaColumnGap` — layout gaps
- `cardPaddingV/H`, `ctaInternalSpacing` — element-level padding

### Element Styling
- `cardBorderRadius`, `cardBoxShadow` — card shell
- `imagePanelRadius`, `imagePanelMinHeight` — image panels
- `buttonPaddingV/H`, `buttonFontSize`, `buttonBorderRadius` — buttons
- `iconTileSize/Padding` — icon tiles
- `secondaryBorderWeight` — secondary CTA border

## Calibrated Values
| Archetype | Heading | Body | Section Pad |
|-----------|---------|------|-------------|
| hero | 52px/800 | 18px/400 | 100px |
| icon_card_row | 36px/700 | 15px/400 | 80px |
| content_media_split | 36px/700 | 16px/400 | 80px |
| testimonials | 36px/700 heading, 16px quote, 15px name, 13px role | — | 80px |
| cta_band | 36px/700 | 18px/400 | 80px |
| stats_row | 36px/700 heading, 32px/800 stat numbers | 14px/500 labels | 60px |

## Key Behaviors
- `applySlotTypography()` — adds calibrated inline styles to plain HTML tags; preserves existing inline styles (source fidelity first)
- `slotTypographyToCSS()` — builds CSS string from token for manual injection
- `getArchetypeTokens()` — registry lookup with fallback to icon_card_row defaults

## Integration
- All recipe functions in recipeAssembly.ts import and use tokens
- Section padding, card border-radius, card padding all derived from tokens
- Regression tests in `src/test/visualFidelity.test.ts` (10 tests)
