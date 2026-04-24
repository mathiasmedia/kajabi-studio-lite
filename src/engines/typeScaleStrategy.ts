/**
 * typeScaleStrategy — resolve a detected type scale (desktop + mobile font
 * sizes for h1–h6, body, small, button) into a CSS block we can inject into
 * Kajabi's `current.css` field.
 *
 * WHY: Kajabi exposes only a small fixed set of font-size choices via its
 * built-in settings, and they don't always match the reference. We sidestep
 * that by writing `!important` CSS overrides into the global `css` setting —
 * which DOES flow through preview and export — keyed off both standard tags
 * (h1, p, button) and Kajabi's `.elements-*` classes so we win the cascade.
 *
 * Mobile sizes apply under `@media (max-width: 768px)`.
 *
 * The detector emits plain pixel numbers; this resolver clamps them to a
 * sane range (10–160px) and ignores any slot it doesn't have a value for so
 * partial detections still work.
 */

export type TypeSlot =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'body'
  | 'small'
  | 'button';

export interface SlotSizes {
  /** Desktop px size. */
  desktop?: number;
  /** Mobile px size (applied ≤768px). */
  mobile?: number;
}

export type TypeScale = Partial<Record<TypeSlot, SlotSizes>>;

/** CSS selectors per slot — duplicated for plain tags + Kajabi elements-* wrappers. */
const SLOT_SELECTORS: Record<TypeSlot, string> = {
  h1: 'h1, .elements-text h1',
  h2: 'h2, .elements-text h2',
  h3: 'h3, .elements-text h3',
  h4: 'h4, .elements-text h4',
  h5: 'h5, .elements-text h5',
  h6: 'h6, .elements-text h6',
  body: 'body, p, .elements-text p, .elements-text li, .elements-text',
  small: 'small, .elements-text small, figcaption, .elements-text figcaption',
  button:
    'button, .btn, .elements-button, .elements-button-text, a.btn, .elements-cta .btn',
};

function clampPx(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  if (n < 10 || n > 160) return null;
  return Math.round(n);
}

/**
 * Build the CSS block to inject. Returns '' when nothing usable is provided.
 *
 * Output shape:
 *   /* === PathX type scale (auto-generated) === * /
 *   h1, .elements-text h1 { font-size: 56px !important; }
 *   ...
 *   @media (max-width: 768px) {
 *     h1, .elements-text h1 { font-size: 36px !important; }
 *     ...
 *   }
 *   /* === end PathX type scale === * /
 */
export function buildTypeScaleCssBlock(scale: TypeScale | undefined | null): string {
  if (!scale || typeof scale !== 'object') return '';

  const desktopRules: string[] = [];
  const mobileRules: string[] = [];

  for (const slot of Object.keys(SLOT_SELECTORS) as TypeSlot[]) {
    const sizes = scale[slot];
    if (!sizes) continue;
    const desktop = clampPx(sizes.desktop);
    const mobile = clampPx(sizes.mobile);
    const sel = SLOT_SELECTORS[slot];
    if (desktop !== null) {
      desktopRules.push(`${sel} { font-size: ${desktop}px !important; }`);
    }
    if (mobile !== null) {
      mobileRules.push(`  ${sel} { font-size: ${mobile}px !important; }`);
    }
  }

  if (desktopRules.length === 0 && mobileRules.length === 0) return '';

  const parts: string[] = ['/* === PathX type scale (auto-generated) === */'];
  parts.push(...desktopRules);
  if (mobileRules.length > 0) {
    parts.push('@media (max-width: 768px) {');
    parts.push(...mobileRules);
    parts.push('}');
  }
  parts.push('/* === end PathX type scale === */');
  return parts.join('\n');
}

/**
 * Strip any previously-injected PathX type-scale block from a CSS string.
 * Used by the injector so re-applying doesn't stack duplicate blocks.
 */
export function stripTypeScaleCssBlock(css: string): string {
  return css.replace(
    /\/\* === PathX type scale[\s\S]*?\/\* === end PathX type scale === \*\//g,
    '',
  );
}
