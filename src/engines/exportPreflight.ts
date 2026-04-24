/**
 * Export Preflight — Run all checks before export to ensure success.
 * Surfaces blocking errors vs warnings so the UI can gate the export button.
 * Includes parity audit to detect Kajabi default-fallback issues.
 */
import { validateBaseTheme, type BaseThemeValidation } from './baseThemeValidator';
import { validateSettingsData, type ValidationResult } from './exportEngine';
import { validateAssets } from '@/engines/assetManager';
import type { AssetValidationIssue } from '@/types/assets';
import { validateAndRepairSections, getExportBlockingErrors } from './kajabiFieldSchema';
import { checkForDefaultFallbacks } from './exportParityAudit';
import { transformForExport, buildArchetypeMap, getSectionParityStatus } from './exportTransforms';
import type { ProjectAsset } from '@/types/assets';
import type { VisualPlanV1 } from '@/types/schemas';

// ─── Types ─────────────────────────────────────────────────

export type PreflightStatus = 'pass' | 'warn' | 'fail';

export interface PreflightCheck {
  name: string;
  status: PreflightStatus;
  details: string[];
}

export interface PreflightResult {
  overall: PreflightStatus;
  checks: PreflightCheck[];
  canExport: boolean;
  blockers: string[];
  warnings: string[];
  timestamp: string;
}

// ─── Preflight Runner ──────────────────────────────────────

export async function runExportPreflight(
  settingsData: Record<string, unknown> | undefined,
  projectAssets: ProjectAsset[],
  visualPlan?: VisualPlanV1,
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Base theme availability
  const themeCheck = await checkBaseTheme();
  checks.push(themeCheck);
  if (themeCheck.status === 'fail') {
    blockers.push(...themeCheck.details.filter(d => !d.startsWith('✓')));
  } else if (themeCheck.status === 'warn') {
    warnings.push(...themeCheck.details);
  }

  // 2. Settings data presence
  const settingsPresence = checkSettingsPresence(settingsData);
  checks.push(settingsPresence);
  if (settingsPresence.status === 'fail') {
    blockers.push(...settingsPresence.details);
  }

  // 3. Structural validation
  if (settingsData) {
    const structCheck = checkStructuralValidation(settingsData);
    checks.push(structCheck);
    if (structCheck.status === 'fail') blockers.push(...structCheck.details.filter(d => d.startsWith('Error')));
    if (structCheck.status === 'warn') warnings.push(...structCheck.details);
  }

  // 4. Schema validation
  if (settingsData) {
    const schemaCheck = checkSchemaValidation(settingsData);
    checks.push(schemaCheck);
    if (schemaCheck.status === 'fail') blockers.push(...schemaCheck.details.filter(d => d.startsWith('Blocking')));
    if (schemaCheck.status === 'warn') warnings.push(...schemaCheck.details);
  }

  // 5. Asset validation
  if (settingsData) {
    const assetCheck = checkAssets(settingsData, projectAssets);
    checks.push(assetCheck);
    if (assetCheck.status === 'fail') blockers.push(...assetCheck.details.filter(d => d.includes('missing')));
    if (assetCheck.status === 'warn') warnings.push(...assetCheck.details);
  }

  // 6. Kajabi default-fallback check
  if (settingsData) {
    const fallbackCheck = checkKajabiFallbacks(settingsData);
    checks.push(fallbackCheck);
    if (fallbackCheck.status === 'fail') blockers.push(...fallbackCheck.details);
    if (fallbackCheck.status === 'warn') warnings.push(...fallbackCheck.details);
  }

  // 7. Export schema parity check — validates all sections use correct Kajabi fields
  if (settingsData) {
    const parityCheck = checkExportSchemaParity(settingsData, visualPlan);
    checks.push(parityCheck);
    if (parityCheck.status === 'fail') blockers.push(...parityCheck.details.filter(d => d.startsWith('BLOCKED')));
    if (parityCheck.status === 'warn') warnings.push(...parityCheck.details);
  }

  const overall: PreflightStatus = blockers.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';

  return {
    overall,
    checks,
    canExport: blockers.length === 0,
    blockers,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

// ─── Individual Checks ─────────────────────────────────────

async function checkBaseTheme(): Promise<PreflightCheck> {
  let validation: BaseThemeValidation;
  try {
    validation = await validateBaseTheme();
  } catch {
    return {
      name: 'Base Theme',
      status: 'fail',
      details: ['Base theme validation threw an unexpected error'],
    };
  }

  if (validation.health === 'missing') {
    return {
      name: 'Base Theme',
      status: 'fail',
      details: validation.diagnostics.filter(d => d.level === 'error').map(d => d.message),
    };
  }

  if (validation.health === 'invalid') {
    return {
      name: 'Base Theme',
      status: 'fail',
      details: validation.diagnostics.filter(d => d.level === 'error').map(d => d.message),
    };
  }

  const warns = validation.diagnostics.filter(d => d.level === 'warning').map(d => d.message);
  return {
    name: 'Base Theme',
    status: warns.length > 0 ? 'warn' : 'pass',
    details: warns.length > 0 ? warns : ['✓ Base theme is present and valid'],
  };
}

function checkSettingsPresence(settingsData: Record<string, unknown> | undefined): PreflightCheck {
  if (!settingsData || Object.keys(settingsData).length === 0) {
    return {
      name: 'Generated Settings',
      status: 'fail',
      details: ['No settings_data generated. Run Generate first.'],
    };
  }
  const current = (settingsData as { current?: Record<string, unknown> }).current;
  if (!current) {
    return {
      name: 'Generated Settings',
      status: 'fail',
      details: ['Settings data missing "current" key'],
    };
  }
  return {
    name: 'Generated Settings',
    status: 'pass',
    details: ['✓ Settings data present with current key'],
  };
}

function checkStructuralValidation(settingsData: Record<string, unknown>): PreflightCheck {
  const result: ValidationResult = validateSettingsData(settingsData);
  if (!result.valid) {
    return {
      name: 'Structural Validation',
      status: 'fail',
      details: result.errors.map(e => `Error: ${e}`),
    };
  }
  if (result.warnings.length > 0) {
    return {
      name: 'Structural Validation',
      status: 'warn',
      details: result.warnings,
    };
  }
  return {
    name: 'Structural Validation',
    status: 'pass',
    details: ['✓ All structural checks passed'],
  };
}

function checkSchemaValidation(settingsData: Record<string, unknown>): PreflightCheck {
  const current = (settingsData as { current?: { sections?: Record<string, unknown> } }).current;
  if (!current?.sections) {
    return { name: 'Schema Validation', status: 'warn', details: ['No sections to validate'] };
  }

  const report = validateAndRepairSections(
    current.sections as Parameters<typeof validateAndRepairSections>[0]
  );
  const blockingErrors = getExportBlockingErrors(report);

  if (blockingErrors.length > 0) {
    return {
      name: 'Schema Validation',
      status: 'fail',
      details: blockingErrors.map(e => `Blocking: ${e}`),
    };
  }
  if (report.warningCount > 0) {
    return {
      name: 'Schema Validation',
      status: 'warn',
      details: [`${report.warningCount} warning(s), ${report.autoRepairCount} auto-repaired`],
    };
  }
  return {
    name: 'Schema Validation',
    status: 'pass',
    details: ['✓ All schema checks passed'],
  };
}

function checkAssets(
  settingsData: Record<string, unknown>,
  assets: ProjectAsset[],
): PreflightCheck {
  if (assets.length === 0) {
    return { name: 'Assets', status: 'pass', details: ['✓ No assets to validate'] };
  }

  const issues: AssetValidationIssue[] = validateAssets(settingsData, assets);
  const missing = issues.filter(i => i.type === 'missing_asset');
  const orphaned = issues.filter(i => i.type === 'orphaned_asset');

  if (missing.length > 0) {
    return {
      name: 'Assets',
      status: 'fail',
      details: missing.map(i => i.message),
    };
  }
  if (orphaned.length > 0) {
    return {
      name: 'Assets',
      status: 'warn',
      details: orphaned.map(i => i.message),
    };
  }
  return {
    name: 'Assets',
    status: 'pass',
    details: [`✓ ${assets.length} asset(s) validated`],
  };
}

function checkKajabiFallbacks(settingsData: Record<string, unknown>): PreflightCheck {
  const fallbacks = checkForDefaultFallbacks(settingsData);
  if (fallbacks.length === 0) {
    return { name: 'Kajabi Defaults', status: 'pass', details: ['✓ No blocks will fall back to Kajabi defaults'] };
  }

  const critical = fallbacks.filter(f => f.blockType === 'feature' || f.blockType === 'text');
  const details = fallbacks.map(f =>
    `"${f.sectionName}" → ${f.blockType} block: empty [${f.emptyFields.join(', ')}] → will show Kajabi default filler`
  );

  return {
    name: 'Kajabi Defaults',
    status: critical.length > 0 ? 'warn' : 'warn',
    details,
  };
}

function checkExportSchemaParity(
  settingsData: Record<string, unknown>,
  visualPlan?: VisualPlanV1,
): PreflightCheck {
  // Deep clone to avoid mutating the original during transform check
  const clone = JSON.parse(JSON.stringify(settingsData));
  const archetypeMap = buildArchetypeMap(clone, visualPlan);
  const report = transformForExport(clone, archetypeMap);
  const statusList = getSectionParityStatus(report);

  const blocked = statusList.filter(s => s.status === 'blocked');
  const fixed = statusList.filter(s => s.status === 'fixed');

  if (blocked.length > 0) {
    return {
      name: 'Schema Parity',
      status: 'fail',
      details: blocked.map(b => `BLOCKED: ${b.sectionName} (${b.archetype}) — ${b.summary}`),
    };
  }
  if (fixed.length > 0) {
    return {
      name: 'Schema Parity',
      status: 'warn',
      details: [
        `${fixed.length} section(s) have non-schema fields that will be stripped on export`,
        ...fixed.map(f => `${f.sectionName}: ${f.summary}`),
      ],
    };
  }
  return {
    name: 'Schema Parity',
    status: 'pass',
    details: ['✓ All sections use correct Kajabi schema fields'],
  };
}
