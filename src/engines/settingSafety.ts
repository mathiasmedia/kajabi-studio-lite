/**
 * Schema-Aware Setting Safety Engine
 *
 * Classifies Kajabi block/section settings by risk level and enforces
 * safe defaults for layout-breaking settings across the whole pipeline.
 *
 * Key insight: `make_block` means "Place this block on its own row" in Kajabi.
 * Enabling it on repeated-item grid blocks (feature cards, testimonials, icon cards)
 * breaks the multi-column grid layout.
 */

// ============================================================
// 1. Risk classification
// ============================================================

export type SettingRisk = 'layout-breaking' | 'spacing' | 'visibility' | 'style' | 'content';

export interface SettingSafetyDef {
  id: string;
  /** Human label from the real section.liquid schema */
  label: string;
  /** Kajabi setting type */
  type: string;
  risk: SettingRisk;
  /** Safe default value — used unless strong source evidence overrides */
  safeDefault: unknown;
  /** Contexts where enabling this setting is dangerous */
  dangerousContexts?: string[];
  /** Explanation of what this setting actually does in Kajabi */
  kajabiMeaning: string;
}

/**
 * Registry of settings with known risk profiles from the real
 * streamlined-home section.liquid schema.
 */
export const SETTING_SAFETY_REGISTRY: Record<string, SettingSafetyDef> = {
  // ---- Layout-breaking ----
  make_block: {
    id: 'make_block',
    label: 'Place On Own Row',
    type: 'checkbox',
    risk: 'layout-breaking',
    safeDefault: 'false',
    dangerousContexts: [
      'feature_cards', 'icon_card_row', 'testimonials', 'stats_row',
    ],
    kajabiMeaning: 'When true, this block takes the full row width regardless of its width setting. Breaks multi-column grid layouts.',
  },
  make_flush: {
    id: 'make_flush',
    label: 'Full Width',
    type: 'checkbox',
    risk: 'layout-breaking',
    safeDefault: 'false',
    dangerousContexts: [
      'feature_cards', 'icon_card_row', 'testimonials', 'stats_row',
    ],
    kajabiMeaning: 'When true, removes all padding and makes the block edge-to-edge. Can break card grid spacing.',
  },
  width: {
    id: 'width',
    label: 'Column Width',
    type: 'range',
    risk: 'layout-breaking',
    safeDefault: null, // context-dependent — don't override
    dangerousContexts: [],
    kajabiMeaning: 'Column span out of 12. For grids, should be calculated from item count (12/count). Setting to 12 breaks the grid into single-column.',
  },

  // ---- Visibility ----
  hide_on_mobile: {
    id: 'hide_on_mobile',
    label: 'Hide On Mobile',
    type: 'checkbox',
    risk: 'visibility',
    safeDefault: 'false',
    dangerousContexts: [],
    kajabiMeaning: 'Completely hides this block/section on mobile viewports.',
  },
  hide_on_desktop: {
    id: 'hide_on_desktop',
    label: 'Hide On Desktop',
    type: 'checkbox',
    risk: 'visibility',
    safeDefault: 'false',
    dangerousContexts: [],
    kajabiMeaning: 'Completely hides this block/section on desktop viewports.',
  },
  hide_image: {
    id: 'hide_image',
    label: 'Hide Image',
    type: 'checkbox',
    risk: 'visibility',
    safeDefault: 'true',
    dangerousContexts: [],
    kajabiMeaning: 'When true, hides the feature block image. When false without an image URL, shows a broken placeholder.',
  },

  // ---- Spacing ----
  padding_desktop: {
    id: 'padding_desktop',
    label: 'Desktop Padding',
    type: 'padding',
    risk: 'spacing',
    safeDefault: null,
    dangerousContexts: [],
    kajabiMeaning: 'Padding around this block/section on desktop.',
  },
  padding_mobile: {
    id: 'padding_mobile',
    label: 'Mobile Padding',
    type: 'padding',
    risk: 'spacing',
    safeDefault: null,
    dangerousContexts: [],
    kajabiMeaning: 'Padding around this block/section on mobile.',
  },
  border_radius: {
    id: 'border_radius',
    label: 'Border Radius',
    type: 'range',
    risk: 'style',
    safeDefault: '4',
    dangerousContexts: [],
    kajabiMeaning: 'Corner rounding in pixels.',
  },

  // ---- Style ----
  background_color: {
    id: 'background_color',
    label: 'Background Color',
    type: 'color',
    risk: 'style',
    safeDefault: '',
    dangerousContexts: [],
    kajabiMeaning: 'Background color of this block. Empty = transparent/inherited.',
  },
  text_align: {
    id: 'text_align',
    label: 'Text Alignment',
    type: 'select',
    risk: 'style',
    safeDefault: 'center',
    dangerousContexts: [],
    kajabiMeaning: 'Horizontal text alignment within the block.',
  },
  box_shadow: {
    id: 'box_shadow',
    label: 'Shadow',
    type: 'select',
    risk: 'style',
    safeDefault: 'none',
    dangerousContexts: [],
    kajabiMeaning: 'Box shadow effect on the block.',
  },
};

// ============================================================
// 2. Safety check — returns issues for dangerous settings
// ============================================================

export interface SettingSafetyIssue {
  settingId: string;
  label: string;
  risk: SettingRisk;
  currentValue: unknown;
  safeValue: unknown;
  reason: string;
  archetype: string;
  blockId?: string;
  action: 'guarded' | 'warned' | 'overridden';
}

/**
 * Check a block's settings against the safety registry.
 * Returns issues found and optionally mutates settings to safe values.
 */
export function checkBlockSafety(
  settings: Record<string, unknown>,
  archetype: string,
  blockId: string,
  options: { autoFix?: boolean } = {},
): SettingSafetyIssue[] {
  const issues: SettingSafetyIssue[] = [];
  const autoFix = options.autoFix ?? true;

  for (const [key, value] of Object.entries(settings)) {
    const def = SETTING_SAFETY_REGISTRY[key];
    if (!def) continue;
    if (def.risk !== 'layout-breaking') continue;

    // Check if this setting is dangerous in this archetype context
    if (def.dangerousContexts?.includes(archetype)) {
      const safeVal = def.safeDefault;
      if (safeVal !== null && String(value) !== String(safeVal)) {
        const issue: SettingSafetyIssue = {
          settingId: key,
          label: def.label,
          risk: def.risk,
          currentValue: value,
          safeValue: safeVal,
          reason: `${def.kajabiMeaning} Dangerous for ${archetype} grids.`,
          archetype,
          blockId,
          action: autoFix ? 'guarded' : 'warned',
        };
        issues.push(issue);

        if (autoFix) {
          settings[key] = safeVal;
        }
      }
    }
  }

  return issues;
}

/**
 * Check all blocks in a section for safety issues.
 */
export function checkSectionSafety(
  section: { blocks: Record<string, { type: string; settings: Record<string, unknown> }>; block_order: string[] },
  archetype: string,
  options: { autoFix?: boolean } = {},
): SettingSafetyIssue[] {
  const allIssues: SettingSafetyIssue[] = [];

  for (const blockId of section.block_order) {
    const block = section.blocks[blockId];
    if (!block) continue;
    const issues = checkBlockSafety(block.settings, archetype, blockId, options);
    allIssues.push(...issues);
  }

  return allIssues;
}

// ============================================================
// 3. Pipeline-wide enforcement
// ============================================================

/**
 * Enforce setting safety across all sections in a settings_data payload.
 * Call this post-assembly and pre-export.
 */
export function enforceSettingSafety(
  settingsData: Record<string, unknown>,
  archetypeMap: Record<string, string>,
  options: { autoFix?: boolean } = {},
): { issues: SettingSafetyIssue[]; sectionsChecked: number } {
  const current = (settingsData as { current?: { sections?: Record<string, unknown>; content_for_index?: string[] } }).current;
  if (!current?.sections) return { issues: [], sectionsChecked: 0 };

  const sections = current.sections as Record<string, { blocks: Record<string, { type: string; settings: Record<string, unknown> }>; block_order: string[] }>;
  const contentForIndex = (current.content_for_index || []) as string[];

  const allIssues: SettingSafetyIssue[] = [];
  let sectionsChecked = 0;

  for (const sectionId of contentForIndex) {
    if (!sectionId) continue;
    const section = sections[sectionId];
    if (!section?.blocks) continue;

    const archetype = archetypeMap[sectionId] || 'unknown';
    sectionsChecked++;

    const issues = checkSectionSafety(section, archetype, options);
    allIssues.push(...issues);
  }

  if (allIssues.length > 0) {
    const guarded = allIssues.filter(i => i.action === 'guarded').length;
    const warned = allIssues.filter(i => i.action === 'warned').length;
    console.log(`[SettingSafety] ${sectionsChecked} sections checked: ${guarded} guarded, ${warned} warned`);
    for (const issue of allIssues) {
      console.log(`  [${issue.action.toUpperCase()}] ${issue.archetype}/${issue.blockId}: ${issue.settingId}=${JSON.stringify(issue.currentValue)} → ${JSON.stringify(issue.safeValue)} — ${issue.reason}`);
    }
  }

  return { issues: allIssues, sectionsChecked };
}

// ============================================================
// 4. Card styling without make_block
// ============================================================

/**
 * Apply card-like visual styling to a block WITHOUT using make_block.
 * Uses background_color + border_radius + box_shadow instead.
 * This is the SAFE way to style cards in grid contexts.
 */
export function applyCardStyle(
  settings: Record<string, unknown>,
  cardBg: string,
  options: { borderRadius?: string; boxShadow?: string } = {},
): void {
  if (cardBg) {
    settings.background_color = cardBg;
  }
  if (options.borderRadius) {
    settings.border_radius = options.borderRadius;
  }
  // Do NOT set make_block — it breaks grids
  // Do NOT set make_flush — it breaks spacing
}

// ============================================================
// 5. Diagnostics
// ============================================================

export interface SettingSafetyDiagnostics {
  totalChecked: number;
  guarded: number;
  warned: number;
  issues: Array<{
    setting: string;
    label: string;
    risk: SettingRisk;
    archetype: string;
    block: string;
    was: unknown;
    now: unknown;
    reason: string;
  }>;
}

export function formatSafetyDiagnostics(issues: SettingSafetyIssue[]): SettingSafetyDiagnostics {
  return {
    totalChecked: issues.length,
    guarded: issues.filter(i => i.action === 'guarded').length,
    warned: issues.filter(i => i.action === 'warned').length,
    issues: issues.map(i => ({
      setting: i.settingId,
      label: i.label,
      risk: i.risk,
      archetype: i.archetype,
      block: i.blockId || '',
      was: i.currentValue,
      now: i.safeValue,
      reason: i.reason,
    })),
  };
}
