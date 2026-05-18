---
name: Inline style on editorial HTML content (testimonials, quotes, signatures)
description: Refines §4.35ad. Recurring typography/buttons/colors belong in themeSettings (cascade discipline). But one-off editorial copy (testimonials, pull quotes, signatures, hand-set hero callouts) where the visual treatment IS the content REQUIRES inline style="..." on the <p>/<blockquote>/<cite> — themeSettings only covers semantic tags, not stylistic editorial moments.
type: reference
---

# Inline style on editorial HTML content

🚨 **Verified failure mode (Aurelian House testimonial, 2026-05-08).** Homepage testimonial section was authored as raw `<p>"quote text"</p><p>— Name</p>` inside a `text` block. Rendered on Kajabi as flat body copy (default body font, default size, no editorial weight). Other sections of the site used inline-styled HTML for their editorial moments and looked premium; the testimonial looked unfinished by comparison.

## The distinction §4.35ad doesn't fully cover

§4.35ad bans inline `style="..."` for **recurring** styling (h1–h6, body copy, button systems, link treatments). That rule is correct for those cases — they belong in `themeSettings`.

**But editorial one-offs are different.** A testimonial pull-quote, a hand-set hero callout, a signature line, a magazine-style accent paragraph — the visual treatment IS the content. There's no semantic tag for "the pull quote treatment we use on this site"; `themeSettings` has no field for "pull quote font size." These need inline styles on the specific `<p>`/`<blockquote>`/`<cite>`.

## The rule — two categories

### Forbidden inline (covered by §4.35ad)
- Body paragraphs, lede copy, eyebrow/kicker text — recurring
- h1, h2, h3, h4, h5, h6 — semantic, lives in themeSettings
- Button/CTA styling — lives in themeSettings + block props
- Link colors (hover, default) — lives in themeSettings
- Anything that appears more than ~3 times across the site in the same form

### REQUIRED inline (this rule)
- Testimonial / pull-quote / "what they're saying" copy
- Signature lines (`— Name, Title, Year`)
- Hero callouts that are deliberately styled differently from the h1
- Magazine-style accent paragraphs (oversized lede, drop-cap, all-caps spaced label)
- Caption rows under images that need editorial treatment
- One-off badges/pills inside body copy

These need inline `style="..."` on the specific element so Kajabi renders the editorial weight that's part of the brand voice.

## Canonical pattern — testimonial

```html
<blockquote style="font-family:'Cormorant Garamond',serif;font-size:32px;line-height:1.4;font-weight:400;font-style:italic;color:#3A2E22;margin:0 0 24px 0;max-width:680px;">
  "These programs changed the trajectory of my health and the health of my family."
</blockquote>
<cite style="font-family:'Inter',sans-serif;font-size:13px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#A88251;font-style:normal;">
  — Liana, 2025
</cite>
```

## Canonical pattern — signature line

```html
<p style="font-family:'Cormorant Garamond',serif;font-size:24px;font-style:italic;color:#3A2E22;margin:32px 0 0 0;">
  — Sarah, Founder
</p>
```

## Pre-flight check (every site build, every "polish" pass)

Walk every page and find sections matching these labels: "Testimonial" / "Proof" / "What people say" / "Reviews" / "Quote" / "Signature" / "From the founder" / editorial-prose hero callouts. For each:

1. Open the `text` block's HTML content.
2. If the copy is raw `<p>...</p>` with NO inline `style="..."` → it'll render as flat body copy on Kajabi.
3. Lift to inline-styled `<blockquote>` / `<cite>` / `<p style="...">` matching the site's editorial voice (use the heading font for the quote body, an accent font/treatment for the attribution).

## Symptom mapping

- "the testimonial looks like plain body copy on Kajabi" → raw `<p>`, needs inline editorial style
- "the rest of the site looks premium but the quote section looks unfinished" → same
- "you didn't style the testimonial" → same
- "the signature line is just plain text" → same

## Why themeSettings can't cover this

`themeSettings` styles semantic tags (h1, h2, h3, body, button). There's no `themeSettings.testimonial_quote_font_size` field. `customCss` could express it via a class (`.testimonial blockquote { ... }`) — but that requires you to wrap the content in a known class, which is brittle (the class needs to be added to every testimonial across the site, the editor doesn't surface it). Inline style on the specific element is the most reliable: copy + style travel together as one unit.

This is the legitimate exception to "no inline styling" — it's NOT a recurring system, it's a piece of editorial content with built-in styling.

See AGENTS.md §4.35ad (cascade discipline — what's forbidden inline) and §4.30 step 3a (sitewide resets).
