---
name: Template typography & layout diversity (mandatory)
description: Every new template MUST use a font pairing not already used by another template, and a section rhythm distinct from existing templates. No defaulting to Cormorant/Inter.
type: preference
---

# Template diversity — mandatory differentiation

Every template in `src/templates/` is a marketing surface. If they all look
the same, the catalog is worthless. Apply these rules every time you build
or significantly edit a template.

## Step 1 — Check what's already taken

Before picking fonts, run:
```
grep -hE "fonts: \{" src/templates/*.tsx
```
Note every existing pairing. The new template's `fonts: { heading, body }` MUST be different from every other registered template. **Body font must NOT be `Inter` if 2+ templates already use it.**

## Step 2 — Pick fonts that match the brand mood, NOT muscle memory

Forbidden defaults when another template already uses them:
- `Cormorant Garamond` heading (used by calm-ledger historically — pick something else for any new "calm/wellness/editorial" brief)
- `Inter` body (over-used — reach for `Lora`, `Work Sans`, `DM Sans`, `Manrope`, `IBM Plex Sans`, `Public Sans`, `Source Sans 3`, `Karla`, `Nunito Sans` instead)
- `Fraunces` + `Inter` pairing
- `Playfair Display` + `Inter` pairing

Pairing inspiration buckets (use these as starting points, not defaults):
- Editorial/luxury: Tenor Sans, Cardo, EB Garamond, Spectral, Libre Caslon
- Warm/food/lifestyle: DM Serif Display, Bitter, Lora, Crimson Pro, Fraunces
- Modern/tech/SaaS: Space Grotesk, Manrope, Sora, Geist, Outfit
- Brutalist/bold: Archivo Black, Bricolage Grotesque, Big Shoulders Display
- Handwritten accents (extras only): Caveat, Shadows Into Light, Kalam

## Step 3 — Distinct section rhythm

Don't repeat the same "hero → stats → feature cards → content-media split → cta band" sequence on every template. Vary:
- **Asymmetric** layouts (full-bleed image left, text right, repeat alternating)
- **Editorial column** (single narrow column, generous whitespace, no cards)
- **Tile mosaic** (image-heavy grid, minimal copy)
- **Long-scroll story** (sequential text-heavy sections, one image break)
- **Magazine spread** (numbered sections, big pull quotes)

## Step 4 — Self-check before declaring done

Ask silently: "Could a user tell this template apart from the others at a glance?" If the answer is "only by color," the typography or layout is too similar — fix it.
