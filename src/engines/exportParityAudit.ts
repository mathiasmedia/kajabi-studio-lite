/**
 * Export Parity Audit Engine
 *
 * Compares internal assembled payload vs exported settings_data.json payload
 * vs Kajabi-expected schema fields, surfacing mismatches that cause Kajabi
 * to fall back to theme defaults (like "Amazing Feature" filler).
 *
 * The audit answers: "Will this section look the same in Kajabi as it does in preview?"
 */
import { BLOCK_FIELD_SCHEMAS, SECTION_ONLY_FIELDS, normalizeLegacyFeatureContent } from './kajabiFieldSchema';

// ---- Types ----

export interface FieldParity {
  field: string;
  internalValue: unknown;
  exportedValue: unknown;
  schemaDefault: unknown;
  status: 'match' | 'mismatch' | 'missing_in_export' | 'will_use_default' | 'extra_field';
  issue?: string;
}

export interface BlockParity {
  blockId: string;
  blockType: string;
  fields: FieldParity[];
  willFallbackToDefaults: boolean;
  criticalMissing: string[];
}

export interface SectionParity {
  sectionId: string;
  sectionName: string;
  sectionType: string;
  blockCount: { internal: number; exported: number };
  blockOrderMatch: boolean;
  blocks: BlockParity[];
  overallStatus: 'match' | 'partial' | 'divergent';
  issues: string[];
}

export interface ParityAuditResult {
  timestamp: string;
  sectionsAudited: number;
  sectionsWithIssues: number;
  criticalIssues: string[];
  warnings: string[];
  sections: SectionParity[];
}

// ---- Known Kajabi schema defaults (from base theme section.liquid schema) ----
// These are the values Kajabi shows when a field is empty/missing in settings_data

const KAJABI_FEATURE_DEFAULTS: Record<string, string> = {
  text: '<h3>Amazing Feature</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent et ante sit amet ligula interdum vehicula.</p>',
  hide_image: 'true',
  text_align: 'center',
  width: '4',
};

const KAJABI_TEXT_DEFAULTS: Record<string, string> = {
  text: '<h2>Welcome</h2><p>Use this text block to add content to your page.</p>',
  text_align: 'center',
  use_btn: 'false',
  btn_text: 'Call To Action',
  width: '12',
};

const KAJABI_IMAGE_DEFAULTS: Record<string, string> = {
  image: '',
  image_alt: '',
  width: '6',
};

const BLOCK_TYPE_DEFAULTS: Record<string, Record<string, string>> = {
  feature: KAJABI_FEATURE_DEFAULTS,
  text: KAJABI_TEXT_DEFAULTS,
  image: KAJABI_IMAGE_DEFAULTS,
};

// ---- Critical fields per block type ----
// If these are empty, Kajabi will show ugly defaults

const CRITICAL_FIELDS: Record<string, string[]> = {
  feature: ['text'],
  text: ['text'],
  image: [],  // Image can be empty (shows placeholder)
};

// ---- Schema mismatch detection ----
// Internal model may use legacy field names (heading/body) that don't match
// the real Kajabi `block_feature.liquid` schema, which uses a single `text`
// HTML field. Legacy payloads should be folded into `text` upstream via
// `normalizeLegacyFeatureContent`; we only warn here when that hasn't happened.

const BLOCK_TYPE_WARNINGS: Record<string, string> = {
  // (Removed stale `feature` warning — streamlined-home DOES render feature
  //  blocks per block_feature.liquid; legacy heading/body shape is handled
  //  by `detectNormalizedFieldMismatch` below.)
};

/**
 * Body sections in streamlined-home accept text/image/feature blocks.
 * (Conservative expansion this pass — only `feature` was added; broader
 *  expansion to match ALLOWED_BLOCKS_PER_SECTION.section can come later
 *  once we've verified each downstream consumer.)
 */
const VALID_BODY_BLOCK_TYPES = new Set(['text', 'image', 'feature']);

/**
 * Detect blocks that still carry legacy {heading, body} content with no
 * non-empty `text` field — these will render Kajabi's "Amazing Feature"
 * defaults because the real schema reads `block.settings.text`.
 *
 * Reuses `normalizeLegacyFeatureContent` so builder + audit share rules.
 */
function detectNormalizedFieldMismatch(
  blockType: string,
  settings: Record<string, unknown>,
): string | null {
  const text = typeof settings.text === 'string' ? settings.text : '';
  const hasNonEmptyText = text.replace(/<[^>]*>/g, '').trim().length > 0;

  if (blockType === 'feature') {
    // Feature block must have a populated text field.
    if (!hasNonEmptyText) {
      return `Feature block has no non-empty "text" field. Kajabi will fall back to "Amazing Feature" defaults.`;
    }
    return null;
  }

  // Non-feature block carrying legacy heading/body but no text → mismatch.
  const hasLegacy =
    (typeof settings.heading === 'string' && settings.heading.trim().length > 0) ||
    (typeof settings.body === 'string' && settings.body.trim().length > 0);
  if (hasLegacy && !hasNonEmptyText) {
    return `Block uses legacy field names (heading/body) instead of real schema field (text). Kajabi will ignore heading/body and show defaults.`;
  }
  return null;
}

// ---- Audit functions ----

function auditBlock(
  blockId: string,
  internalBlock: { type: string; settings: Record<string, unknown> } | undefined,
  exportedBlock: { type: string; settings: Record<string, unknown> } | undefined,
): BlockParity {
  const blockType = internalBlock?.type || exportedBlock?.type || 'unknown';
  const fields: FieldParity[] = [];
  const criticalMissing: string[] = [];
  const kajabiDefaults = BLOCK_TYPE_DEFAULTS[blockType] || {};
  const criticalKeys = CRITICAL_FIELDS[blockType] || [];
  const schemaFields = BLOCK_FIELD_SCHEMAS[blockType] || {};

  // Check all fields in the schema
  const allKeys = new Set([
    ...Object.keys(schemaFields),
    ...Object.keys(internalBlock?.settings || {}),
    ...Object.keys(exportedBlock?.settings || {}),
  ]);

  for (const key of allKeys) {
    const internalVal = internalBlock?.settings?.[key];
    const exportedVal = exportedBlock?.settings?.[key];
    const schemaDefault = schemaFields[key]?.defaultValue ?? kajabiDefaults[key];

    let status: FieldParity['status'] = 'match';
    let issue: string | undefined;

    if (internalVal !== undefined && exportedVal === undefined) {
      status = 'missing_in_export';
      issue = `Field "${key}" exists in internal state but missing from export`;
    } else if (internalVal === undefined && exportedVal !== undefined) {
      status = 'extra_field';
    } else if (JSON.stringify(internalVal) !== JSON.stringify(exportedVal)) {
      status = 'mismatch';
      issue = `Internal: ${JSON.stringify(internalVal)}, Export: ${JSON.stringify(exportedVal)}`;
    }

    // Check if exported value is empty/default → Kajabi will show schema default
    if (exportedVal === '' || exportedVal === undefined || exportedVal === null) {
      if (criticalKeys.includes(key)) {
        status = 'will_use_default';
        issue = `Empty "${key}" → Kajabi will show: "${kajabiDefaults[key] || schemaDefault || '(theme default)'}"`;
        criticalMissing.push(key);
      }
    }

    // Only record non-trivial fields
    if (status !== 'match' || criticalKeys.includes(key)) {
      fields.push({ field: key, internalValue: internalVal, exportedValue: exportedVal, schemaDefault, status, issue });
    }
  }

  // Check for block types that Kajabi won't render correctly in body sections
  const blockTypeWarning = BLOCK_TYPE_WARNINGS[blockType];
  if (blockTypeWarning) {
    criticalMissing.push(`block_type:${blockType}`);
    fields.push({
      field: '__block_type',
      internalValue: blockType,
      exportedValue: blockType,
      schemaDefault: 'text',
      status: 'will_use_default',
      issue: blockTypeWarning,
    });
  }

  // Check for invalid block types in body sections (only text/image are valid)
  if (!VALID_BODY_BLOCK_TYPES.has(blockType) && !['logo', 'menu', 'copyright'].includes(blockType)) {
    if (!blockTypeWarning) { // Don't double-flag
      criticalMissing.push(`invalid_block_type:${blockType}`);
      fields.push({
        field: '__block_type',
        internalValue: blockType,
        exportedValue: blockType,
        schemaDefault: 'text',
        status: 'will_use_default',
        issue: `Block type "${blockType}" is not supported in streamlined-home body sections. Only "text", "image", and "feature" blocks are valid here.`,
      });
    }
  }

  // Detect internal normalized field names (heading/body) that Kajabi ignores
  const exportedSettings = exportedBlock?.settings || {};
  const normalizedMismatch = detectNormalizedFieldMismatch(blockType, exportedSettings);
  if (normalizedMismatch) {
    criticalMissing.push('normalized_field_mismatch');
    fields.push({
      field: '__field_schema',
      internalValue: 'heading/body',
      exportedValue: 'missing text field',
      schemaDefault: 'block.settings.text',
      status: 'will_use_default',
      issue: normalizedMismatch,
    });
  }

  return {
    blockId,
    blockType,
    fields,
    willFallbackToDefaults: criticalMissing.length > 0,
    criticalMissing,
  };
}

function auditSection(
  sectionId: string,
  internalSection: Record<string, unknown> | undefined,
  exportedSection: Record<string, unknown> | undefined,
): SectionParity {
  const issues: string[] = [];
  const iSec = internalSection as { name?: string; type?: string; blocks?: Record<string, any>; block_order?: string[]; settings?: Record<string, unknown> } | undefined;
  const eSec = exportedSection as { name?: string; type?: string; blocks?: Record<string, any>; block_order?: string[]; settings?: Record<string, unknown> } | undefined;

  const sectionName = iSec?.name || eSec?.name || sectionId;
  const sectionType = iSec?.type || eSec?.type || 'unknown';

  if (!exportedSection) {
    return {
      sectionId, sectionName, sectionType,
      blockCount: { internal: Object.keys(iSec?.blocks || {}).length, exported: 0 },
      blockOrderMatch: false,
      blocks: [],
      overallStatus: 'divergent',
      issues: [`Section "${sectionName}" exists in internal state but MISSING from exported settings_data`],
    };
  }

  if (!internalSection) {
    return {
      sectionId, sectionName, sectionType,
      blockCount: { internal: 0, exported: Object.keys(eSec?.blocks || {}).length },
      blockOrderMatch: false,
      blocks: [],
      overallStatus: 'divergent',
      issues: [`Section "${sectionName}" exists in export but not in internal state (may be original template section)`],
    };
  }

  // Compare block counts
  const iBlocks = iSec?.blocks || {};
  const eBlocks = eSec?.blocks || {};
  const iBlockOrder = iSec?.block_order || [];
  const eBlockOrder = eSec?.block_order || [];

  const blockCountMatch = Object.keys(iBlocks).length === Object.keys(eBlocks).length;
  if (!blockCountMatch) {
    issues.push(`Block count mismatch: internal=${Object.keys(iBlocks).length}, exported=${Object.keys(eBlocks).length}`);
  }

  const blockOrderMatch = JSON.stringify(iBlockOrder) === JSON.stringify(eBlockOrder);
  if (!blockOrderMatch) {
    issues.push('Block order differs between internal and exported');
  }

  // Audit each block
  const allBlockIds = new Set([...Object.keys(iBlocks), ...Object.keys(eBlocks)]);
  const blocks: BlockParity[] = [];
  
  for (const blockId of allBlockIds) {
    blocks.push(auditBlock(blockId, iBlocks[blockId], eBlocks[blockId]));
  }

  const hasDefaultFallbacks = blocks.some(b => b.willFallbackToDefaults);
  const hasMismatches = blocks.some(b => b.fields.some(f => f.status === 'mismatch' || f.status === 'missing_in_export'));

  if (hasDefaultFallbacks) {
    const fallbackBlocks = blocks.filter(b => b.willFallbackToDefaults);
    for (const fb of fallbackBlocks) {
      issues.push(`Block "${fb.blockId}" (${fb.blockType}) will show Kajabi defaults for: ${fb.criticalMissing.join(', ')}`);
    }
  }

  let overallStatus: SectionParity['overallStatus'] = 'match';
  if (hasDefaultFallbacks) overallStatus = 'divergent';
  else if (hasMismatches || !blockCountMatch) overallStatus = 'partial';

  return {
    sectionId,
    sectionName,
    sectionType,
    blockCount: { internal: Object.keys(iBlocks).length, exported: Object.keys(eBlocks).length },
    blockOrderMatch,
    blocks,
    overallStatus,
    issues,
  };
}

/**
 * Run a full parity audit comparing internal assembled state with exported settings.
 * Call this after assembly + export merge to detect divergence.
 */
export function runParityAudit(
  internalSettingsData: Record<string, unknown>,
  exportedSettingsData: Record<string, unknown>,
): ParityAuditResult {
  const iCurrent = (internalSettingsData as any)?.current || {};
  const eCurrent = (exportedSettingsData as any)?.current || {};
  
  const iSections = (iCurrent.sections || {}) as Record<string, unknown>;
  const eSections = (eCurrent.sections || {}) as Record<string, unknown>;
  
  const iContentForIndex = (iCurrent.content_for_index || []) as string[];
  const eContentForIndex = (eCurrent.content_for_index || []) as string[];

  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const sections: SectionParity[] = [];

  // Check content_for_index parity
  if (JSON.stringify(iContentForIndex) !== JSON.stringify(eContentForIndex)) {
    warnings.push(`content_for_index differs: internal has ${iContentForIndex.length} entries, exported has ${eContentForIndex.length}`);
  }

  // Audit header + footer
  for (const specialId of ['header', 'footer']) {
    const parity = auditSection(specialId, iSections[specialId] as any, eSections[specialId] as any);
    sections.push(parity);
    if (parity.overallStatus === 'divergent') {
      criticalIssues.push(`${specialId}: ${parity.issues.join('; ')}`);
    }
  }

  // Audit content sections (from content_for_index)
  const contentIds = new Set([
    ...iContentForIndex.filter(Boolean),
    ...eContentForIndex.filter(Boolean),
  ]);

  for (const secId of contentIds) {
    const parity = auditSection(secId, iSections[secId] as any, eSections[secId] as any);
    sections.push(parity);
    if (parity.overallStatus === 'divergent') {
      criticalIssues.push(`Section "${parity.sectionName}": ${parity.issues.join('; ')}`);
    } else if (parity.overallStatus === 'partial') {
      warnings.push(`Section "${parity.sectionName}": ${parity.issues.join('; ')}`);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    sectionsAudited: sections.length,
    sectionsWithIssues: sections.filter(s => s.overallStatus !== 'match').length,
    criticalIssues,
    warnings,
    sections,
  };
}

/**
 * Quick pre-export check: scan assembled settingsData for blocks
 * that will fall back to Kajabi defaults (empty critical fields).
 */
export function checkForDefaultFallbacks(
  settingsData: Record<string, unknown>,
): { sectionId: string; sectionName: string; blockId: string; blockType: string; emptyFields: string[] }[] {
  const current = (settingsData as any)?.current;
  if (!current?.sections) return [];

  const fallbacks: { sectionId: string; sectionName: string; blockId: string; blockType: string; emptyFields: string[] }[] = [];
  const sections = current.sections as Record<string, any>;

  for (const [secId, sec] of Object.entries(sections)) {
    const blocks = sec.blocks || {};
    for (const [blockId, block] of Object.entries(blocks as Record<string, any>)) {
      const critical = CRITICAL_FIELDS[block.type] || [];
      const emptyFields: string[] = [];
      
      for (const field of critical) {
        const val = block.settings?.[field];
        if (val === undefined || val === null || val === '') {
          emptyFields.push(field);
        }
      }

      if (emptyFields.length > 0) {
        fallbacks.push({
          sectionId: secId,
          sectionName: sec.name || secId,
          blockId,
          blockType: block.type,
          emptyFields,
        });
      }
    }
  }

  return fallbacks;
}

/**
 * Simulate what Kajabi will render by filling in schema defaults for empty fields.
 * Returns a copy of settingsData with defaults applied — useful for "Kajabi preview" mode.
 */
export function simulateKajabiDefaults(
  settingsData: Record<string, unknown>,
): Record<string, unknown> {
  const simulated = JSON.parse(JSON.stringify(settingsData));
  const current = (simulated as any)?.current;
  if (!current?.sections) return simulated;

  const sections = current.sections as Record<string, any>;

  for (const [, sec] of Object.entries(sections)) {
    const blocks = sec.blocks || {};
    for (const [, block] of Object.entries(blocks as Record<string, any>)) {
      const defaults = BLOCK_TYPE_DEFAULTS[block.type];
      if (!defaults) continue;

      for (const [key, defaultVal] of Object.entries(defaults)) {
        const currentVal = block.settings?.[key];
        if (currentVal === undefined || currentVal === null || currentVal === '') {
          if (!block.settings) block.settings = {};
          block.settings[key] = defaultVal;
        }
      }
    }
  }

  return simulated;
}
