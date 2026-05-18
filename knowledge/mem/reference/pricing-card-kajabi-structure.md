---
name: PricingCard mirrors Kajabi block_pricing.liquid 1:1 (with verified export gaps)
description: Kajabi `.pricing` / `.pricing__body` markup, verified selectors that survive export, and the editor-only fields that DON'T export (highlight, badgeText, priceFontFamily)
type: reference
---

## Kajabi `block_pricing.liquid` (Pro + Standard, identical)

```html
<div class="block background-{light|dark}" id="block-{id}">      <!-- chrome from block.liquid wraps this -->
  <div class="pricing">
    [optional <img class="pricing__image" />]
    <div class="pricing__body">
      <h4 class="pricing__name">Apprentice</h4>          <!-- bold h4, plain text only -->
      <div class="pricing__info">
        <h2 class="pricing__price">$17,500</h2>          <!-- big h2, plain text only, margin-top:1rem -->
      </div>
      <p class="pricing__heading">paid in full</p>       <!-- plain text caption, 1rem -->
      <div class="pricing__content custom-icon">
        <ul><li>...</li></ul>                            <!-- only field that accepts HTML -->
      </div>
      {% include "block_cta" %}                          <!-- primary CTA via shared snippet -->
      <a class="btn secondary">...</a>                   <!-- optional secondary -->
    </div>
  </div>
</div>
```

## Verified selectors that survive export (safe to target from `customCss`)

These are the selectors thin clients can rely on — they're emitted by `block.liquid` + `block_pricing.liquid` on every Pro and Standard site:

- `.block.background-dark .pricing` — every block on a dark color scheme. Stable.
- `.block.background-light .pricing` — every block on a light scheme. Stable.
- `#block-{id}` — per-block ID, predictable from the block's UUID. Use to target a single highlighted card.
- `.pricing`, `.pricing__body`, `.pricing__name`, `.pricing__info`, `.pricing__price`, `.pricing__heading`, `.pricing__content`, `.pricing__content.custom-icon`, `.pricing__content ul`, `.pricing__content ul li`, `.pricing__content ul li:before` — all canonical Kajabi class names.

## Verified `.pricing__body` CSS (`streamlined-home-pro/assets/styles.scss.liquid` 4390–4447)

- `.pricing__body` — `display:flex; flex-direction:column; align-items:center; padding:2rem` (2.5rem ≥768px). NO border/radius/shadow — chrome comes from the parent `.block` wrapper (NOT `.pricing`).
- `.pricing__name` — `margin:0; font-weight:700` (h4 default size).
- `.pricing__info` — `display:inline-flex; margin-bottom:0.5rem` (wraps the price).
- `.pricing__price` — `margin-top:1rem; margin-bottom:0` (h2 default size).
- `.pricing__heading` — `font-size:1rem; margin:0`.
- `.pricing ul/ol` — `margin:1.5rem 0`. `.pricing li` — `margin:0.5rem 0`.
- `.pricing .custom-icon ul/li` — `list-style:none`. `.custom-icon li:before` — Font Awesome `\f00c` check, `color: settings.color_primary`, recolorable per-block via `icon_color` field.

## DOM order (CRITICAL — many sites are confused by this)

`name → price → heading → text → cta`

The visual hierarchy ("$17,500 big at top, 'paid in full' small below") comes from h2-vs-h4-vs-p sizing, NOT from re-ordering. If a site shows price ABOVE name, the author left `name` empty and put the small label in `heading` instead — that's a valid Kajabi pattern.

## Field rendering — what accepts HTML, what doesn't

| Field | Renders as | HTML allowed? |
|---|---|---|
| `name` | `<h4 class="pricing__name">{{ name }}</h4>` | ❌ Plain text only — Liquid doesn't escape it but no `<br>` / `<strong>` will style cleanly because the surrounding `<h4>` already styles. |
| `price` | `<h2 class="pricing__price">{{ price }}</h2>` | ❌ Plain text only. |
| `heading` | `<p class="pricing__heading">{{ heading }}</p>` | ❌ Plain text only. |
| `text` | `<div class="pricing__content custom-icon">{{ text }}</div>` | ✅ **Full HTML** — only field that accepts markup. Use `<ul><li>` here for features. |
| `image` | `<img class="pricing__image" src="...">` | URL only. |

## 🚨 Editor-only props that DO NOT export to Kajabi (silent-drop trap)

These render correctly in the Lovable editor preview but produce ZERO visual effect on the live Kajabi site, because they are React inline styles in `PricingCard.tsx` with no matching field in `block_pricing.liquid`'s schema:

| Prop | Preview behavior | Export behavior |
|---|---|---|
| `highlight: true` | `transform: translateY(-10px)` lift + thicker border + colored brand shadow + accent stripe at top | **Silently dropped.** The serializer falls through to a flat card; only `box_shadow` survives. |
| `badgeText: "MOST CHOSEN"` | Pill positioned at top center of card | **Silently merged into `name`.** Look at `PricingCard.serialize` line 364: `const name = p.badgeText ? p.badgeText : (p.name ?? '')` — badge text REPLACES name on export, the pill UI is lost, and the original name is gone. |
| `brandColor` (when used purely for the highlight stripe / badge) | Renders the top stripe + badge background | Stripe + badge are dropped entirely. The brand color DOES still flow to `price_color`/`price_name_color`/`btn_background_color`/`icon_color` via the serializer fallbacks. |
| `priceFontFamily` (if set) | Would override the price font | **Silently dropped.** Not in `PRICING_BLOCK_FIELDS` allowlist. Audit confirmed via `bun run audit:schema`. |
| Per-card `iconColor` | ✅ Exports correctly via `icon_color` field (added 2026-04). |
| Chrome (`backgroundColor`/`borderRadius`/`boxShadow`/`padding`) | Applies to `.pricing` in preview | Applies to the parent `.block` wrapper in Kajabi (NOT `.pricing`). Visual result is equivalent for solid backgrounds; subtle differences for translucent. |

## How to ship "highlight tier" visuals to Kajabi today

Since `highlight`, `badgeText`, and `priceFontFamily` don't export, thin clients that want a real visual tier hierarchy on the live site MUST inject CSS via the page-level `customCss` field. Canonical pattern:

```css
/* Highlight the middle tier (assuming dark color scheme on that block) */
.block.background-dark .pricing { transform: translateY(-10px); }

/* Brand-colored top accent stripe on the highlighted card */
.block.background-dark .pricing::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #B68C4A, #B68C4ACC);
}

/* "MOST CHOSEN" pill — the actual block's name field can stay legitimate */
.block.background-dark .pricing::after {
  content: "MOST CHOSEN";
  position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  background: #B68C4A; color: #fff; font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.14em; padding: 7px 18px; border-radius: 0 0 12px 12px;
}

/* Make .pricing the positioning context (Kajabi's default has no position rule) */
.block.background-dark .pricing { position: relative; padding-top: 52px; }
```

This is the SAME workaround a thin client ([Path X / Vanguard]) already shipped in their `customCss` after watching the editor-vs-Kajabi diverge. Until master ships proper schema support (option below), this CSS is the right fix.

## Engine implementation rules (`PricingCard.tsx`)

1. **Render in Kajabi DOM order** — `name (h4) → price (h2 in `.pricing__info` wrapper) → heading (p) → text (.pricing__content) → CTA → secondary CTA`. Do NOT reorder.
2. **Use Kajabi class names** (`pricing`, `pricing__body`, `pricing__name`, `pricing__info`, `pricing__price`, `pricing__heading`, `pricing__content`, `custom-icon`) so themeSettings sitewide CSS targeting these selectors reaches the preview.
3. **Card chrome** comes from `getBlockChromeStyle(props)` — **but in Kajabi the chrome applies to the parent `.block` wrapper**, not `.pricing` itself. Keep this in mind when authoring sitewide CSS that mixes chrome + `.pricing` selectors.
4. **`heading` is the canonical caption field**. Keep `priceCaption` as a back-compat alias.
5. **Bullet decoration** — when `text` contains `<li>`, swap in real SVG check chips (FA isn't loaded in preview) and add `custom-icon` class to `.pricing__content`.
6. **Dark-surface auto-themeing** — `isDarkColor(surface)` flips `ink`/`muted` to light tones.
7. **`badgeText` / `highlight` / `brandColor` are editor-only flourishes today.** Until the engine emits per-block CSS for them (see "Future fix" below), thin clients must replicate the look via page `customCss`.

## Future fix (not yet shipped)

The proper engine fix is for `PricingCard.serialize` to emit a small CSS block whenever `highlight: true` / `badgeText` is set, scoped via `#block-{id}`, that the export pipeline collects and concatenates into the page-level `customCss`. This requires:

1. Adding an optional `extraCss?: string` return shape to the `BlockComponent.serialize` contract.
2. Collecting `extraCss` per-block in `export.ts` and merging into `mergedCustomCss`.
3. Removing the badge → name silent-merge in `PricingCard.serialize` line 364.

Until that ships, the customCss workaround above is the canonical answer.

## Pre-flight when editing PricingCard

- DOM order matches the Liquid snippet exactly.
- Class names match Kajabi (`pricing`, `pricing__*`, `custom-icon`).
- Chrome respects `getBlockChromeStyle` overrides.
- Bullets render with brand check chips inside a real `<ul>`.
- Dark surface still readable.
- `serialize()` writes `heading` (not `text` prepend) for the caption.
- If you set `highlight: true` or `badgeText`, also ship matching `customCss` at the page level — the props alone won't reach Kajabi.
