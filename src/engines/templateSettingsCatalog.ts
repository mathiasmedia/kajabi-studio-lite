/**
 * Template-level Settings Catalog
 *
 * Authoritative index of every setting in the streamlined-home theme's
 * config/settings_schema.json. These are the GLOBAL theme settings that
 * live at the top level of settings_data.json's `current` object (alongside
 * `sections`, `content_for_index`, `link_lists`).
 *
 * Source of truth: streamlined-home/config/settings_schema.json (extracted
 * from the base zip — re-run `npm run extract:settings-schema` to regenerate
 * if the base theme is updated).
 *
 * Use this to:
 *   - Validate that emitted top-level keys are real schema fields
 *   - Provide typed defaults for global theme settings
 *   - Power a future "global settings" UI / AI prompt
 *   - Detect when an emitted value violates field constraints (range, options)
 */

export type SettingFieldType =
  | 'checkbox'
  | 'color'
  | 'font_select'
  | 'image_picker'
  | 'pill_tabs'
  | 'range'
  | 'select'
  | 'text'
  | 'textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export interface TemplateSettingField {
  /** Setting id — the key under settings_data.current */
  id: string;
  /** Human-readable label from the Kajabi editor */
  label?: string;
  /** Field type (drives UI + validation) */
  type: SettingFieldType;
  /** Group name (e.g. "Style Guide", "Custom Code") */
  group: string;
  /** Default value as it appears in the schema (always string-ish in Kajabi) */
  default?: string;
  /** For select/pill_tabs — allowed option values */
  options?: SelectOption[];
  /** For range — min/max */
  min?: string;
  max?: string;
  /** Schema preset name (e.g. "google_fonts", "font_sizes") */
  preset?: string;
  /** Allow blank value */
  allowBlank?: boolean;
  /** Helper text from the schema */
  info?: string;
}

export interface TemplateSettingGroup {
  name: string;
  fields: TemplateSettingField[];
}

// ============================================================================
// CATALOG — extracted from streamlined-home/config/settings_schema.json
// ============================================================================

export const TEMPLATE_SETTINGS_CATALOG: TemplateSettingGroup[] = [
  {
    name: 'Favicon',
    fields: [
      { id: 'favicon', label: 'Favicon image', type: 'image_picker', group: 'Favicon', default: '', info: 'Must be a 32x32 PNG file.' },
    ],
  },
  {
    name: 'Style Guide',
    fields: [
      { id: 'background_color', label: 'Page background', type: 'color', group: 'Style Guide', allowBlank: true },
      { id: 'use_background_image', label: 'Use background image', type: 'checkbox', group: 'Style Guide', default: 'false' },
      { id: 'background_image', label: 'Background Image', type: 'image_picker', group: 'Style Guide' },
      { id: 'color_primary', label: 'Primary', type: 'color', group: 'Style Guide', default: '', allowBlank: true },
      // Buttons
      { id: 'btn_width', label: 'Width', type: 'pill_tabs', group: 'Style Guide', default: 'auto', options: [{ value: 'full', label: 'Full' }, { value: 'auto', label: 'Auto' }] },
      { id: 'btn_style', label: 'Style', type: 'pill_tabs', group: 'Style Guide', default: 'solid', options: [{ value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }] },
      { id: 'btn_size', label: 'Size', type: 'pill_tabs', group: 'Style Guide', default: 'medium', options: [{ value: 'small', label: 'Sm' }, { value: 'medium', label: 'Md' }, { value: 'large', label: 'Lg' }] },
      { id: 'btn_border_radius', label: 'Border radius', type: 'range', group: 'Style Guide', default: '4', min: '0', max: '50' },
      { id: 'btn_text_color', label: 'Text', type: 'color', group: 'Style Guide', default: '#ffffff', info: 'For solid buttons only' },
      { id: 'btn_background_color', label: 'Button', type: 'color', group: 'Style Guide', default: '', allowBlank: true },
      // Body font
      { id: 'font_family_body', label: 'Family', type: 'font_select', group: 'Style Guide', default: '', allowBlank: true, preset: 'google_fonts' },
      { id: 'font_weight_body', label: 'Weight', type: 'select', group: 'Style Guide', default: '400', options: [{ value: '400', label: 'Normal' }, { value: '700', label: 'Bold' }] },
      { id: 'line_height_body', label: 'Line height', type: 'text', group: 'Style Guide', default: '1.6' },
      // Heading font
      { id: 'font_family_heading', label: 'Family', type: 'font_select', group: 'Style Guide', default: '', allowBlank: true, preset: 'google_fonts' },
      { id: 'font_weight_heading', label: 'Weight', type: 'select', group: 'Style Guide', default: '700', options: [{ value: '400', label: 'Normal' }, { value: '700', label: 'Bold' }] },
      { id: 'line_height_heading', label: 'Line height', type: 'text', group: 'Style Guide', default: '1.2' },
      // Font colors
      { id: 'color_heading', label: 'Heading', type: 'color', group: 'Style Guide', default: '#161E2A' },
      { id: 'color_body', label: 'Body', type: 'color', group: 'Style Guide', default: '#595959' },
      { id: 'color_body_secondary', label: 'Secondary', type: 'color', group: 'Style Guide', default: '#888888' },
      { id: 'color_placeholder', label: 'Placeholder', type: 'color', group: 'Style Guide', default: '#cccccc' },
      // Desktop font sizes
      { id: 'font_size_h1_desktop', label: 'h1', type: 'select', group: 'Style Guide', default: '48px', preset: 'font_sizes' },
      { id: 'font_size_h2_desktop', label: 'h2', type: 'select', group: 'Style Guide', default: '36px', preset: 'font_sizes' },
      { id: 'font_size_h3_desktop', label: 'h3', type: 'select', group: 'Style Guide', default: '30px', preset: 'font_sizes' },
      { id: 'font_size_h4_desktop', label: 'h4', type: 'select', group: 'Style Guide', default: '24px', preset: 'font_sizes' },
      { id: 'font_size_h5_desktop', label: 'h5', type: 'select', group: 'Style Guide', default: '20px', preset: 'font_sizes' },
      { id: 'font_size_h6_desktop', label: 'h6', type: 'select', group: 'Style Guide', default: '16px', preset: 'font_sizes' },
      { id: 'font_size_body_desktop', label: 'Body', type: 'select', group: 'Style Guide', default: '18px', preset: 'font_sizes' },
      // Mobile font sizes
      { id: 'font_size_h1_mobile', label: 'h1', type: 'select', group: 'Style Guide', default: '36px', preset: 'font_sizes' },
      { id: 'font_size_h2_mobile', label: 'h2', type: 'select', group: 'Style Guide', default: '30px', preset: 'font_sizes' },
      { id: 'font_size_h3_mobile', label: 'h3', type: 'select', group: 'Style Guide', default: '24px', preset: 'font_sizes' },
      { id: 'font_size_h4_mobile', label: 'h4', type: 'select', group: 'Style Guide', default: '20px', preset: 'font_sizes' },
      { id: 'font_size_h5_mobile', label: 'h5', type: 'select', group: 'Style Guide', default: '18px', preset: 'font_sizes' },
      { id: 'font_size_h6_mobile', label: 'h6', type: 'select', group: 'Style Guide', default: '16px', preset: 'font_sizes' },
      { id: 'font_size_body_mobile', label: 'Body', type: 'select', group: 'Style Guide', default: '16px', preset: 'font_sizes' },
      // Error messages
      { id: 'error_message_text_color', label: 'Text', type: 'color', group: 'Style Guide', default: '#ffffff' },
      { id: 'error_message_background_color', label: 'Background', type: 'color', group: 'Style Guide', default: '#ff0000' },
    ],
  },
  {
    name: 'Design Tools',
    fields: [
      { id: 'show_guides', label: 'Show guides', type: 'checkbox', group: 'Design Tools', default: 'true' },
      { id: 'show_grid', label: 'Show grid', type: 'checkbox', group: 'Design Tools', default: 'false' },
    ],
  },
  {
    name: 'Custom Code',
    fields: [
      { id: 'css', label: 'CSS code', type: 'textarea', group: 'Custom Code', default: '/* CSS code goes here */' },
      { id: 'js', label: 'Javascript code', type: 'textarea', group: 'Custom Code', default: '/* Javascript code goes here */' },
    ],
  },
  {
    name: 'Password Recovery',
    fields: [
      { id: 'recover_text', label: 'Recover text', type: 'text', group: 'Password Recovery', default: 'Recover Password' },
      { id: 'email_text', label: 'Email text', type: 'text', group: 'Password Recovery', default: 'Email' },
      { id: 'recovery_text', label: 'Recovery text', type: 'text', group: 'Password Recovery', default: 'Send Recovery Info' },
      { id: 'login_text', label: 'Log in text', type: 'text', group: 'Password Recovery', default: 'Log In' },
      { id: 'include_forgot_password_header', label: 'Include header', type: 'checkbox', group: 'Password Recovery', default: 'true' },
      { id: 'include_forgot_password_footer', label: 'Include footer', type: 'checkbox', group: 'Password Recovery', default: 'true' },
    ],
  },
  {
    name: 'Password Reset',
    fields: [
      { id: 'reset_text', label: 'Reset text', type: 'text', group: 'Password Reset', default: 'Create New Password' },
      { id: 'new_password', label: 'New password text', type: 'text', group: 'Password Reset', default: 'Enter New Password' },
      { id: 'confirm_password', label: 'Confirm password text', type: 'text', group: 'Password Reset', default: 'Confirm Password' },
      { id: 'reset_btn', label: 'Reset button text', type: 'text', group: 'Password Reset', default: 'Submit' },
      { id: 'include_password_reset_header', label: 'Include header', type: 'checkbox', group: 'Password Reset', default: 'true' },
      { id: 'include_password_reset_footer', label: 'Include footer', type: 'checkbox', group: 'Password Reset', default: 'true' },
    ],
  },
  {
    name: 'Disqus Comments',
    fields: [
      { id: 'show_comments', label: 'Show disqus comments', type: 'checkbox', group: 'Disqus Comments', default: 'false' },
      { id: 'short_code', label: 'Disqus shortname', type: 'text', group: 'Disqus Comments', default: '' },
    ],
  },
  {
    name: 'Disabled Pages',
    fields: [
      { id: 'member_directory_disabled', label: 'Member directory', type: 'checkbox', group: 'Disabled Pages', default: 'false' },
      { id: 'announcements_disabled', label: 'Announcements', type: 'checkbox', group: 'Disabled Pages', default: 'false' },
    ],
  },
];

// ============================================================================
// Derived lookups
// ============================================================================

/** Flat array of every template setting field */
export const ALL_TEMPLATE_SETTINGS: TemplateSettingField[] =
  TEMPLATE_SETTINGS_CATALOG.flatMap(g => g.fields);

/** Map: settingId → field definition */
export const TEMPLATE_SETTINGS_BY_ID: Record<string, TemplateSettingField> =
  Object.fromEntries(ALL_TEMPLATE_SETTINGS.map(f => [f.id, f]));

/** Set of all known top-level setting ids (for quick membership checks) */
export const TEMPLATE_SETTING_IDS: Set<string> = new Set(ALL_TEMPLATE_SETTINGS.map(f => f.id));

/** Setting ids the export engine is allowed to merge from generated → final settings */
export const EXPORTABLE_TEMPLATE_SETTING_IDS: Set<string> = new Set(
  ALL_TEMPLATE_SETTINGS.map(f => f.id),
);

// ============================================================================
// Validation
// ============================================================================

export interface TemplateSettingIssue {
  id: string;
  level: 'error' | 'warning';
  message: string;
}

/**
 * Validate a single template-level setting value against its schema.
 * Returns null when valid.
 */
export function validateTemplateSetting(id: string, value: unknown): TemplateSettingIssue | null {
  const field = TEMPLATE_SETTINGS_BY_ID[id];
  if (!field) {
    return { id, level: 'warning', message: `Unknown template setting "${id}" — not in settings_schema.json` };
  }

  // Empty / null
  if (value === null || value === undefined || value === '') {
    if (field.allowBlank || field.default === '') return null;
    // Empty allowed for most fields — Kajabi falls back to default
    return null;
  }

  const v = String(value);

  switch (field.type) {
    case 'checkbox':
      if (v !== 'true' && v !== 'false' && typeof value !== 'boolean') {
        return { id, level: 'warning', message: `Checkbox "${id}" should be "true" or "false", got "${v}"` };
      }
      return null;
    case 'color':
      if (!/^#[0-9a-fA-F]{3,8}$/.test(v) && !v.startsWith('rgb') && !v.startsWith('hsl')) {
        return { id, level: 'warning', message: `Color "${id}" doesn't look like a valid color: "${v}"` };
      }
      return null;
    case 'range': {
      const n = Number(v);
      if (Number.isNaN(n)) {
        return { id, level: 'error', message: `Range "${id}" must be numeric, got "${v}"` };
      }
      const min = field.min !== undefined ? Number(field.min) : -Infinity;
      const max = field.max !== undefined ? Number(field.max) : Infinity;
      if (n < min || n > max) {
        return { id, level: 'error', message: `Range "${id}" value ${n} out of bounds [${min}, ${max}]` };
      }
      return null;
    }
    case 'select':
    case 'pill_tabs':
      if (field.options && field.options.length > 0) {
        const allowed = field.options.map(o => o.value);
        if (!allowed.includes(v)) {
          return { id, level: 'warning', message: `"${id}" value "${v}" not in allowed options [${allowed.join(', ')}]` };
        }
      }
      return null;
    case 'font_select':
    case 'image_picker':
    case 'text':
    case 'textarea':
    default:
      return null;
  }
}

/**
 * Validate every top-level key in `settings_data.current` that isn't a structural
 * key (sections, content_for_*, link_lists). Returns issues + the count of
 * unknown keys.
 */
const STRUCTURAL_KEYS = new Set([
  'sections', 'link_lists', 'pages', 'pages_data',
]);

export interface TemplateSettingsAuditResult {
  totalChecked: number;
  knownFields: number;
  unknownFields: string[];
  issues: TemplateSettingIssue[];
}

export function auditTemplateSettings(
  current: Record<string, unknown>,
  knownSettingIds: Set<string> = TEMPLATE_SETTING_IDS,
): TemplateSettingsAuditResult {
  const issues: TemplateSettingIssue[] = [];
  const unknown: string[] = [];
  let known = 0;
  let total = 0;

  for (const [key, value] of Object.entries(current)) {
    if (STRUCTURAL_KEYS.has(key)) continue;
    if (key.startsWith('content_for_')) continue;
    total++;
    if (knownSettingIds.has(key)) {
      known++;
      const issue = TEMPLATE_SETTING_IDS.has(key)
        ? validateTemplateSetting(key, value)
        : null;
      if (issue) issues.push(issue);
    } else {
      unknown.push(key);
      issues.push({ id: key, level: 'warning', message: `Top-level key "${key}" is not in settings_schema.json` });
    }
  }

  return { totalChecked: total, knownFields: known, unknownFields: unknown, issues };
}

/**
 * Build a defaults object containing every template setting with its schema default.
 * Useful as a baseline when generating a fresh settings_data.json.
 */
export function buildDefaultTemplateSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ALL_TEMPLATE_SETTINGS) {
    if (f.default !== undefined) out[f.id] = f.default;
  }
  return out;
}
