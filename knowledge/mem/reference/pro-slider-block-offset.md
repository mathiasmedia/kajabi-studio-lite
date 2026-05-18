---
name: Pro slider block_offset is mandatory
description: Pro #1 slider mistake — section intro blocks (eyebrow/headline/lede) get pulled into the slide pool by default; `block_offset` skips them. Symptom: "headline is sliding past as a slide" / "you forgot to skip one block before starting the slider"
type: feature
---

# Pro slider `block_offset` — count your intro blocks, set the offset

## The mistake (verified across multiple thin-client builds)

When a Pro section has both intro copy AND a slider — e.g. an eyebrow "12 WEEKS · 24 MODULES" + headline "A guided descent through every depth of the craft." + 6 module-card slides — the AI builds it as:

```jsonc
{
  "props": { "enableSlider": true, "blocksPerSlide": 3 },  // ❌ no block_offset
  "blocks": [
    { "type": "text", /* eyebrow */ },
    { "type": "text", /* headline */ },
    { "type": "feature", /* card 1 */ },
    { "type": "feature", /* card 2 */ },
    // ...
  ]
}
```

**What happens:** Pro's `column_one_slider.liquid` pulls EVERY block in the section into the Swiper slide pool. The first slide rendered is the eyebrow. The second is the headline. The cards start at slide 3. The expert sees their hero headline flicker past as a "slide" and reports any of:

- "the slider is sliding the wrong things"
- "my title is in the carousel"
- "the first slide is blank / shows the section title"
- "you forgot to skip one block before starting the slider"
- "why does the slider include my eyebrow?"

## The fix

Every time you set `enableSlider: true`, count the leading non-slide blocks and set `block_offset` to that exact number. Same for trailing — count outro blocks and set `block_end_offset`.

```jsonc
{
  "props": {
    "enableSlider": true,
    "blocksPerSlide": 3,
    "block_offset": 2,        // ✅ skip eyebrow + headline
    "block_end_offset": 0
  },
  "blocks": [
    { "type": "text", /* eyebrow */ },     // index 0 — skipped
    { "type": "text", /* headline */ },    // index 1 — skipped
    { "type": "feature", /* card 1 */ },   // index 2 — slide 1
    { "type": "feature", /* card 2 */ },   // index 3 — slide 2
    // ...
  ]
}
```

## Quick reference

| Intro shape above the carousel | `block_offset` |
|---|---|
| No intro — section is JUST the slider | `0` (default) |
| Eyebrow OR headline only | `1` |
| Eyebrow + headline | `2` |
| Eyebrow + headline + lede | `3` |
| Eyebrow + headline + lede + divider | `4` |

## Pre-flight (run every time `enableSlider: true` is set)

1. Walk the section's `blocks` array from index 0.
2. Count consecutive leading blocks that are NOT slides (intro copy, eyebrow, headline, lede, divider, intro CTA).
3. Set `block_offset` to that count.
4. Walk from the bottom; count consecutive trailing non-slide blocks. Set `block_end_offset` to that count.
5. Mental simulation: "the first slide is `blocks[block_offset]`." If `blocks[block_offset]` is a heading, you've miscounted — increment.

## Anti-patterns

❌ **Splitting intro into a separate section** to "fix" the problem — that breaks the section's visual rhythm and cohesion. `block_offset` is the native Kajabi solution; use it.

❌ **Setting `block_offset: 1` reflexively** — count the actual blocks. Many sections have 2 or 3 intro blocks (eyebrow + headline + lede), not just 1.

❌ **Forgetting `block_end_offset`** — if the section ends with a "View all →" CTA below the slider, that CTA needs to be excluded too.

## Verified field IDs (per `mem://reference/pro-slider-field-ids.md`)

- `block_offset` (NOT `block_offset_before`) — leading blocks to skip.
- `block_end_offset` (NOT `block_offset_after`) — trailing blocks to skip.
- Range 0–20, default `0`.

## See also

- `PRO_CAPABILITIES.md` §9.3 + §9.3a — full slider field reference + worked example.
- `mem://reference/pro-slider-field-ids.md` — verified field IDs.
- `mem://reference/slider-fade-stacks-slides.md` — related fade-effect gotcha.
