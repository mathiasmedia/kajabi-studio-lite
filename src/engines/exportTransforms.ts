/**
 * Export Transforms — Per-section-archetype transforms that convert
 * internal assembled payload to exact Kajabi streamlined-home schema fields.
 *
 * Each body section in streamlined-home is type: "section" with only
 * text and image blocks. This engine strips non-schema fields,
 * validates block types, and ensures every field Kajabi reads is present.
 */

import { BLOCK_FIELD_SCHEMAS, SECTION_ONLY_FIELDS, normalizeLegacyFeatureContent } from './kajabiFieldSchema';

// ---- Valid Kajabi section-level settings keys ----
const VALID_SECTION_SETTINGS = new Set([
  'max_width', 'hide_on_mobile', 'hide_on_desktop',
  'background_type', 'background_color', 'background_image',
  'background_overlay', 'background_overlay_opacity',
  'text_color', 'padding_desktop', 'padding_mobile',
]);

// ---- Valid header/footer-specific settings ----
const VALID_HEADER_SETTINGS = new Set([
  ...VALID_SECTION_SETTINGS,
  'sticky', 'position', 'horizontal', 'font_size_mobile', 'font_size_desktop',
  'vertical_layout',
]);

// ---- Non-schema fields that recipes may add internally ----
const INTERNAL_ONLY_FIELDS = new Set([
  'panel_background_color', // Used for preview only — not a real Kajabi field
]);

// ---- Transform result ----

export interface SectionTransformResult {
  sectionId: string;
  sectionName: string;
  archetype: string;
  transformed: boolean;
  strippedFields: string[];
  blockTypeIssues: string[];
  missingCriticalFields: string[];
  status: 'clean' | 'fixed' | 'blocked';
  issues: string[];
}

export interface TransformReport {
  timestamp: string;
  sectionsTransformed: number;
  sectionsBlocked: number;
  totalStrippedFields: number;
  sections: SectionTransformResult[];
}

// ---- Per-block transform ----

function transformBlockSettings(
  blockType: string,
  settings: Record<string, unknown>,
): { cleaned: Record<string, unknown>; stripped: string[] } {
  const schema = BLOCK_FIELD_SCHEMAS[blockType];
  if (!schema) return { cleaned: { ...settings }, stripped: [] };

  const cleaned: Record<string, unknown> = {};
  const stripped: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    // Keep fields that exist in schema
    if (key in schema) {
      cleaned[key] = value;
      continue;
    }
    // Keep shared padding/margin fields that may not be in every schema
    if (key.startsWith('padding_') || key.startsWith('margin_')) {
      cleaned[key] = value;
      continue;
    }
    // Strip internal-only fields
    if (INTERNAL_ONLY_FIELDS.has(key)) {
      stripped.push(key);
      continue;
    }
    // Strip section-only fields that leaked into blocks
    if (SECTION_ONLY_FIELDS.has(key)) {
      stripped.push(key);
      continue;
    }
    // Keep unknown fields as a safety measure (Kajabi ignores them harmlessly)
    cleaned[key] = value;
  }

  return { cleaned, stripped };
}

// ---- Per-section transform ----

function transformSectionSettings(
  settings: Record<string, unknown>,
  sectionType: string,
): { cleaned: Record<string, unknown>; stripped: string[] } {
  const validSet = sectionType === 'header' || sectionType === 'footer'
    ? VALID_HEADER_SETTINGS
    : VALID_SECTION_SETTINGS;

  const cleaned: Record<string, unknown> = {};
  const stripped: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    if (validSet.has(key)) {
      cleaned[key] = value;
    } else if (INTERNAL_ONLY_FIELDS.has(key)) {
      stripped.push(key);
    } else {
      // Keep unknown section-level fields (theme may use them)
      cleaned[key] = value;
    }
  }

  return { cleaned, stripped };
}

// ---- Section-level archetype contract validation ----

interface ArchetypeContract {
  validBlockTypes: Set<string>;
  requiredContent: string[]; // at least one block must have non-empty values for these
}

const BODY_SECTION_CONTRACT: ArchetypeContract = {
  validBlockTypes: new Set(['text', 'image', 'code', 'feature']),
  requiredContent: ['text'], // at least one text/feature block with non-empty content, or code block
};

const CODE_CARD_SECTION_CONTRACT: ArchetypeContract = {
  validBlockTypes: new Set(['text', 'image', 'code']),
  requiredContent: ['code'], // code blocks carry the card content
};

const SECTION_CONTRACTS: Record<string, ArchetypeContract> = {
  hero: BODY_SECTION_CONTRACT,
  stats_row: BODY_SECTION_CONTRACT,
  icon_card_row: CODE_CARD_SECTION_CONTRACT,
  feature_cards: BODY_SECTION_CONTRACT,
  content_media_split: BODY_SECTION_CONTRACT,
  testimonials: BODY_SECTION_CONTRACT,
  cta_band: BODY_SECTION_CONTRACT,
};

// ---- Main transform function ----

/**
 * Transform assembled settings_data sections for export.
 * Strips non-schema fields, validates block types, and ensures
 * the payload matches what Kajabi's streamlined-home theme reads.
 *
 * Mutates the sections in place and returns a diagnostic report.
 */
export function transformForExport(
  settingsData: Record<string, unknown>,
  sectionArchetypes?: Record<string, string>, // sectionId → archetype
): TransformReport {
  const current = (settingsData as any)?.current;
  if (!current?.sections) {
    return { timestamp: new Date().toISOString(), sectionsTransformed: 0, sectionsBlocked: 0, totalStrippedFields: 0, sections: [] };
  }

  const sections = current.sections as Record<string, any>;
  const contentForIndex = (current.content_for_index || []) as string[];
  const results: SectionTransformResult[] = [];
  let totalStripped = 0;

  // Process all sections referenced in content_for_index + header + footer
  const sectionIds = new Set([
    'header', 'footer',
    ...contentForIndex.filter(Boolean),
  ]);

  for (const secId of sectionIds) {
    const sec = sections[secId];
    if (!sec) continue;

    const sectionType = sec.type || 'section';
    const sectionName = sec.name || secId;
    const archetype = sectionArchetypes?.[secId] || sectionType;
    const contract = SECTION_CONTRACTS[archetype];

    const result: SectionTransformResult = {
      sectionId: secId,
      sectionName,
      archetype,
      transformed: false,
      strippedFields: [],
      blockTypeIssues: [],
      missingCriticalFields: [],
      status: 'clean',
      issues: [],
    };

    // Transform section settings
    const { cleaned: cleanedSettings, stripped: sectionStripped } =
      transformSectionSettings(sec.settings || {}, sectionType);
    if (sectionStripped.length > 0) {
      sec.settings = cleanedSettings;
      result.strippedFields.push(...sectionStripped.map(f => `section.${f}`));
      result.transformed = true;
    }

    // Transform block settings
    const blocks = sec.blocks || {};
    for (const [blockId, block] of Object.entries(blocks as Record<string, any>)) {
      const blockType = block.type;

      // Check block type validity for body sections
      if (contract && !contract.validBlockTypes.has(blockType) && sectionType === 'section') {
        result.blockTypeIssues.push(
          `Block "${blockId}" uses type "${blockType}" — only ${[...contract.validBlockTypes].join('/')} allowed in body sections`
        );
        result.status = 'blocked';
      }

      const { cleaned: cleanedBlock, stripped: blockStripped } =
        transformBlockSettings(blockType, block.settings || {});
      if (blockStripped.length > 0) {
        block.settings = cleanedBlock;
        result.strippedFields.push(...blockStripped.map(f => `block[${blockId}].${f}`));
        result.transformed = true;
      }
    }

    // Validate critical content presence
    if (contract && sectionType === 'section') {
      const hasTextContent = Object.values(blocks as Record<string, any>).some(
        (b: any) => b.type === 'text' && b.settings?.text && String(b.settings.text).replace(/<[^>]*>/g, '').trim().length > 0
      );
      const hasCodeContent = Object.values(blocks as Record<string, any>).some(
        (b: any) => b.type === 'code' && b.settings?.code && String(b.settings.code).trim().length > 0
      );
      const hasFeatureContent = Object.values(blocks as Record<string, any>).some((b: any) => {
        if (b.type !== 'feature') return false;
        const folded = normalizeLegacyFeatureContent({
          text: typeof b.settings?.text === 'string' ? b.settings.text : undefined,
          heading: typeof b.settings?.heading === 'string' ? b.settings.heading : undefined,
          body: typeof b.settings?.body === 'string' ? b.settings.body : undefined,
          extraHtml: typeof b.settings?.extraHtml === 'string' ? b.settings.extraHtml : undefined,
        });
        return folded.replace(/<[^>]*>/g, '').trim().length > 0;
      });
      if (!hasTextContent && !hasCodeContent && !hasFeatureContent) {
        result.missingCriticalFields.push('No text, code, or feature block with content found');
        if (result.status !== 'blocked') result.status = 'fixed';
      }
    }

    if (result.blockTypeIssues.length > 0) {
      result.issues.push(...result.blockTypeIssues);
    }
    if (result.missingCriticalFields.length > 0) {
      result.issues.push(...result.missingCriticalFields);
    }
    if (result.strippedFields.length > 0 && result.status === 'clean') {
      result.status = 'fixed';
    }

    totalStripped += result.strippedFields.length;
    results.push(result);
  }

  return {
    timestamp: new Date().toISOString(),
    sectionsTransformed: results.filter(r => r.transformed).length,
    sectionsBlocked: results.filter(r => r.status === 'blocked').length,
    totalStrippedFields: totalStripped,
    sections: results,
  };
}

/**
 * Build a section-archetype map from the visual plan and content_for_index.
 * Maps dynamic section IDs to their archetype names.
 */
export function buildArchetypeMap(
  settingsData: Record<string, unknown>,
  visualPlan?: { hero?: { archetype?: string }; sections?: Array<{ archetype?: string }> },
): Record<string, string> {
  const map: Record<string, string> = {};
  const current = (settingsData as any)?.current;
  if (!current) return map;

  map['header'] = 'header';
  map['footer'] = 'footer';

  const contentForIndex = (current.content_for_index || []) as string[];
  const bodyIds = contentForIndex.filter(Boolean);

  if (visualPlan) {
    // First body ID is hero
    if (bodyIds[0] && visualPlan.hero) {
      map[bodyIds[0]] = visualPlan.hero.archetype || 'hero';
    }
    // Remaining body IDs map to sections array
    const sections = visualPlan.sections || [];
    for (let i = 0; i < sections.length && i + 1 < bodyIds.length; i++) {
      map[bodyIds[i + 1]] = sections[i].archetype || 'section';
    }
  }

  return map;
}

/**
 * Get a human-readable parity summary per section for UI display.
 */
export function getSectionParityStatus(
  report: TransformReport,
): Array<{
  sectionId: string;
  sectionName: string;
  archetype: string;
  status: 'clean' | 'fixed' | 'blocked';
  summary: string;
}> {
  return report.sections.map(s => ({
    sectionId: s.sectionId,
    sectionName: s.sectionName,
    archetype: s.archetype,
    status: s.status,
    summary: s.status === 'clean'
      ? 'All fields match Kajabi schema'
      : s.status === 'fixed'
        ? `${s.strippedFields.length} non-schema field(s) removed${s.missingCriticalFields.length > 0 ? '; ' + s.missingCriticalFields.join('; ') : ''}`
        : `BLOCKED: ${s.issues.join('; ')}`,
  }));
}
