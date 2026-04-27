/**
 * Component-tree export pipeline.
 *
 * Pipeline:
 *   1. serializeTree(tree) → settings_data.json shape
 *   2. (optional) inject font + type-scale CSS from tree.global into current.css
 *   3. exportThemeZip(...) → merges into base streamlined-home zip
 */
import type { ReactNode } from 'react';
import { serializeTree, type PageTrees, type SectionBackgroundOverride } from './serialize';
import { exportThemeZip } from '@/engines/exportEngine';
import type { BaseThemeName } from '@/engines/baseThemeValidator';
import type { ProjectAsset } from '@/types/assets';
import { resolveFont, buildFontCssBlock } from '@/engines/fontStrategy';
import { buildTypeScaleCssBlock, stripTypeScaleCssBlock, type TypeScale } from '@/engines/typeScaleStrategy';

/**
 * Optional page-wide settings injected into Kajabi's global current.css.
 * Inlined here so the kit has zero dependencies outside @/blocks, @/engines,
 * and @/types.
 */
export interface TypeSlotSizes {
  desktop?: number;
  mobile?: number;
}
export interface TreeGlobal {
  headingFont?: string;
  bodyFont?: string;
  typeScale?: Partial<Record<
    'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'small' | 'button',
    TypeSlotSizes
  >>;
  fontImports?: string[];
}

export interface ExportFromTreeOptions {
  /** Project assets to bundle into the zip (images, etc.) */
  assets?: ProjectAsset[];
  /** Optional global overrides (fonts + type scale). */
  global?: TreeGlobal;
  /**
   * Top-level Kajabi theme settings (color_primary, font_family_heading, etc.)
   * to merge into settings_data.current. Validated against
   * `templateSettingsCatalog.ts` — unknown keys dropped with a warning.
   */
  themeSettings?: Record<string, string>;
  /**
   * Custom CSS appended to the `css` setting field after any auto-generated
   * font / type-scale blocks. Used to brand Kajabi system pages (login,
   * store, checkout) that we don't render ourselves.
   */
  customCss?: string;
  /**
   * Which Kajabi base theme zip to merge into. Defaults to 'streamlined-home'
   * (full multi-page theme used by Sites). Landing pages should pass
   * 'encore-page' — Kajabi's single-template landing page theme.
   */
  baseTheme?: BaseThemeName;
}

/** Strip any prior PathX font block so re-injection doesn't stack duplicates. */
function stripFontCssBlock(css: string): string {
  return css.replace(
    /\/\* === PathX font overrides[\s\S]*?\/\* === end PathX font overrides === \*\//g,
    '',
  );
}

/**
 * Build a CSS block that pins external background-image URLs onto sections
 * by id. We do this because Kajabi's `image_picker_url` Liquid filter mangles
 * any value in `bg_image` that isn't a Kajabi-uploaded asset id.
 */
function buildExternalBgCssBlock(
  overrides: Map<string, SectionBackgroundOverride> | undefined,
): string {
  if (!overrides || overrides.size === 0) return '';
  const rules: string[] = [];
  for (const [sectionId, ovr] of overrides) {
    rules.push(
      `#section-${sectionId} {`,
      `  background-image: url("${ovr.url}") !important;`,
      `  background-size: cover;`,
      `  background-position: ${ovr.position};`,
      ovr.fixed ? `  background-attachment: fixed;` : '',
      `}`,
    );
  }
  return [
    '/* === external section backgrounds === */',
    rules.filter(Boolean).join('\n'),
    '/* === end external section backgrounds === */',
  ].join('\n');
}

function stripExternalBgCssBlock(css: string): string {
  return css.replace(
    /\/\* === external section backgrounds ===[\s\S]*?\/\* === end external section backgrounds === \*\//g,
    '',
  );
}

/**
 * Inject auto-generated font + type-scale CSS into settings_data.current.css.
 * Preserves any pre-existing user CSS by appending after a separator. Re-runs
 * are idempotent — old auto-generated blocks are stripped before appending.
 */
export function injectGlobalCss(
  settingsData: Record<string, unknown>,
  global: TreeGlobal | undefined,
  externalBackgrounds?: Map<string, SectionBackgroundOverride>,
): Record<string, unknown> {
  const hasFontImports = Array.isArray(global?.fontImports) && global!.fontImports!.length > 0;
  const hasGlobal = !!(global && (global.headingFont || global.bodyFont || global.typeScale || hasFontImports));
  const hasBgOverrides = !!externalBackgrounds && externalBackgrounds.size > 0;
  if (!hasGlobal && !hasBgOverrides) return settingsData;

  // Font block — also includes any per-block @import URLs added by setBlockFont.
  let fontBlock = '';
  if (hasGlobal && (global!.headingFont || global!.bodyFont || hasFontImports)) {
    const heading = resolveFont(global!.headingFont);
    const body = resolveFont(global!.bodyFont);
    fontBlock = buildFontCssBlock({
      heading,
      body,
      extraImports: global!.fontImports ?? [],
    });
  }

  // Type-scale block
  const scaleBlock = hasGlobal ? buildTypeScaleCssBlock(global!.typeScale as TypeScale | undefined) : '';

  // External section backgrounds (Supabase URLs etc. that image_picker_url mangles)
  const bgBlock = buildExternalBgCssBlock(externalBackgrounds);

  if (!fontBlock && !scaleBlock && !bgBlock) return settingsData;

  const root = (settingsData ?? {}) as { current?: Record<string, unknown> };
  const current = (root.current ?? {}) as Record<string, unknown>;
  const existingCss = typeof current.css === 'string' ? current.css : '';
  const cleanExisting = stripExternalBgCssBlock(
    stripTypeScaleCssBlock(stripFontCssBlock(existingCss)),
  ).trim();
  const merged = [cleanExisting, fontBlock, scaleBlock, bgBlock]
    .filter((s) => s && s.length > 0)
    .join('\n\n');

  return {
    ...settingsData,
    current: { ...current, css: merged },
  };
}

/**
 * Legacy alias kept for backwards compatibility — now also injects the
 * type-scale block when present on `global`.
 */
export const injectFontCss = injectGlobalCss;

/**
 * Build a downloadable Kajabi theme zip from a JSX component tree, OR from
 * a multi-page map keyed by Kajabi template name.
 *
 * Single-page (homepage only):
 *   exportFromTree(<><HeaderSection/>...<FooterSection/></>);
 *
 * Multi-page:
 *   exportFromTree({
 *     index: <IndexPage/>,
 *     about: <AboutPage/>,
 *     contact: <ContactPage/>,
 *   });
 *
 * Header / Footer are shared site-wide. Define them in any one tree (or
 * repeat them — last definition wins).
 */
export async function exportFromTree(
  tree: ReactNode | PageTrees,
  opts: ExportFromTreeOptions = {},
): Promise<Blob> {
  const { settingsData, externalBackgrounds } = serializeTree(tree, { baseTheme: opts.baseTheme });
  const withFonts = injectGlobalCss(settingsData, opts.global, externalBackgrounds);
  // If any section uses transition_effect: "fade", auto-inject a CSS workaround
  // for Kajabi Pro's broken Swiper init (it doesn't pass fadeEffect:{crossFade:true},
  // so old slides remain visible underneath new ones).
  const fadeWorkaround = hasFadeSlider(withFonts) ? FADE_SLIDER_CSS : '';
  const mergedCustomCss = [opts.customCss, fadeWorkaround].filter(s => s && s.trim()).join('\n\n');
  const withTheme = mergeThemeSettings(withFonts, opts.themeSettings, mergedCustomCss || undefined);
  return exportThemeZip(withTheme, opts.assets ?? [], undefined, {
    baseTheme: opts.baseTheme,
  });
}

/**
 * Merge template-declared themeSettings into `current` and append customCss
 * to `current.css`. Both are optional — when neither is provided the input
 * is returned unchanged.
 */
function mergeThemeSettings(
  settingsData: Record<string, unknown>,
  themeSettings: Record<string, string> | undefined,
  customCss: string | undefined,
): Record<string, unknown> {
  if (!themeSettings && !customCss) return settingsData;
  const root = (settingsData ?? {}) as { current?: Record<string, unknown> };
  const current = { ...((root.current ?? {}) as Record<string, unknown>) };

  if (themeSettings) {
    for (const [k, v] of Object.entries(themeSettings)) {
      if (v !== undefined && v !== null && v !== '') current[k] = v;
    }
  }

  if (customCss && customCss.trim()) {
    const existing = typeof current.css === 'string' ? current.css : '';
    const block = `/* === template customCss === */\n${customCss.trim()}\n/* === end template customCss === */`;
    // Strip any prior template customCss block so re-runs are idempotent
    const cleaned = existing.replace(
      /\/\* === template customCss ===[\s\S]*?\/\* === end template customCss === \*\//g,
      '',
    ).trim();
    current.css = [cleaned, block].filter(s => s && s.length > 0).join('\n\n');
  }

  return { ...settingsData, current };
}

/**
 * Kajabi Pro's section.liquid initializes Swiper for `effect: "fade"` without
 * passing `fadeEffect: { crossFade: true }`. Result: old slides stay visible
 * underneath new ones during the transition (visible "stacking" / overlap).
 *
 * This CSS forces inactive fade slides to position:absolute + opacity:0 so
 * fade actually cross-fades. Auto-injected whenever any section in the export
 * uses `transition_effect: "fade"`.
 */
const FADE_SLIDER_CSS = `/* Kajabi Pro slider fade fix — workaround for missing fadeEffect.crossFade in section.liquid */
.swiper[data-effect="fade"] .swiper-wrapper { position: relative; }
.swiper[data-effect="fade"] .swiper-slide {
  position: absolute !important;
  top: 0; left: 0; right: 0;
  opacity: 0 !important;
  transition: opacity 400ms ease-in-out;
  pointer-events: none;
}
.swiper[data-effect="fade"] .swiper-slide.swiper-slide-active {
  position: relative !important;
  opacity: 1 !important;
  pointer-events: auto;
  z-index: 1;
}`;

/**
 * Walk settingsData.current.sections looking for any section whose settings
 * declare transition_effect: "fade". Used to decide whether to inject the
 * fade workaround CSS into the exported theme.
 */
function hasFadeSlider(settingsData: Record<string, unknown>): boolean {
  const root = settingsData as { current?: { sections?: Record<string, unknown> } };
  const sections = root.current?.sections;
  if (!sections || typeof sections !== 'object') return false;
  for (const section of Object.values(sections)) {
    const s = section as { settings?: Record<string, unknown> } | undefined;
    if (s?.settings?.transition_effect === 'fade' && s.settings.enable_slider === 'true') {
      return true;
    }
  }
  return false;
}

/**
 * Trigger a browser download of a Blob with the given filename.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
