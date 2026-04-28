/**
 * Export Engine — Kajabi theme data → valid zip
 *
 * Loads the base theme zip, MERGES generated settings into the original
 * settings_data.json, and preserves all layout/template/section/snippet/asset files.
 * 
 * CRITICAL RULE: The tool only edits settings_data.json. All other files are untouched.
 * Within settings_data.json, we only overwrite:
 *   - content_for_index (the homepage section list)
 *   - sections referenced by content_for_index + header + footer
 *   - Global color/button/font settings when the user provides them
 * All other keys (content_for_about, content_for_blog, exit_pop, login sections, etc.)
 * are preserved exactly as they are in the original template.
 */
import JSZip from 'jszip';
import { validateAndRepairSections, getExportBlockingErrors } from './kajabiFieldSchema';
import { resolveAssetsForExport, downloadAssetBlob, validateAssets } from './assetManager';
import {
  getCachedZip,
  getCachedValidation,
  validateBaseTheme,
  type BaseThemeName,
} from './baseThemeValidator';

const DEFAULT_BASE_THEME: BaseThemeName = 'streamlined-home';
// Back-compat alias for any local callers that still use the old name.
type BaseTheme = BaseThemeName;
import { checkForDefaultFallbacks, runParityAudit, type ParityAuditResult } from './exportParityAudit';
import { transformForExport, buildArchetypeMap, type TransformReport } from './exportTransforms';
import { enforceSettingSafety } from './settingSafety';
import { EXPORTABLE_TEMPLATE_SETTING_IDS, auditTemplateSettings } from './templateSettingsCatalog';
import { SYSTEM_TEMPLATES } from '@/blocks/serialize';
import type { ProjectAsset } from '@/types/assets';
import type { VisualPlanV1 } from '@/types/schemas';

const SYSTEM_TEMPLATE_SET = new Set<string>(SYSTEM_TEMPLATES);

const JUNK_PATTERNS = ['__MACOSX', '.DS_Store', '/._', '/.'];

function isJunkFile(path: string): boolean {
  return JUNK_PATTERNS.some(p => path.includes(p)) || path.startsWith('._');
}

const REQUIRED_FOLDERS = ['config', 'layouts', 'templates', 'sections'];

function detectTopLevelFolder(zip: JSZip): string | null {
  const topLevel = new Set<string>();
  zip.forEach((relativePath) => {
    if (isJunkFile(relativePath)) return;
    const first = relativePath.split('/')[0];
    if (first) topLevel.add(first);
  });
  if (topLevel.size === 1) {
    const name = [...topLevel][0];
    const folder = zip.folder(name);
    if (folder && Object.keys(zip.files).some(f => f.startsWith(name + '/'))) {
      return name + '/';
    }
  }
  return null;
}

/**
 * Load and clean the base theme zip. Returns the zip + root prefix + the
 * original settings_data.json parsed as an object.
 */
async function loadBaseThemeZip(baseTheme: BaseTheme = DEFAULT_BASE_THEME): Promise<{
  zip: JSZip;
  rootPrefix: string;
  originalSettings: Record<string, unknown> | null;
}> {
  // Try to use the cached validated zip first
  const cachedZip = getCachedZip(baseTheme);
  const cachedValidation = getCachedValidation(baseTheme);

  let sourceZip: JSZip | null = null;

  if (cachedZip && cachedValidation?.health === 'ready') {
    // Clone the cached zip so we don't mutate it
    const buf = await cachedZip.generateAsync({ type: 'arraybuffer' });
    sourceZip = await JSZip.loadAsync(buf);
    console.log(`[Export] Using cached + validated base theme zip (${baseTheme})`);
  } else {
    // Validate first, then use
    const validation = await validateBaseTheme(baseTheme);
    if (validation.health === 'missing') {
      throw new Error(`Base theme zip "${baseTheme}" is missing. Export cannot proceed.`);
    }
    if (validation.health === 'invalid') {
      const errors = validation.diagnostics.filter(d => d.level === 'error').map(d => d.message);
      throw new Error(`Base theme zip "${baseTheme}" is invalid: ${errors.join('; ')}`);
    }
    const validatedZip = getCachedZip(baseTheme);
    if (validatedZip) {
      const buf = await validatedZip.generateAsync({ type: 'arraybuffer' });
      sourceZip = await JSZip.loadAsync(buf);
    } else {
      // Final fallback: direct fetch
      const fallbackUrl = baseTheme === 'encore-page'
        ? '/base-theme/encore-landing-page.zip'
        : '/base-theme/streamlined-home.zip';
      try {
        const resp = await fetch(fallbackUrl);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          sourceZip = await JSZip.loadAsync(buf);
        }
      } catch (e) {
        console.warn('Could not load base theme zip:', e);
      }
    }
  }

  const fallbackRoot = baseTheme === 'encore-page' ? 'encore-page/' : 'streamlined-home/';

  if (sourceZip) {
    const existingRoot = detectTopLevelFolder(sourceZip);
    const cleanZip = new JSZip();
    const rootPrefix = existingRoot || fallbackRoot;

    let originalSettings: Record<string, unknown> | null = null;

    const promises: Promise<void>[] = [];
    sourceZip.forEach((relativePath, file) => {
      if (isJunkFile(relativePath)) return;
      if (file.dir) {
        if (existingRoot) {
          cleanZip.folder(relativePath);
        } else {
          cleanZip.folder(rootPrefix + relativePath);
        }
      } else {
        promises.push(
          file.async('uint8array').then(async (data) => {
            const targetPath = existingRoot ? relativePath : rootPrefix + relativePath;
            cleanZip.file(targetPath, data);

            // Parse the original settings_data.json
            const settingsPath = rootPrefix + 'config/settings_data.json';
            if (targetPath === settingsPath || relativePath.endsWith('config/settings_data.json')) {
              try {
                const text = new TextDecoder().decode(data);
                originalSettings = JSON.parse(text);
              } catch (e) {
                console.warn('Could not parse original settings_data.json:', e);
              }
            }
          })
        );
      }
    });
    await Promise.all(promises);

    return { zip: cleanZip, rootPrefix, originalSettings };
  }

  // Fallback: create minimal structure
  const zip = new JSZip();
  const rootPrefix = fallbackRoot;
  zip.file(`${rootPrefix}layouts/theme.liquid`, `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {{ content_for_header }}
  {% section "header" %}
</head>
<body>
  {{ content_for_layout }}
  {% section "footer" %}
</body>
</html>`);
  zip.file(`${rootPrefix}layouts/minimal.liquid`, '{{ content_for_layout }}');
  zip.file(`${rootPrefix}templates/index.liquid`, '{% content_for_index %}');
  return { zip, rootPrefix, originalSettings: null };
}

/**
 * Merge generated settings into the original settings_data.json.
 * Only overwrites:
 *   - content_for_index
 *   - Sections referenced in content_for_index + header + footer
 *   - Global theme settings (colors, buttons, fonts) — only if non-empty in generated
 * Everything else is preserved from the original.
 */
function mergeSettings(
  original: Record<string, unknown>,
  generated: Record<string, unknown>
): Record<string, unknown> {
  const origCurrent = (original as { current?: Record<string, unknown> }).current || {};
  const genCurrent = (generated as { current?: Record<string, unknown> }).current || {};

  // Start with a deep clone of the original
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(origCurrent));

  // --- Merge sections ---
  const origSections = (merged.sections || {}) as Record<string, unknown>;
  const genSections = (genCurrent.sections || {}) as Record<string, unknown>;

  // Replace header and footer (only if generated has them)
  // Use schema-backed hide_on_desktop/hide_on_mobile instead of generic "hidden" flag
  if (genSections.header) {
    origSections.header = genSections.header;
  } else {
    // Header absent in source — hide via real schema settings, keep section present
    const origHeader = origSections.header as { settings?: Record<string, unknown> } | undefined;
    if (origHeader) {
      if (!origHeader.settings) origHeader.settings = {};
      origHeader.settings.hide_on_mobile = 'true';
      origHeader.settings.hide_on_desktop = 'true';
      console.log('[Export] headerSuppressed=true, reason=source_absent — hidden via schema settings (hide_on_desktop/hide_on_mobile)');
    }
  }
  if (genSections.footer) {
    origSections.footer = genSections.footer;
  } else {
    // Footer absent in source — hide via real schema settings, keep section present
    const origFooter = origSections.footer as { settings?: Record<string, unknown> } | undefined;
    if (origFooter) {
      if (!origFooter.settings) origFooter.settings = {};
      origFooter.settings.hide_on_mobile = 'true';
      origFooter.settings.hide_on_desktop = 'true';
      console.log('[Export] footerSuppressed=true, reason=source_absent — hidden via schema settings (hide_on_desktop/hide_on_mobile)');
    }
  }

  // Add all generated content sections (across every content_for_* array
  // the generator emitted, e.g. content_for_index, content_for_about, ...).
  const generatedContentForKeys = Object.keys(genCurrent).filter((k) =>
    k.startsWith('content_for_'),
  );
  for (const cfKey of generatedContentForKeys) {
    const ids = (genCurrent[cfKey] || []) as string[];
    for (const sectionId of ids) {
      if (!sectionId) continue;
      if (genSections[sectionId]) {
        origSections[sectionId] = genSections[sectionId];
      }
    }
  }

  merged.sections = origSections;

  // --- Replace each content_for_<template> array the generator emitted ---
  // Untouched templates (e.g. content_for_blog when the user only built
  // index + about) remain exactly as the original theme had them.
  for (const cfKey of generatedContentForKeys) {
    merged[cfKey] = genCurrent[cfKey];
  }

  // --- Merge link_lists ---
  if (genCurrent.link_lists) {
    const origLinks = (merged.link_lists || {}) as Record<string, unknown>;
    const genLinks = genCurrent.link_lists as Record<string, unknown>;
    merged.link_lists = { ...origLinks, ...genLinks };
  }

  // --- Merge global theme settings (catalog-driven from settings_schema.json) ---
  // Only overwrite if the generated value is non-empty. Unknown top-level keys
  // are skipped so we never leak invented settings into the final zip.
  for (const key of EXPORTABLE_TEMPLATE_SETTING_IDS) {
    const genValue = genCurrent[key];
    if (genValue !== undefined && genValue !== '' && genValue !== null) {
      merged[key] = genValue;
    }
    // If generated didn't set it, original value is already there from the clone
  }

  // Log unknown top-level keys present in the generated payload (for visibility)
  const unknownGenerated: string[] = [];
  for (const key of Object.keys(genCurrent)) {
    if (key === 'sections' || key === 'link_lists' || key.startsWith('content_for_')) continue;
    if (!EXPORTABLE_TEMPLATE_SETTING_IDS.has(key)) unknownGenerated.push(key);
  }
  if (unknownGenerated.length > 0) {
    console.warn(`[Export] ${unknownGenerated.length} generated top-level key(s) not in settings_schema.json — skipped:`, unknownGenerated);
  }

  return { current: merged };
}

// ---- Validation ----

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateSettingsData(settingsData: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const current = (settingsData as { current?: Record<string, unknown> }).current;
  if (!current) {
    errors.push('Missing "current" key in settings_data');
    return { valid: false, errors, warnings };
  }

  const sections = current.sections as Record<string, Record<string, unknown>> | undefined;
  if (!sections) {
    errors.push('Missing "sections" in settings_data.current');
    return { valid: false, errors, warnings };
  }

  if (!sections.header) warnings.push('No header section defined');
  if (!sections.footer) warnings.push('No footer section defined');

  // Validate every content_for_<template> array the generator produced.
  for (const cfKey of Object.keys(current).filter((k) => k.startsWith('content_for_'))) {
    const arr = current[cfKey];
    if (!Array.isArray(arr)) {
      errors.push(`${cfKey} must be an array`);
      continue;
    }
    for (const id of arr) {
      if (id && !sections[id as string]) {
        errors.push(`${cfKey} references missing section: ${id}`);
      }
    }
  }

  for (const [secId, sec] of Object.entries(sections)) {
    const blockOrder = sec.block_order as string[] | undefined;
    const blocks = sec.blocks as Record<string, unknown> | undefined;
    if (blockOrder && blocks) {
      for (const bId of blockOrder) {
        if (!blocks[bId]) {
          warnings.push(`Section "${secId}" block_order references missing block: ${bId}`);
        }
      }
    }
  }

  const json = JSON.stringify(settingsData);
  if (json.includes('"btn_url"')) warnings.push('Found "btn_url" — should be "btn_action"');
  if (json.includes('"image_link"')) warnings.push('Found "image_link" — should be "img_action"');

  return { valid: errors.length === 0, errors, warnings };
}

function validateZipShape(zip: JSZip, rootPrefix: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const topLevel = new Set<string>();
  zip.forEach((path) => {
    const first = path.split('/')[0];
    if (first) topLevel.add(first);
  });
  if (topLevel.size !== 1) {
    issues.push(`Expected 1 top-level folder, found ${topLevel.size}: ${[...topLevel].join(', ')}`);
  }

  for (const folder of REQUIRED_FOLDERS) {
    const fullPath = rootPrefix + folder + '/';
    const hasFolder = Object.keys(zip.files).some(f => f.startsWith(fullPath));
    if (!hasFolder) {
      issues.push(`Missing required folder: ${folder}/`);
    }
  }

  const settingsPath = rootPrefix + 'config/settings_data.json';
  if (!zip.files[settingsPath]) {
    issues.push('Missing config/settings_data.json inside theme folder');
  }

  zip.forEach((path) => {
    if (isJunkFile(path)) {
      issues.push(`Junk file found: ${path}`);
    }
  });

  return { valid: issues.length === 0, issues };
}

// ---- Main export ----

export interface ExportThemeZipOptions {
  /** Which Kajabi base theme to merge into. Defaults to 'streamlined-home'. */
  baseTheme?: BaseThemeName;
}

export async function exportThemeZip(
  settingsData: Record<string, unknown>,
  projectAssets: ProjectAsset[] = [],
  visualPlan?: VisualPlanV1,
  options: ExportThemeZipOptions = {},
): Promise<Blob> {
  const baseTheme: BaseThemeName = options.baseTheme ?? DEFAULT_BASE_THEME;
  // Structural validation of generated data
  const validation = validateSettingsData(settingsData);
  if (!validation.valid) {
    console.error('Export structural validation failed:', validation.errors);
    throw new Error(`Export validation failed: ${validation.errors.join('; ')}`);
  }
  if (validation.warnings.length > 0) {
    console.warn('Export structural warnings:', validation.warnings);
  }

  // Schema validation gate
  const current = (settingsData as { current?: { sections?: Record<string, unknown> } }).current;
  if (current?.sections) {
    const schemaReport = validateAndRepairSections(
      current.sections as Parameters<typeof validateAndRepairSections>[0]
    );
    const blockingErrors = getExportBlockingErrors(schemaReport);
    if (blockingErrors.length > 0) {
      console.error('Export blocked by schema errors:', blockingErrors);
      throw new Error(`Export blocked — ${blockingErrors.length} schema error(s):\n${blockingErrors.join('\n')}`);
    }
    if (schemaReport.warningCount > 0) {
      console.warn(`Export schema: ${schemaReport.autoRepairCount} auto-repairs, ${schemaReport.warningCount} warnings`);
    }
  }

  // Load base theme + original settings
  const { zip, rootPrefix, originalSettings } = await loadBaseThemeZip(baseTheme);

  // Resolve asset references for export
  let settingsForMerge = settingsData;
  if (projectAssets.length > 0) {
    // Validate assets before export
    const assetIssues = validateAssets(settingsData, projectAssets);
    const missingAssets = assetIssues.filter(i => i.type === 'missing_asset');
    if (missingAssets.length > 0) {
      console.warn('[Export] Missing asset references:', missingAssets.map(i => i.message));
    }

    const { resolvedSettings, assetExportMap } = resolveAssetsForExport(settingsData, projectAssets);
    settingsForMerge = resolvedSettings;

    // Download and add assets to zip
    for (const [, assetInfo] of assetExportMap) {
      try {
        const assetData = await downloadAssetBlob(assetInfo.storagePath);
        zip.file(`${rootPrefix}${assetInfo.exportPath}`, assetData);
        console.log(`[Export] Added asset: ${assetInfo.exportPath}`);
      } catch (err) {
        console.warn(`[Export] Failed to include asset ${assetInfo.exportPath}:`, err);
      }
    }
  }

  // --- Pre-merge: export transform — strip non-schema fields, validate block types ---
  const archetypeMap = buildArchetypeMap(settingsForMerge, visualPlan);
  const transformReport = transformForExport(settingsForMerge, archetypeMap);
  if (transformReport.totalStrippedFields > 0) {
    console.log(`[Export] Transform: stripped ${transformReport.totalStrippedFields} non-schema field(s) from ${transformReport.sectionsTransformed} section(s)`);
  }
  if (transformReport.sectionsBlocked > 0) {
    const blocked = transformReport.sections.filter(s => s.status === 'blocked');
    console.error('[Export] BLOCKED sections with invalid block types:', blocked.map(b => `${b.sectionName}: ${b.issues.join('; ')}`));
  }

  // --- Pre-merge: setting safety enforcement ---
  const safetyResult = enforceSettingSafety(settingsForMerge, archetypeMap, { autoFix: true });
  if (safetyResult.issues.length > 0) {
    console.warn(`[Export] Setting safety: ${safetyResult.issues.length} dangerous setting(s) guarded`);
  }

  // --- Pre-merge: check for fields that will cause Kajabi default fallbacks ---
  const defaultFallbacks = checkForDefaultFallbacks(settingsForMerge);
  if (defaultFallbacks.length > 0) {
    console.warn(`[Export] ⚠ ${defaultFallbacks.length} block(s) will show Kajabi default content:`);
    for (const fb of defaultFallbacks) {
      console.warn(`  Section "${fb.sectionName}" → block "${fb.blockId}" (${fb.blockType}): empty fields [${fb.emptyFields.join(', ')}]`);
    }
  }

  // Merge generated into original (or use generated as-is if no original)
  let finalSettings: Record<string, unknown>;
  if (originalSettings) {
    finalSettings = mergeSettings(originalSettings, settingsForMerge);
    console.log('[Export] Merged generated settings into original template — all non-index settings preserved');
  } else {
    finalSettings = settingsForMerge;
    console.warn('[Export] No original settings_data.json found — using generated data as-is');
  }

  // --- Post-merge: parity audit ---
  const parityAudit = runParityAudit(settingsForMerge, finalSettings);
  if (parityAudit.criticalIssues.length > 0) {
    console.error('[Export] PARITY CRITICAL:', parityAudit.criticalIssues);
  }
  if (parityAudit.warnings.length > 0) {
    console.warn('[Export] Parity warnings:', parityAudit.warnings);
  }

  // --- Post-merge: template-settings audit ---
  const finalCurrent = (finalSettings as { current?: Record<string, unknown> }).current || {};
  const templateAudit = auditTemplateSettings(finalCurrent);
  const templateErrors = templateAudit.issues.filter(i => i.level === 'error');
  if (templateErrors.length > 0) {
    console.error(`[Export] Template settings: ${templateErrors.length} error(s):`, templateErrors);
  }
  if (templateAudit.unknownFields.length > 0) {
    console.warn(`[Export] Template settings: ${templateAudit.unknownFields.length} unknown top-level key(s):`, templateAudit.unknownFields);
  }
  console.log(`[Export] Template settings audit: ${templateAudit.knownFields}/${templateAudit.totalChecked} keys validated against settings_schema.json`);

  // Write merged settings_data.json
  zip.file(`${rootPrefix}config/settings_data.json`, JSON.stringify(finalSettings, null, 2));

  // --- Materialize templates/<custom>.liquid for any custom pages ---
  // Per `mem://reference/kajabi-page-creation.md`, every custom page must have
  // its own template file containing `{% dynamic_sections_for "<name>" %}`.
  // System pages (index/about/page/contact/blog/blog_post/thank_you/404) already
  // exist in the base zip — we only emit liquid for non-system page names.
  const customTemplatesEmitted: string[] = [];
  const finalForLiquid = (finalSettings as { current?: Record<string, unknown> }).current || {};
  for (const cfKey of Object.keys(finalForLiquid)) {
    if (!cfKey.startsWith('content_for_')) continue;
    const pageName = cfKey.slice('content_for_'.length);
    if (SYSTEM_TEMPLATE_SET.has(pageName)) continue;
    if (!/^[a-z0-9_-]{1,48}$/.test(pageName)) {
      console.warn(`[Export] Skipping invalid custom page name: "${pageName}"`);
      continue;
    }
    const liquidPath = `${rootPrefix}templates/${pageName}.liquid`;
    if (zip.file(liquidPath)) {
      // Don't clobber a template that already shipped in the base zip
      console.log(`[Export] templates/${pageName}.liquid already present — leaving as-is`);
      continue;
    }
    zip.file(liquidPath, `{% dynamic_sections_for "${pageName}" %}\n`);
    customTemplatesEmitted.push(pageName);
  }
  if (customTemplatesEmitted.length > 0) {
    console.log(`[Export] Emitted ${customTemplatesEmitted.length} custom page template(s): ${customTemplatesEmitted.join(', ')}`);
  }

  // Add export report with parity audit + transform report
  const report = {
    exportedAt: new Date().toISOString(),
    generator: 'AI Kajabi Homepage Builder v1',
    baseTheme,
    mergedFromOriginal: !!originalSettings,
    validation,
    exportTransform: {
      sectionsTransformed: transformReport.sectionsTransformed,
      sectionsBlocked: transformReport.sectionsBlocked,
      strippedFields: transformReport.totalStrippedFields,
      sectionDetails: transformReport.sections.map(s => ({
        section: s.sectionName,
        archetype: s.archetype,
        status: s.status,
        stripped: s.strippedFields,
        issues: s.issues,
      })),
    },
    parityAudit: {
      sectionsAudited: parityAudit.sectionsAudited,
      sectionsWithIssues: parityAudit.sectionsWithIssues,
      criticalIssues: parityAudit.criticalIssues,
      defaultFallbackBlocks: defaultFallbacks.length,
    },
    templateSettings: {
      keysChecked: templateAudit.totalChecked,
      knownKeys: templateAudit.knownFields,
      unknownKeys: templateAudit.unknownFields,
      issues: templateAudit.issues,
    },
  };
  zip.file(`${rootPrefix}config/export_report.json`, JSON.stringify(report, null, 2));

  // Validate final zip shape
  const shapeCheck = validateZipShape(zip, rootPrefix);
  if (!shapeCheck.valid) {
    console.warn('Zip shape issues:', shapeCheck.issues);
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export { validateSettingsData };
export type { ValidationResult };
