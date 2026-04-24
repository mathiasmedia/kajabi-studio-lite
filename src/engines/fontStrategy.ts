/**
 * fontStrategy — resolve detected font family names against a curated
 * Google Fonts whitelist + system-font list. Used by both the AI ingest
 * path (vision pass detects family names → resolver picks a real Google
 * family or system fallback) and any future manual font picker.
 *
 * WHY: Kajabi's `font_select` field is locked to a small ~30-family list,
 * so we cannot reliably render "Playfair Display" by setting that field
 * alone. Instead we inject a CSS @import + `!important` overrides into the
 * global `css` setting (which DOES flow through preview and export). The
 * Kajabi `font_family_heading`/`font_family_body` settings are kept as
 * safe fallback defaults only.
 *
 * Match outcomes:
 *   - exact-google      → family found in whitelist; emit @import + stack
 *   - system-match      → system family (Arial, Georgia, …); no load needed
 *   - category-fallback → unknown family; pick a stack by feel/category
 */

export type FontMatchType = 'exact-google' | 'system-match' | 'category-fallback';

export type FontCategory =
  | 'serif'
  | 'sans-serif'
  | 'display'
  | 'handwriting'
  | 'monospace';

export interface ResolvedFont {
  /** What the user (or vision LLM) asked for, verbatim. */
  detected: string;
  /** Canonical family name we resolved to (e.g. "Playfair Display"). */
  family: string;
  /** Google Fonts URL if loadable; null for system fonts. */
  googleUrl: string | null;
  /** Full CSS font-family stack with fallbacks. */
  stack: string;
  category: FontCategory;
  matchType: FontMatchType;
  /** Human-readable note explaining the resolution. */
  note: string;
}

/**
 * Curated Google Fonts whitelist. ~80 families covering 95% of landing
 * pages we've seen. Each entry lists weights commonly used in headings/
 * body so we don't over-fetch.
 */
interface GoogleFont {
  family: string;
  category: FontCategory;
  weights: string;
  /** Lowercased aliases / common misspellings → resolves to this family. */
  aliases?: string[];
}

const GOOGLE_FONTS: GoogleFont[] = [
  // ── Serif (editorial, classic, premium feels) ──
  { family: 'Playfair Display', category: 'serif', weights: '400;700;900', aliases: ['playfair'] },
  { family: 'Lora', category: 'serif', weights: '400;500;700' },
  { family: 'Merriweather', category: 'serif', weights: '400;700;900' },
  { family: 'PT Serif', category: 'serif', weights: '400;700' },
  { family: 'Crimson Text', category: 'serif', weights: '400;600;700', aliases: ['crimson'] },
  { family: 'Cormorant Garamond', category: 'serif', weights: '400;500;700', aliases: ['cormorant', 'garamond'] },
  { family: 'EB Garamond', category: 'serif', weights: '400;500;700' },
  { family: 'Libre Baskerville', category: 'serif', weights: '400;700', aliases: ['baskerville'] },
  { family: 'Libre Caslon Text', category: 'serif', weights: '400;700', aliases: ['caslon'] },
  { family: 'Source Serif Pro', category: 'serif', weights: '400;600;700', aliases: ['source serif', 'source serif 4'] },
  { family: 'Source Serif 4', category: 'serif', weights: '400;600;700' },
  { family: 'Bitter', category: 'serif', weights: '400;600;700' },
  { family: 'Spectral', category: 'serif', weights: '400;500;700' },
  { family: 'Cardo', category: 'serif', weights: '400;700' },
  { family: 'Frank Ruhl Libre', category: 'serif', weights: '400;500;700' },
  { family: 'DM Serif Display', category: 'serif', weights: '400', aliases: ['dm serif'] },
  { family: 'Fraunces', category: 'serif', weights: '400;500;700;900' },
  { family: 'Instrument Serif', category: 'serif', weights: '400' },

  // ── Sans-serif (modern, clean, tech, SaaS) ──
  { family: 'Inter', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Roboto', category: 'sans-serif', weights: '400;500;700;900' },
  { family: 'Open Sans', category: 'sans-serif', weights: '400;600;700' },
  { family: 'Lato', category: 'sans-serif', weights: '400;700;900' },
  { family: 'Montserrat', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Poppins', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Source Sans Pro', category: 'sans-serif', weights: '400;600;700', aliases: ['source sans', 'source sans 3'] },
  { family: 'Source Sans 3', category: 'sans-serif', weights: '400;600;700' },
  { family: 'Nunito', category: 'sans-serif', weights: '400;600;700;800' },
  { family: 'Nunito Sans', category: 'sans-serif', weights: '400;600;700;800' },
  { family: 'Work Sans', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Raleway', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'PT Sans', category: 'sans-serif', weights: '400;700' },
  { family: 'Mulish', category: 'sans-serif', weights: '400;600;700;800', aliases: ['muli'] },
  { family: 'Manrope', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'DM Sans', category: 'sans-serif', weights: '400;500;700' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', weights: '400;500;600;700;800', aliases: ['jakarta', 'jakarta sans'] },
  { family: 'Outfit', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Sora', category: 'sans-serif', weights: '300;400;500;600;700;800' },
  { family: 'Space Grotesk', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Geist', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Figtree', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Be Vietnam Pro', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Karla', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Public Sans', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Rubik', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Heebo', category: 'sans-serif', weights: '400;500;700;800' },
  { family: 'Hind', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Barlow', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'IBM Plex Sans', category: 'sans-serif', weights: '400;500;600;700' },
  { family: 'Albert Sans', category: 'sans-serif', weights: '400;500;600;700;800' },
  { family: 'Onest', category: 'sans-serif', weights: '400;500;600;700;800' },

  // ── Display (bold, characterful headlines) ──
  { family: 'Bebas Neue', category: 'display', weights: '400', aliases: ['bebas'] },
  { family: 'Anton', category: 'display', weights: '400' },
  { family: 'Oswald', category: 'display', weights: '400;500;600;700' },
  { family: 'Archivo Black', category: 'display', weights: '400' },
  { family: 'Big Shoulders Display', category: 'display', weights: '400;700;900', aliases: ['big shoulders'] },
  { family: 'Unbounded', category: 'display', weights: '400;500;700;800' },
  { family: 'Syne', category: 'display', weights: '400;500;600;700;800' },
  { family: 'Bricolage Grotesque', category: 'display', weights: '400;500;600;700;800', aliases: ['bricolage'] },
  { family: 'Italiana', category: 'display', weights: '400' },

  // ── Handwriting / script ──
  { family: 'Caveat', category: 'handwriting', weights: '400;600;700' },
  { family: 'Pacifico', category: 'handwriting', weights: '400' },
  { family: 'Dancing Script', category: 'handwriting', weights: '400;600;700' },
  { family: 'Sacramento', category: 'handwriting', weights: '400' },
  { family: 'Great Vibes', category: 'handwriting', weights: '400' },
  { family: 'Allura', category: 'handwriting', weights: '400' },
  { family: 'Kalam', category: 'handwriting', weights: '400;700' },
  { family: 'Shadows Into Light', category: 'handwriting', weights: '400' },

  // ── Monospace (technical, code) ──
  { family: 'JetBrains Mono', category: 'monospace', weights: '400;500;700' },
  { family: 'Fira Code', category: 'monospace', weights: '400;500;700' },
  { family: 'IBM Plex Mono', category: 'monospace', weights: '400;500;700' },
  { family: 'Space Mono', category: 'monospace', weights: '400;700' },
  { family: 'Inconsolata', category: 'monospace', weights: '400;500;700' },
  { family: 'Roboto Mono', category: 'monospace', weights: '400;500;700' },
  { family: 'Source Code Pro', category: 'monospace', weights: '400;500;700' },
];

/** System fonts we recognize and DON'T need to load. */
const SYSTEM_FONTS: { name: string; stack: string; category: FontCategory }[] = [
  { name: 'arial', stack: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  { name: 'helvetica', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { name: 'helvetica neue', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif', category: 'sans-serif' },
  { name: 'verdana', stack: 'Verdana, Geneva, sans-serif', category: 'sans-serif' },
  { name: 'tahoma', stack: 'Tahoma, Geneva, sans-serif', category: 'sans-serif' },
  { name: 'trebuchet ms', stack: '"Trebuchet MS", Helvetica, sans-serif', category: 'sans-serif' },
  { name: 'georgia', stack: 'Georgia, "Times New Roman", serif', category: 'serif' },
  { name: 'times new roman', stack: '"Times New Roman", Times, serif', category: 'serif' },
  { name: 'times', stack: 'Times, "Times New Roman", serif', category: 'serif' },
  { name: 'palatino', stack: 'Palatino, "Palatino Linotype", serif', category: 'serif' },
  { name: 'garamond', stack: 'Garamond, Georgia, serif', category: 'serif' },
  { name: 'courier new', stack: '"Courier New", Courier, monospace', category: 'monospace' },
  { name: 'courier', stack: 'Courier, "Courier New", monospace', category: 'monospace' },
  { name: 'system-ui', stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', category: 'sans-serif' },
  { name: 'sf pro', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif', category: 'sans-serif' },
  { name: 'sf pro display', stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif', category: 'sans-serif' },
  { name: 'segoe ui', stack: '"Segoe UI", system-ui, sans-serif', category: 'sans-serif' },
];

/** Default fallback stacks per category — used when nothing matches. */
const CATEGORY_FALLBACKS: Record<FontCategory, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  'sans-serif': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  display: '"Bebas Neue", Impact, "Arial Black", sans-serif',
  handwriting: '"Brush Script MT", cursive',
  monospace: '"Courier New", Courier, monospace',
};

/* ─── Resolver ─── */

/**
 * Normalize for matching: lowercase, strip quotes, collapse whitespace.
 * Also drops common suffixes ("display", "text") *for fuzzy matching only*
 * — the canonical family name is preserved in the lookup table.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findGoogleFont(detected: string): GoogleFont | null {
  const norm = normalize(detected);
  if (!norm) return null;
  // Direct family-name match.
  for (const f of GOOGLE_FONTS) {
    if (normalize(f.family) === norm) return f;
  }
  // Alias match.
  for (const f of GOOGLE_FONTS) {
    if (f.aliases?.some((a) => normalize(a) === norm)) return f;
  }
  // Substring match — "Playfair" → "Playfair Display".
  for (const f of GOOGLE_FONTS) {
    const fname = normalize(f.family);
    if (fname.includes(norm) || norm.includes(fname)) return f;
  }
  return null;
}

function findSystemFont(detected: string): typeof SYSTEM_FONTS[number] | null {
  const norm = normalize(detected);
  if (!norm) return null;
  return SYSTEM_FONTS.find((s) => s.name === norm || norm.includes(s.name)) ?? null;
}

/**
 * Cheap heuristic for unknown families: classify by name keywords.
 * Used only when we have to fall back to a category stack.
 */
function guessCategory(detected: string): FontCategory {
  const n = detected.toLowerCase();
  if (/serif|playfair|garamond|georgia|caslon|baskerville|merriweather|bodoni|didot/.test(n)) return 'serif';
  if (/mono|code|courier/.test(n)) return 'monospace';
  if (/script|cursive|hand|caveat|brush|pacifico|dancing/.test(n)) return 'handwriting';
  if (/display|black|condensed|bebas|anton|oswald/.test(n)) return 'display';
  return 'sans-serif';
}

export function resolveFont(detected: string | undefined | null): ResolvedFont | null {
  if (!detected || typeof detected !== 'string') return null;
  const trimmed = detected.trim();
  if (!trimmed) return null;

  // 1. Exact Google Fonts hit.
  const g = findGoogleFont(trimmed);
  if (g) {
    const slug = g.family.replace(/\s+/g, '+');
    const url = `https://fonts.googleapis.com/css2?family=${slug}:wght@${g.weights}&display=swap`;
    return {
      detected: trimmed,
      family: g.family,
      googleUrl: url,
      stack: `"${g.family}", ${CATEGORY_FALLBACKS[g.category]}`,
      category: g.category,
      matchType: 'exact-google',
      note: `matched Google Fonts catalog`,
    };
  }

  // 2. System font hit.
  const s = findSystemFont(trimmed);
  if (s) {
    return {
      detected: trimmed,
      family: s.name.replace(/\b\w/g, (c) => c.toUpperCase()),
      googleUrl: null,
      stack: s.stack,
      category: s.category,
      matchType: 'system-match',
      note: 'system font, no remote load needed',
    };
  }

  // 3. Unknown — fall back to a category stack and ALSO try loading on
  //    the off-chance Google has the family verbatim.
  const cat = guessCategory(trimmed);
  const slug = trimmed.replace(/\s+/g, '+');
  const speculativeUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(slug)}:wght@400;500;700&display=swap`;
  return {
    detected: trimmed,
    family: trimmed,
    googleUrl: speculativeUrl,
    stack: `"${trimmed}", ${CATEGORY_FALLBACKS[cat]}`,
    category: cat,
    matchType: 'category-fallback',
    note: `unknown family — speculative Google load with ${cat} fallback stack`,
  };
}

/* ─── CSS block builder ─── */

export interface FontResolution {
  heading: ResolvedFont | null;
  body: ResolvedFont | null;
  /**
   * Extra Google Fonts URLs to @import for per-block font overrides
   * (e.g. setBlockFont applied a third family that isn't the page heading
   * or body default). Resolved separately so the rule block stays scoped
   * to globals while the imports cover everything the page references.
   */
  extraImports?: string[];
}

/**
 * Build the full CSS block to inject into `current.css`. Includes
 *   - @import lines (Google fonts for heading/body + any extraImports)
 *   - :root CSS vars for body/heading family stacks
 *   - body/heading selectors WITHOUT !important so per-block inline styles win
 *
 * Returns an empty string if nothing was resolved AND no extraImports.
 */
export function buildFontCssBlock(res: FontResolution): string {
  const heading = res.heading;
  const body = res.body;
  const extras = (res.extraImports ?? []).filter((u) => /^https?:\/\//i.test(u));
  if (!heading && !body && extras.length === 0) return '';

  const imports: string[] = [];
  const seen = new Set<string>();
  for (const f of [heading, body]) {
    if (!f?.googleUrl) continue;
    if (seen.has(f.googleUrl)) continue;
    seen.add(f.googleUrl);
    imports.push(`@import url('${f.googleUrl}');`);
  }
  for (const url of extras) {
    if (seen.has(url)) continue;
    seen.add(url);
    imports.push(`@import url('${url}');`);
  }

  // If there are no globals to set vars for, ship just the imports — that's
  // enough to make per-block inline `font-family: 'X'` actually load.
  if (!heading && !body) {
    return [
      '/* === PathX font overrides (auto-generated) === */',
      ...imports,
      '/* === end PathX font overrides === */',
    ].join('\n');
  }

  const headingStack = heading?.stack ?? body?.stack ?? CATEGORY_FALLBACKS['sans-serif'];
  const bodyStack = body?.stack ?? heading?.stack ?? CATEGORY_FALLBACKS['sans-serif'];

  // CRITICAL: do NOT use !important on these rules. Per-block inline
  // `style="font-family:..."` (written by the setBlockFont op) MUST be able
  // to override the page-wide stack. Inline styles beat any non-!important
  // selector regardless of specificity, but they LOSE to !important.
  // We still beat Kajabi's defaults via the `body ... ` selector specificity.
  return [
    '/* === PathX font overrides (auto-generated) === */',
    ...imports,
    ':root {',
    `  --pathx-font-heading: ${headingStack};`,
    `  --pathx-font-body: ${bodyStack};`,
    '}',
    'body, body p, body li, body a, body span, body div, body button, body input, body textarea, body select, body label, body .elements-text, body .elements-button {',
    `  font-family: var(--pathx-font-body);`,
    '}',
    'body h1, body h2, body h3, body h4, body h5, body h6, body .elements-text h1, body .elements-text h2, body .elements-text h3, body .elements-text h4, body .elements-text h5, body .elements-text h6 {',
    `  font-family: var(--pathx-font-heading);`,
    '}',
    '/* === end PathX font overrides === */',
  ].join('\n');
}

