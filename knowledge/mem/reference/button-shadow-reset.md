---
name: Button shadow reset (Kajabi base .btn ships a shadow)
description: Kajabi's base .btn class ships with a default box-shadow. Brand button styling that sets bg/text/radius but never resets shadow leaves the header CTA looking "off" vs hero CTAs. Every flat-button brand MUST emit `.btn { box-shadow: none !important }` sitewide AND on `.header .btn` / `.header__inner .btn`.
type: reference
---

# Button shadow reset

🚨 **Verified failure mode (Aurelian House header, 2026-05-08).** The header "Inquire" CTA had a "nasty box shadow" that didn't match the hero/section CTAs. All buttons shared the same `buttonBackgroundColor` / `buttonTextColor` / `buttonBorderRadius` per §4.7, but the header button looked subtly elevated/different. Cause: Kajabi's base theme `.btn` class ships with a default `box-shadow` (small Y-offset blur). Our brand styling overrode bg/text/radius but never touched `box-shadow`, so the default leaked through on every button — but it was most visible on the header (smaller button, against a clean band).

## The rule

Every site whose brand button is **flat** (no shadow — the default for premium/editorial brands) MUST include a sitewide shadow reset in `customCss`:

```css
/* Reset Kajabi base .btn shadow — brand buttons are flat */
.btn,
a.btn,
button.btn { box-shadow: none !important; }

/* Header-scoped reset (Pro header sometimes adds extra shadow on hover/focus) */
.header .btn,
.header__inner .btn,
.header .btn:hover,
.header .btn:focus { box-shadow: none !important; }
```

If the brand DOES want shadowed buttons (rare — usually playful/SaaS brands), still emit an EXPLICIT `box-shadow: 0 2px 8px rgba(...)` rule sitewide so every button matches — never rely on Kajabi's default, which varies by theme version.

## Pre-flight check (every site build, every CTA edit)

Add to §4.7's CTA audit: when verifying CTA consistency, check `box-shadow` is explicitly set or reset — not just `buttonBackgroundColor` / `buttonTextColor` / `buttonBorderRadius`. The four button properties to align across the site:

1. `buttonBackgroundColor`
2. `buttonTextColor`
3. `buttonBorderRadius`
4. **`box-shadow`** (sitewide via customCss — never per-block)

## Symptom mapping

- "the header button looks different from the hero button" → shadow not reset
- "the CTA in the dark band has a weird elevation" → shadow not reset
- "buttons look fine but the header one is 'off'" → shadow not reset
- "I matched the colors but the buttons still don't match" → shadow not reset

## Why per-block won't work

Block-level button props (`buttonBackgroundColor` etc.) don't expose a `boxShadow` field on most blocks. Even if they did, you'd have to emit it on every CTA on the site. Sitewide `customCss` is the right layer per §4.35ad's cascade discipline (this is one of the legitimate `customCss` use-cases — resetting a Kajabi default that has no `themeSettings` field).

See AGENTS.md §4.7 (CTA consistency), §4.30 step 3a (sitewide CSS resets), §4.35ad (cascade discipline).
