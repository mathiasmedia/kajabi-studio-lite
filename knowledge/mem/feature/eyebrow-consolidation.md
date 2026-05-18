---
name: Hero Eyebrow Consolidation
description: 3-tier eyebrow detection — AI copy pass extracts directly from screenshot, then heuristic fallbacks for stats_row headings and proof-row items
type: feature
---

## Eyebrow Detection (priority order)

### 1. AI Copy Pass (highest trust)
- The copy extraction prompt (`COPY_PROMPT`) instructs the AI to detect `heroEyebrow` with `position: 'above' | 'below'` directly from the screenshot
- Parsed in `src/engines/copyExtraction.ts` → wired into `CopyDraftV1.heroEyebrow` + `heroEyebrowPosition`
- This is the primary path — works for ANY screenshot layout

### 2. Stats Row Heuristic (fallback)
- `src/engines/vision.ts` → `consolidateHeroEyebrow()` + `isEyebrowLikeText()`
- Fires when first body section is `stats_row` with eyebrow-like heading
- Stats section removed if ≤1 items, kept with heading stripped if ≥2 items

### 3. Proof Row Promotion (fallback)
- Scans `proofRowText` items for eyebrow-like text
- Promotes first match to `heroEyebrow`, removes from proof row

## Position Detection
- `inferEyebrowPosition()`: establishment phrases → above, category labels → below, default → above
- AI copy pass returns position directly from visual analysis

## Eyebrow-Like Text Heuristics (`isEyebrowLikeText`)
- ≤60 chars, ≤10 words
- Matches if: all-caps (>80%) OR decorative separators (·•|—–) OR establishment phrases OR short badge label (≤6 words, no sentence structure)

## Schema
- `CopyDraftV1.heroEyebrow?: CopyField` + `heroEyebrowPosition?: EyebrowPosition`
- `EyebrowPosition = 'above' | 'below'` in `src/types/schemas.ts`
- `CopyPassEyebrow` in `src/types/analysisPassTypes.ts`

## Rendering
- `above`: separate text block before headline in `recipeHero()`
- `below`: inline HTML between heading and subheading

## Tests
- `src/test/eyebrowConsolidation.test.ts` (3 tests)
