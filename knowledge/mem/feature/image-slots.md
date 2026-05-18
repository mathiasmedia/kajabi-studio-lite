---
name: Image Slot System
description: Per-archetype image slot definitions, resolution from bound assets, recipe consumption, critique media detection
type: feature
---

## Image Slots (src/engines/imageSlots.ts)
- Each archetype declares named slots: `backgroundImage`, `foregroundImage`, `sideImage`, `cardImage`, `avatarImage`
- Slot types: `background | inline | card_item | avatar | icon`
- Requirements: `required | optional | none`
- Resolution maps asset usages (sectionId + settingKey) to slot definitions

## Supported Archetypes
- **hero**: backgroundImage (section bg), foregroundImage (split layout image block)
- **feature_cards / icon_card_row**: cardImage (feature block image, sets hide_image=false)
- **content_media_split**: sideImage (image block), backgroundImage (section bg for branded panel)
- **cta_band**: backgroundImage (section bg)
- **testimonials**: avatarImage (optional, cosmetic)
- header, footer, stats_row: no image slots

## Recipe Integration
- `assembleFromPlan` and `assembleSingleSection` accept `ProjectAsset[]`
- Each recipe function receives `ResolvedImageSlot[]` as 7th parameter
- Recipes use `getResolvedSlot()` to wire images into block settings

## Critique Integration
- `critiqueRender` accepts `ProjectAsset[]`
- `validateImageSlots()` detects: missing_required, bound_but_recipe_ignores
- Media issues appear as global critique findings

## Builder Integration
- Asset upload uses `getImageSpec()` to determine correct `settingKey` for binding
- Toast shows which slot the image was bound to
