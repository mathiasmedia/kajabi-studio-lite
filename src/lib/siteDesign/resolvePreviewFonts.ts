// Resolve the effective preview fonts + override CSS for a site.
//
// Priority order (matches the Pro custom-fonts cascade in §9.8c):
//   1. themeSettings.use_custom_fonts === "true" → Pro custom font slots win
//      - All headings: select_custom_all_headings_font ("primary"|"accent")
//        → primary_custom_font_name / accent_custom_font_name
//      - Body: select_custom_body_font ("primary"|"accent")
//      - If no per-element pick, fall back to whichever slot is enabled.
//   2. design.fonts.heading / design.fonts.body (Standard Kajabi pickers).
//
// Also emits a full CSS string (`overrideCss`) that mirrors what Pro's
// snippets/font_override_styles.liquid + block_cta.liquid generate at
// export time. Without this, the preview shows correct families but
// stale weights, line-heights, letter-spacing, sizes, p bottom-margin,
// and button uppercase/tracking — which means inline styles we just
// stripped from the HTML re-appear "broken" in the editor.
//
// All rules are scoped to `.preview-root` by the consumer; this module
// returns un-scoped CSS so the same string works in any context.

import type { SiteDesign } from './types';

export interface ResolvedPreviewFonts {
  headingFamily: string | null;
  bodyFamily: string | null;
  /** Family names to request from Google Fonts (deduped). */
  googleFamilies: string[];
  /** Raw <link …> tag strings the caller should append to <head> verbatim. */
  rawLinkTags: string[];
  /** CSS rules mirroring Pro's font_override_styles + button override fields.
   *  Already includes :is(h1,...) families — caller may skip its own family <style>. */
  overrideCss: string;
}

const cleanName = (name?: string) => (name ? String(name).split(':')[0].trim() : '');

function pickSlot(
  pick: unknown,
  primary: string,
  accent: string,
  primaryEnabled: boolean,
  accentEnabled: boolean,
): string | null {
  if (pick === 'primary' && primaryEnabled && primary) return primary;
  if (pick === 'accent' && accentEnabled && accent) return accent;
  // No per-element pick (or "inherit") → fall back to whichever slot exists.
  if (primaryEnabled && primary) return primary;
  if (accentEnabled && accent) return accent;
  return null;
}

function extractLinkHrefs(raw: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

// "inherit" sentinel — the literal string Kajabi uses to mean "don't override".
// Empty string is NOT inherit (would emit broken `prop: ;`).
const isInherit = (v: unknown): boolean => v === undefined || v === null || v === '' || v === 'inherit';

const val = (ts: any, key: string): string | null => {
  const v = ts[key];
  if (isInherit(v)) return null;
  return String(v);
};

// Auto-append "px" to font-size / margin / padding values that look like bare numbers.
// Kajabi's authoring UI accepts both "32" and "32px"; the override snippets
// emit the raw value, so we mirror that — but bare numbers in CSS are invalid,
// so we coerce. Anything containing a unit (px/em/rem/%) or "auto" passes through.
const px = (raw: string | null): string | null => {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return `${s}px`;
  return s;
};

// Em/unitless values for line-height / letter-spacing / margin pass through.
const raw = (v: string | null): string | null => v;

interface FontRefs {
  primary: string;
  accent: string;
  primaryFb: string;
  accentFb: string;
  primaryEnabled: boolean;
  accentEnabled: boolean;
}

function resolveFontStack(pick: unknown, refs: FontRefs): string | null {
  if (pick === 'primary' && refs.primaryEnabled && refs.primary) {
    return `"${refs.primary}", ${refs.primaryFb || 'sans-serif'}`;
  }
  if (pick === 'accent' && refs.accentEnabled && refs.accent) {
    return `"${refs.accent}", ${refs.accentFb || 'sans-serif'}`;
  }
  return null;
}

function buildHeadingRules(ts: any, refs: FontRefs): string {
  const out: string[] = [];

  // All-headings cascade (lowest-priority heading override).
  if (String(ts.override_heading_font_styles ?? '') === 'true') {
    const decls: string[] = [];
    const fam = resolveFontStack(ts.select_custom_all_headings_font, refs);
    if (fam) decls.push(`font-family: ${fam}`);
    const fw = val(ts, 'custom_all_headings_font_weight');
    if (fw) decls.push(`font-weight: ${fw}`);
    const lh = val(ts, 'custom_all_headings_line-height');
    if (lh) decls.push(`line-height: ${lh}`);
    const ls = val(ts, 'custom_all_headings_letter-spacing');
    if (ls) decls.push(`letter-spacing: ${ls}`);
    const bm = px(val(ts, 'custom_all_headings_bottom_margin'));
    if (bm) decls.push(`margin-bottom: ${bm}`);
    if (decls.length) {
      out.push(`:is(h1,h2,h3,h4,h5,h6), :is(h1,h2,h3,h4,h5,h6) strong { ${decls.join('; ')} }`);
    }
  }

  // Per-element overrides (h1..h6) — beat all-headings for that element.
  for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    if (String(ts[`override_${h}_font_styles`] ?? '') !== 'true') continue;
    const decls: string[] = [];
    const fam = resolveFontStack(ts[`select_custom_${h}_font`], refs);
    if (fam) decls.push(`font-family: ${fam}`);
    const fw = val(ts, `custom_${h}_font_weight`);
    if (fw) decls.push(`font-weight: ${fw}`);
    const lh = val(ts, `custom_${h}_line-height`);
    if (lh) decls.push(`line-height: ${lh}`);
    const ls = val(ts, `custom_${h}_letter-spacing`);
    if (ls) decls.push(`letter-spacing: ${ls}`);
    const bm = px(val(ts, `custom_${h}_bottom_margin`));
    if (bm) decls.push(`margin-bottom: ${bm}`);
    if (decls.length) out.push(`${h} { ${decls.join('; ')} }`);

    // Desktop / mobile font sizes via media queries.
    const fsD = px(val(ts, `custom_${h}_font_size_desktop`));
    if (fsD) out.push(`@media (min-width: 768px) { ${h} { font-size: ${fsD} } }`);
    const fsM = px(val(ts, `custom_${h}_font_size_mobile`));
    if (fsM) out.push(`@media (max-width: 767px) { ${h} { font-size: ${fsM} } }`);
  }

  // Bold variants (h1 strong .. h6 strong) — beat per-element for inline accents.
  for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    if (String(ts[`override_${h}_bold_font_styles`] ?? '') !== 'true') continue;
    const decls: string[] = [];
    const fam = resolveFontStack(ts[`select_custom_bold_${h}_font`], refs);
    if (fam) decls.push(`font-family: ${fam}`);
    const fw = val(ts, `custom_bold_${h}_font_weight`);
    if (fw) decls.push(`font-weight: ${fw}`);
    const lh = val(ts, `custom_bold_${h}_line-height`);
    if (lh) decls.push(`line-height: ${lh}`);
    const ls = val(ts, `custom_bold_${h}_letter-spacing`);
    if (ls) decls.push(`letter-spacing: ${ls}`);
    const bm = px(val(ts, `custom_bold_${h}_bottom_margin`));
    if (bm) decls.push(`margin-bottom: ${bm}`);
    if (decls.length) out.push(`${h} strong { ${decls.join('; ')} }`);
  }

  return out.join('\n');
}

function buildBodyRules(ts: any, refs: FontRefs): string {
  const out: string[] = [];

  if (String(ts.override_body_fonts ?? '') === 'true') {
    const decls: string[] = [];
    const fam = resolveFontStack(ts.select_custom_body_font, refs);
    if (fam) decls.push(`font-family: ${fam}`);
    const fw = val(ts, 'custom_body_font_weight');
    if (fw) decls.push(`font-weight: ${fw}`);
    const lh = val(ts, 'custom_body_font_line-height');
    if (lh) decls.push(`line-height: ${lh}`);
    const ls = val(ts, 'custom_body_font_letter-spacing');
    if (ls) decls.push(`letter-spacing: ${ls}`);
    if (decls.length) out.push(`p { ${decls.join('; ')} }`);

    const fsD = px(val(ts, 'custom_body_font_size_desktop'));
    if (fsD) out.push(`@media (min-width: 768px) { p { font-size: ${fsD} } }`);
    const fsM = px(val(ts, 'custom_body_font_size_mobile'));
    if (fsM) out.push(`@media (max-width: 767px) { p { font-size: ${fsM} } }`);
  }

  // Paragraph bottom-margin lives outside override_body_fonts in Liquid too.
  const pBm = px(val(ts, 'custom_p_bottom_margin')) ?? raw(val(ts, 'custom_p_bottom_margin'));
  if (pBm) out.push(`p { margin-bottom: ${pBm} }`);

  if (String(ts.override_bold_body_fonts ?? '') === 'true') {
    const decls: string[] = [];
    const fam = resolveFontStack(ts.select_bold_custom_body_font, refs);
    if (fam) decls.push(`font-family: ${fam}`);
    const fw = val(ts, 'custom_bold_body_font_weight');
    if (fw) decls.push(`font-weight: ${fw}`);
    const lh = val(ts, 'custom_bold_body_line-height');
    if (lh) decls.push(`line-height: ${lh}`);
    const ls = val(ts, 'custom_bold_body_letter-spacing');
    if (ls) decls.push(`letter-spacing: ${ls}`);
    if (decls.length) out.push(`p strong, p b { ${decls.join('; ')} }`);
  }

  return out.join('\n');
}

function buildButtonRules(ts: any, refs: FontRefs): string {
  // Button advanced fields are gated by view_advanced_button_customizations.
  // When that toggle is off, even if values are set, Kajabi hides them in the
  // UI but still emits — so we read regardless and emit when present.
  // Always emit a baseline `.btn` rule so the React CTA component (which has
  // NO inline padding so theme padding can win) renders sensibly when no
  // themeSettings overrides are present. Pro overrides layer on top.
  const out: string[] = [
    `a.btn, button.btn, .btn { padding: 12px 24px; display: inline-block; }`,
  ];
  const decls: string[] = [];

  if (String(ts.btn_uppercase ?? '') === 'on') decls.push('text-transform: uppercase');

  const fam = resolveFontStack(ts.select_custom_btn_font, refs);
  if (fam) decls.push(`font-family: ${fam}`);

  const fw = val(ts, 'btn_font_weight');
  if (fw) decls.push(`font-weight: ${fw}`);

  const lh = val(ts, 'custom_body_button_line-height');
  if (lh) decls.push(`line-height: ${lh}`);

  const ls = val(ts, 'btn_letter-spacing');
  if (ls) decls.push(`letter-spacing: ${ls}`);

  const bdr = val(ts, 'button_border_thickness');
  if (bdr) decls.push(`border-width: ${px(bdr)}`);

  const vp = px(val(ts, 'button_vertical_padding'));
  const hp = px(val(ts, 'button_horizontal_padding'));
  if (vp && hp) decls.push(`padding: ${vp} ${hp}`);
  else if (vp) decls.push(`padding-top: ${vp}`, `padding-bottom: ${vp}`);
  else if (hp) decls.push(`padding-left: ${hp}`, `padding-right: ${hp}`);

  const tm = px(val(ts, 'custom_button_top_margin'));
  if (tm) decls.push(`margin-top: ${tm}`);
  const bm = px(val(ts, 'custom_button_bottom_margin'));
  if (bm) decls.push(`margin-bottom: ${bm}`);

  if (String(ts.btn_override_shadow ?? '') === 'off') decls.push('box-shadow: none');

  if (decls.length) out.push(`a.btn, button.btn, .btn { ${decls.join('; ')} }`);

  // Per-breakpoint button font sizes.
  const fsD = px(val(ts, 'custom_button_font_size_desktop'));
  if (fsD) out.push(`@media (min-width: 768px) { a.btn, button.btn, .btn { font-size: ${fsD} } }`);
  const fsM = px(val(ts, 'custom_button_font_size_mobile'));
  if (fsM) out.push(`@media (max-width: 767px) { a.btn, button.btn, .btn { font-size: ${fsM} } }`);

  return out.join('\n');
}

export function resolvePreviewFonts(design: SiteDesign | null | undefined): ResolvedPreviewFonts | null {
  if (!design) return null;
  const fonts = (design as any).fonts ?? {};
  const ts: any = (design as any).themeSettings ?? {};

  // Standard fallback first — also serves as the "no Pro overrides" answer.
  let headingFamily = cleanName(fonts.heading) || null;
  let bodyFamily = cleanName(fonts.body) || null;

  const useCustom = String(ts.use_custom_fonts ?? '') === 'true';
  const primaryEnabled = String(ts.use_primary_custom_font ?? '') === 'true';
  const accentEnabled = String(ts.use_accent_custom_font ?? '') === 'true';
  const primaryName = cleanName(ts.primary_custom_font_name);
  const accentName = cleanName(ts.accent_custom_font_name);
  const primaryFb = String(ts.primary_custom_font_fallback ?? 'serif');
  const accentFb = String(ts.accent_custom_font_fallback ?? 'sans-serif');

  if (useCustom && (primaryEnabled || accentEnabled)) {
    const overrideHeadings = String(ts.override_heading_font_styles ?? '') === 'true';
    if (overrideHeadings) {
      const picked = pickSlot(ts.select_custom_all_headings_font, primaryName, accentName, primaryEnabled, accentEnabled);
      if (picked) headingFamily = picked;
    }
    const overrideBody = String(ts.override_body_fonts ?? '') === 'true';
    if (overrideBody) {
      const picked = pickSlot(ts.select_custom_body_font, primaryName, accentName, primaryEnabled, accentEnabled);
      if (picked) bodyFamily = picked;
    }
  }

  // Build the Google Fonts list. Duplicates and unknown names are harmless.
  const googleFamilies: string[] = [];
  const seen = new Set<string>();
  const addFamily = (name?: string | null) => {
    const key = cleanName(name || undefined);
    if (!key) return;
    const k = key.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    googleFamilies.push(key);
  };
  addFamily(headingFamily);
  addFamily(bodyFamily);
  (fonts.extras ?? []).forEach((x: string) => addFamily(x));

  const rawLinkTags: string[] = [];
  if (useCustom) {
    const links = String(ts.font_stylesheet_links ?? '');
    extractLinkHrefs(links).forEach((href) => {
      if (!rawLinkTags.includes(href)) rawLinkTags.push(href);
    });
  }

  // Build the override CSS — only meaningful when Pro custom-font system is on.
  let overrideCss = '';
  if (useCustom) {
    const refs: FontRefs = {
      primary: primaryName,
      accent: accentName,
      primaryFb,
      accentFb,
      primaryEnabled,
      accentEnabled,
    };
    overrideCss = [
      buildBodyRules(ts, refs),
      buildHeadingRules(ts, refs),
      buildButtonRules(ts, refs),
    ]
      .filter(Boolean)
      .join('\n');
  }

  return { headingFamily, bodyFamily, googleFamilies, rawLinkTags, overrideCss };
}
