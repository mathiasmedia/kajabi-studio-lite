/**
 * Component-tree export pipeline.
 */
import type { ReactNode } from 'react';
import { serializeTree, type PageTrees, type SectionBackgroundOverride } from './serialize';
import { exportThemeZip } from '@/engines/exportEngine';
import type { BaseTheme } from '@/engines/baseThemeValidator';
import type { ProjectAsset } from '@/types/assets';
import { resolveFont, buildFontCssBlock } from '@/engines/fontStrategy';
import { buildTypeScaleCssBlock, stripTypeScaleCssBlock, type TypeScale } from '@/engines/typeScaleStrategy';

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
  assets?: ProjectAsset[];
  global?: TreeGlobal;
  themeSettings?: Record<string, string>;
  customCss?: string;
  baseTheme?: BaseTheme;
}

function stripFontCssBlock(css: string): string {
  return css.replace(
    /\/\* === PathX font overrides[\s\S]*?\/\* === end PathX font overrides === \*\//g,
    '',
  );
}

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

export function injectGlobalCss(
  settingsData: Record<string, unknown>,
  global: TreeGlobal | undefined,
  externalBackgrounds?: Map<string, SectionBackgroundOverride>,
): Record<string, unknown> {
  const hasFontImports = Array.isArray(global?.fontImports) && global!.fontImports!.length > 0;
  const hasGlobal = !!(global && (global.headingFont || global.bodyFont || global.typeScale || hasFontImports));
  const hasBgOverrides = !!externalBackgrounds && externalBackgrounds.size > 0;
  if (!hasGlobal && !hasBgOverrides) return settingsData;

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

  const scaleBlock = hasGlobal ? buildTypeScaleCssBlock(global!.typeScale as TypeScale | undefined) : '';
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

export const injectFontCss = injectGlobalCss;

export async function exportFromTree(
  tree: ReactNode | PageTrees,
  opts: ExportFromTreeOptions = {},
): Promise<Blob> {
  const { settingsData, externalBackgrounds } = serializeTree(tree);
  const withFonts = injectGlobalCss(settingsData, opts.global, externalBackgrounds);
  const withTheme = mergeThemeSettings(withFonts, opts.themeSettings, opts.customCss);
  return exportThemeZip(withTheme, opts.assets ?? [], undefined, opts.baseTheme);
}

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
    const cleaned = existing.replace(
      /\/\* === template customCss ===[\s\S]*?\/\* === end template customCss === \*\//g,
      '',
    ).trim();
    current.css = [cleaned, block].filter(s => s && s.length > 0).join('\n\n');
  }

  return { ...settingsData, current };
}

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
