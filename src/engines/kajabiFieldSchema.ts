/**
 * Kajabi Field Schema — Authoritative capability + enforcement registry
 * for the streamlined-home target theme.
 *
 * Responsibilities:
 * 1. Section-level vs block-level field classification
 * 2. Allowed block types per section type
 * 3. Field type validation (string, boolean, object, enum, number-like)
 * 4. Alias auto-repair (btn_url → btn_action, etc.)
 * 5. Required/minimum-viable block validation
 * 6. Enforcement levels: auto_repair | warning | blocking_error
 * 7. Pre-assembly (recipe compat) and post-assembly validation
 * 8. Export-gate validation
 */

// ============================================================
// 1. Enforcement levels
// ============================================================

export type EnforcementLevel = 'auto_repair' | 'warning' | 'blocking_error';

export interface SchemaIssue {
  level: EnforcementLevel;
  sectionName: string;
  blockId?: string;
  field?: string;
  message: string;
  repaired?: boolean;
}

// ============================================================
// 2. Field type definitions
// ============================================================

export type FieldType =
  | 'string'
  | 'boolean_string'   // "true" | "false" stored as string
  | 'number_string'    // "80", "4", etc.
  | 'hex_color'        // "#ffffff"
  | 'padding_object'   // { top, right, bottom, left }
  | 'html_string'      // Rich text / HTML
  | 'enum'
  | 'url_string'
  | 'string_token';    // Never coerce — alignment, logo_type, etc.

export interface FieldDef {
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  enumValues?: string[];
  /** If true, this field must never be boolean-coerced */
  preserveAsString?: boolean;
}

// ============================================================
// 3. Padding helper type
// ============================================================

export interface PaddingObject {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function isValidPaddingObject(v: unknown): v is PaddingObject {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return ['top', 'right', 'bottom', 'left'].every(
    k => typeof obj[k] === 'string' || obj[k] === undefined
  );
}

// ============================================================
// 4. Section-level field schema
// ============================================================

const SECTION_FIELD_DEFS: Record<string, FieldDef> = {
  max_width:                    { type: 'number_string', defaultValue: '1170' },
  hide_on_mobile:               { type: 'boolean_string', defaultValue: 'false' },
  hide_on_desktop:              { type: 'boolean_string', defaultValue: 'false' },
  background_type:              { type: 'enum', enumValues: ['color', 'image', 'video'], defaultValue: 'color' },
  background_color:             { type: 'hex_color', defaultValue: '' },
  background_image:             { type: 'url_string', defaultValue: '' },
  background_overlay:           { type: 'hex_color', defaultValue: '' },
  background_overlay_opacity:   { type: 'number_string', defaultValue: '0' },
  text_color:                   { type: 'hex_color', defaultValue: '' },
  padding_desktop:              { type: 'padding_object', defaultValue: { top: '80', right: '', bottom: '80', left: '' } },
  padding_mobile:               { type: 'padding_object', defaultValue: { top: '40', right: '', bottom: '40', left: '' } },
  // ---- section.liquid layout group fields ----
  vertical:                     { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  horizontal:                   { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  full_width:                   { type: 'boolean_string', defaultValue: 'false' },
  full_height:                  { type: 'boolean_string', defaultValue: 'false' },
  equal_height:                 { type: 'boolean_string', defaultValue: 'false' },
  bg_type:                      { type: 'string_token', defaultValue: 'none', preserveAsString: true },
  bg_image:                     { type: 'url_string', defaultValue: '' },
  bg_video:                     { type: 'url_string', defaultValue: '' },
  bg_position:                  { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  background_fixed:             { type: 'boolean_string', defaultValue: 'false' },
  // ---- header.liquid section-level fields ----
  // (only valid when section.type === 'header'; harmless on others — validator
  //  only flags block-only leaks, not section-only-on-wrong-flavor)
  cart:                          { type: 'boolean_string', defaultValue: 'false' },
  position:                      { type: 'string_token', defaultValue: 'static', preserveAsString: true },
  sticky:                        { type: 'boolean_string', defaultValue: 'false' },
  sticky_text_color:             { type: 'hex_color', defaultValue: '' },
  sticky_background_color:       { type: 'hex_color', defaultValue: '' },
  font_size_desktop:             { type: 'string_token', defaultValue: '18px', preserveAsString: true },
  font_size_mobile:              { type: 'string_token', defaultValue: '16px', preserveAsString: true },
  mobile_header_text_color:      { type: 'hex_color', defaultValue: '' },
  mobile_header_background_color:{ type: 'hex_color', defaultValue: '' },
  hamburger_color:               { type: 'hex_color', defaultValue: '' },
  sticky_hamburger_color:        { type: 'hex_color', defaultValue: '' },
  close_on_scroll:               { type: 'boolean_string', defaultValue: 'true' },
  mobile_menu_text_alignment:    { type: 'string_token', defaultValue: 'left', preserveAsString: true },
  // ---- footer.liquid section-level fields ----
  copyright_text_color:          { type: 'hex_color', defaultValue: '' },
  powered_by_text_color:         { type: 'hex_color', defaultValue: '' },
  vertical_layout:               { type: 'boolean_string', defaultValue: 'false' },
  // ---- Pro-only section.liquid slider fields (streamlined-home-pro / encore-page-pro) ----
  // Verified field IDs from streamlined-home-pro/sections/section.liquid schema.
  // Harmless on Standard themes (silently dropped by Kajabi); we keep them in
  // the section schema so the validator doesn't flag them as block-level leaks.
  enable_slider:                 { type: 'boolean_string', defaultValue: 'false' },
  blocks_per_slide:              { type: 'number_string', defaultValue: '3' },
  hide_overflow:                 { type: 'boolean_string', defaultValue: 'true' },
  slider_preset:                 { type: 'enum', enumValues: ['default', 'modern'], defaultValue: 'modern' },
  show_arrows:                   { type: 'boolean_string', defaultValue: 'true' },
  arrow_color:                   { type: 'hex_color', defaultValue: '' },
  arrow_slider_margin:           { type: 'number_string', defaultValue: '0' },
  show_dots:                     { type: 'boolean_string', defaultValue: 'true' },
  dot_color:                     { type: 'hex_color', defaultValue: '' },
  transition_effect:             { type: 'enum', enumValues: ['slide', 'coverflow', 'fade', 'cube', 'flip'], defaultValue: 'slide' },
  transition_speed:              { type: 'number_string', defaultValue: '500' },
  autoplay:                      { type: 'boolean_string', defaultValue: 'false' },
  autoplay_delay:                { type: 'number_string', defaultValue: '3000' },
  loop:                          { type: 'boolean_string', defaultValue: 'false' },
  block_offset:                  { type: 'number_string', defaultValue: '0' },
  block_end_offset:              { type: 'number_string', defaultValue: '0' },
  custom_css_class:              { type: 'string', defaultValue: '' },
};

/** Fields that are ONLY valid at section level — never in blocks */
export const SECTION_ONLY_FIELDS = new Set([
  'max_width',
  'background_type',
  'background_image',
  'background_overlay',
  'background_overlay_opacity',
  'full_width',
  'full_height',
  'equal_height',
  'bg_type',
  'bg_image',
  'bg_video',
  'bg_position',
  'background_fixed',
  // Pro-only slider section fields. NOTE: we deliberately do NOT include
  // `loop` / `autoplay` here — those are also legitimate fields on `video`
  // blocks. Adding them to SECTION_FIELD_DEFS above is enough to satisfy
  // the "block-level field leaked into section" validator.
  'enable_slider',
  'blocks_per_slide',
  'hide_overflow',
  'slider_preset',
  'show_arrows',
  'arrow_slider_margin',
  'show_dots',
  'transition_effect',
  'transition_speed',
  'autoplay_delay',
  'block_offset',
  'block_end_offset',
  'custom_css_class',
]);

// ============================================================
// 5. Block field schemas by block type
// ============================================================

const SHARED_BLOCK_FIELDS: Record<string, FieldDef> = {
  width:               { type: 'number_string', defaultValue: '12' },
  delay:               { type: 'number_string', defaultValue: '0' },
  duration:            { type: 'number_string', defaultValue: '0' },
  new_tab:             { type: 'boolean_string', defaultValue: 'false' },
  box_shadow:          { type: 'string_token', defaultValue: 'none', preserveAsString: true },
  make_block:          { type: 'boolean_string', defaultValue: 'false' },
  make_flush:          { type: 'boolean_string', defaultValue: 'false' },
  border_type:         { type: 'string_token', defaultValue: 'none', preserveAsString: true },
  border_color:        { type: 'hex_color', defaultValue: '' },
  border_width:        { type: 'number_string', defaultValue: '4' },
  border_radius:       { type: 'number_string', defaultValue: '4' },
  animation_type:      { type: 'string_token', defaultValue: 'none', preserveAsString: true },
  animation_direction: { type: 'string_token', defaultValue: 'none', preserveAsString: true },
  reveal_event:        { type: 'string', defaultValue: '' },
  reveal_units:        { type: 'string_token', defaultValue: 'seconds', preserveAsString: true },
  reveal_offset:       { type: 'string', defaultValue: '' },
  hide_on_mobile:      { type: 'boolean_string', defaultValue: 'false' },
  hide_on_desktop:     { type: 'boolean_string', defaultValue: 'false' },
  margin_mobile:       { type: 'padding_object' },
  margin_desktop:      { type: 'padding_object' },
  padding_mobile:      { type: 'padding_object' },
  padding_desktop:     { type: 'padding_object' },
  background_color:    { type: 'hex_color', defaultValue: '' },
};

// Source of truth: streamlined-home/snippets/block_text.liquid.
// `use_btn` toggles inclusion of block_cta — so all btn_* fields below are valid here.
const TEXT_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  text:                 { type: 'html_string', required: true },
  text_align:           { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  mobile_text_align:    { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  use_btn:              { type: 'boolean_string', defaultValue: 'false' },
  btn_text:             { type: 'string', defaultValue: 'Call To Action' },
  btn_action:           { type: 'url_string', defaultValue: '' },
  btn_text_color:       { type: 'hex_color', defaultValue: '' },
  btn_background_color: { type: 'hex_color', defaultValue: '' },
  btn_border_radius:    { type: 'number_string', defaultValue: '' },
  btn_style:            { type: 'string_token', defaultValue: 'solid', preserveAsString: true },
  btn_size:             { type: 'string_token', defaultValue: 'medium', preserveAsString: true },
  btn_width:            { type: 'string_token', defaultValue: 'auto', preserveAsString: true },
  drop_cap:             { type: 'boolean_string', defaultValue: 'false' },
  cap_color:            { type: 'hex_color', defaultValue: '' },
};

// Source of truth: streamlined-home/snippets/block_image.liquid.
const IMAGE_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  image:                    { type: 'url_string', defaultValue: '' },
  image_alt:                { type: 'string', defaultValue: '' },
  image_first:              { type: 'boolean_string', defaultValue: 'false' },
  image_width:              { type: 'string', defaultValue: '' },
  image_border_radius:      { type: 'number_string', defaultValue: '' },
  img_action:               { type: 'url_string', defaultValue: '' },
  overlay_text:             { type: 'string', defaultValue: '' },
  enable_overlay:           { type: 'boolean_string', defaultValue: 'false' },
  overlay_background_color: { type: 'hex_color', defaultValue: '' },
  overlay_text_color:       { type: 'hex_color', defaultValue: '' },
  image_align_desktop:      { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  image_align_mobile:       { type: 'string_token', defaultValue: 'flex-start', preserveAsString: true },
  image_caption:            { type: 'string', defaultValue: '' },
  gallery:                  { type: 'boolean_string', defaultValue: 'false' },
  always_show_on_mobile:    { type: 'boolean_string', defaultValue: 'false' },
};

// Source of truth: streamlined-home/snippets/block_feature.liquid.
// Real fields are `text` (single rich-text), image_*, hide_image, img_action,
// new_tab_image, and use_btn (which delegates to block_cta for btn_* fields).
const FEATURE_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  text:                 { type: 'html_string', required: true },
  text_align:           { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  mobile_text_align:    { type: 'string_token', defaultValue: 'center', preserveAsString: true },
  image:                { type: 'url_string', defaultValue: '' },
  image_alt:             { type: 'string', defaultValue: '' },
  image_width:           { type: 'string', defaultValue: '' },
  image_border_radius:   { type: 'number_string', defaultValue: '' },
  hide_image:            { type: 'boolean_string', defaultValue: 'true' },
  img_action:            { type: 'url_string', defaultValue: '' },
  new_tab_image:         { type: 'boolean_string', defaultValue: 'false' },
  use_btn:               { type: 'boolean_string', defaultValue: 'false' },
  btn_text:              { type: 'string', defaultValue: '' },
  btn_action:            { type: 'url_string', defaultValue: '' },
  btn_text_color:        { type: 'hex_color', defaultValue: '' },
  btn_background_color:  { type: 'hex_color', defaultValue: '' },
  btn_border_radius:     { type: 'number_string', defaultValue: '' },
  btn_style:             { type: 'string_token', defaultValue: 'solid', preserveAsString: true },
  btn_size:              { type: 'string_token', defaultValue: 'medium', preserveAsString: true },
  btn_width:             { type: 'string_token', defaultValue: 'auto', preserveAsString: true },
};

const LOGO_BLOCK_FIELDS: Record<string, FieldDef> = {
  logo:           { type: 'url_string', defaultValue: '' },
  logo_text:      { type: 'string', defaultValue: '' },
  logo_type:      { type: 'string_token', defaultValue: 'image', preserveAsString: true },
  logo_width:     { type: 'number_string', defaultValue: '50' },
  logo_text_color:{ type: 'hex_color', defaultValue: '' },
  image_alt:      { type: 'string', defaultValue: '' },
  stretch:        { type: 'boolean_string', defaultValue: 'false' },
  alignment:      { type: 'string_token', defaultValue: 'left', preserveAsString: true },
};

const MENU_BLOCK_FIELDS: Record<string, FieldDef> = {
  menu:       { type: 'string', required: true, defaultValue: 'main-menu' },
  stretch:    { type: 'boolean_string', defaultValue: 'true' },
  alignment:  { type: 'string_token', defaultValue: 'right', preserveAsString: true },
};

const COPYRIGHT_BLOCK_FIELDS: Record<string, FieldDef> = {
  copyright: { type: 'string', required: true },
};

const CODE_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  code: { type: 'html_string', required: true },
};

// === Source-of-truth schemas extracted from streamlined-home/sections/section.liquid ===

const ACCORDION_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  heading:        { type: 'string', required: true },
  body:           { type: 'html_string', required: true },
  accordion_icon: { type: 'string_token', defaultValue: 'plus', preserveAsString: true },
  icon_color:     { type: 'hex_color', defaultValue: '' },
  text_align:     { type: 'string_token', defaultValue: 'left', preserveAsString: true },
  mobile_text_align: { type: 'string_token', defaultValue: 'left', preserveAsString: true },
};

const CARD_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  image:                { type: 'url_string', defaultValue: '' },
  description:          { type: 'html_string', defaultValue: '' },
  action:               { type: 'url_string', defaultValue: '' },
  show_cta:             { type: 'boolean_string', defaultValue: 'true' },
  btn_text:             { type: 'string', defaultValue: 'Call To Action' },
  btn_width:            { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_style:            { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_size:             { type: 'string_token', defaultValue: 'small', preserveAsString: true },
  btn_border_radius:    { type: 'number_string', defaultValue: '' },
  btn_text_color:       { type: 'hex_color', defaultValue: '' },
  btn_background_color: { type: 'hex_color', defaultValue: '' },
  footer:               { type: 'string', defaultValue: '' },
  footer_text_color:    { type: 'hex_color', defaultValue: '' },
  text_align:           { type: 'string_token', defaultValue: 'left', preserveAsString: true },
};

const CTA_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  btn_text:             { type: 'string', defaultValue: 'Call to action' },
  btn_action:           { type: 'url_string', defaultValue: '' },
  btn_width:            { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_style:            { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_size:             { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_border_radius:    { type: 'number_string', defaultValue: '' },
  btn_text_color:       { type: 'hex_color', defaultValue: '' },
  btn_background_color: { type: 'hex_color', defaultValue: '' },
  alignment:            { type: 'string_token', defaultValue: 'left', preserveAsString: true },
  text_align:           { type: 'string_token', defaultValue: 'center', preserveAsString: true },
};

const FORM_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  form:                 { type: 'string', defaultValue: '' },
  text:                 { type: 'html_string', defaultValue: '' },
  disclaimer_text:      { type: 'string', defaultValue: '' },
  input_label:          { type: 'string_token', defaultValue: 'placeholder', preserveAsString: true },
  inline:               { type: 'boolean_string', defaultValue: 'false' },
  btn_text:             { type: 'string', defaultValue: 'Submit' },
  btn_width:            { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_style:            { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_size:             { type: 'string_token', defaultValue: '', preserveAsString: true },
  btn_border_radius:    { type: 'number_string', defaultValue: '' },
  btn_text_color:       { type: 'hex_color', defaultValue: '' },
  btn_background_color: { type: 'hex_color', defaultValue: '' },
  text_align:           { type: 'string_token', defaultValue: 'center', preserveAsString: true },
};

const VIDEO_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  video:             { type: 'string', defaultValue: '' },
  image:             { type: 'url_string', defaultValue: '' }, // poster image
  controls_on_load:  { type: 'boolean_string', defaultValue: 'false' },
  auto_play:         { type: 'boolean_string', defaultValue: 'false' },
  loop:              { type: 'boolean_string', defaultValue: 'false' },
  play_button:       { type: 'boolean_string', defaultValue: 'true' },
  small_play_button: { type: 'boolean_string', defaultValue: 'true' },
  full_screen:       { type: 'boolean_string', defaultValue: 'false' },
  playbar:           { type: 'boolean_string', defaultValue: 'false' },
  video_settings:    { type: 'boolean_string', defaultValue: 'false' },
};

// Source of truth: streamlined-home/snippets/block_video_embed.liquid.
// Single field `code` containing raw embed HTML.
const VIDEO_EMBED_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  code:       { type: 'html_string', defaultValue: '' },
  text_align: { type: 'string_token', defaultValue: 'center', preserveAsString: true },
};

const PRICING_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  heading:              { type: 'string', defaultValue: '' },
  name:                 { type: 'string', defaultValue: '' },
  price:                { type: 'string', defaultValue: '' },
  text:                 { type: 'html_string', defaultValue: '' },
  image:                { type: 'url_string', defaultValue: '' },
  image_alt:            { type: 'string', defaultValue: '' },
  show_image:           { type: 'boolean_string', defaultValue: 'false' },
  price_color:          { type: 'hex_color', defaultValue: '' },
  price_name_color:     { type: 'hex_color', defaultValue: '' },
  show_cta:             { type: 'boolean_string', defaultValue: 'false' },
  btn_text:             { type: 'string', defaultValue: '' },
  btn_action:           { type: 'url_string', defaultValue: '' },
  // Pricing's primary CTA renders via the shared `block_cta` include, which
  // honors btn_background_color + btn_text_color (and the other btn_* style
  // fields) the same way text/feature/card do. List them here so chat-driven
  // setBlockField ops on a pricing block don't get dropped by the validator.
  btn_background_color: { type: 'hex_color', defaultValue: '' },
  btn_text_color:       { type: 'hex_color', defaultValue: '' },
  show_secondary_cta:   { type: 'boolean_string', defaultValue: 'false' },
  secondary_btn_text:   { type: 'string', defaultValue: '' },
  secondary_btn_action: { type: 'url_string', defaultValue: '' },
  text_align:           { type: 'string_token', defaultValue: 'center', preserveAsString: true },
};

const LINK_LIST_BLOCK_FIELDS: Record<string, FieldDef> = {
  ...SHARED_BLOCK_FIELDS,
  menu:        { type: 'string', defaultValue: 'main-menu' },
  show_title:  { type: 'boolean_string', defaultValue: 'false' },
  title:       { type: 'string', defaultValue: '' },
  title_color: { type: 'hex_color', defaultValue: '' },
  link_color:  { type: 'hex_color', defaultValue: '' },
  vertical:    { type: 'string_token', defaultValue: 'row', preserveAsString: true },
  text_align:  { type: 'string_token', defaultValue: 'center', preserveAsString: true },
};

const SOCIAL_ICON_PLATFORMS = [
  'facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'tiktok',
  'pinterest', 'vimeo', 'github', 'medium', 'spotify', 'soundcloud',
  'dribbble', 'flickr', 'itunes', 'podcasts', 'slack', 'tumblr', 'yelp',
] as const;

const SOCIAL_ICONS_BLOCK_FIELDS: Record<string, FieldDef> = {
  new_tab:                       { type: 'boolean_string', defaultValue: 'false' },
  social_icons_text_color:       { type: 'hex_color', defaultValue: '' },
  social_icons_background_color: { type: 'hex_color', defaultValue: '' },
  social_icon_background_style:  { type: 'string_token', defaultValue: '', preserveAsString: true },
  social_icon_size:              { type: 'string_token', defaultValue: '', preserveAsString: true },
  horizontal:                    { type: 'string_token', defaultValue: 'space-around', preserveAsString: true },
  mobile_horizontal:             { type: 'string_token', defaultValue: 'left', preserveAsString: true },
  stretch:                       { type: 'boolean_string', defaultValue: 'false' },
  // Per-platform URL fields — `social_icon_link_<platform>` (one per supported network)
  ...Object.fromEntries(
    SOCIAL_ICON_PLATFORMS.map(p => [
      `social_icon_link_${p}`,
      { type: 'url_string' as const, defaultValue: '' } satisfies FieldDef,
    ]),
  ),
};

// hello_bar block intentionally removed — not supported in v1.

export const BLOCK_FIELD_SCHEMAS: Record<string, Record<string, FieldDef>> = {
  text:        TEXT_BLOCK_FIELDS,
  image:       IMAGE_BLOCK_FIELDS,
  feature:     FEATURE_BLOCK_FIELDS,
  logo:        LOGO_BLOCK_FIELDS,
  menu:        MENU_BLOCK_FIELDS,
  copyright:   COPYRIGHT_BLOCK_FIELDS,
  code:        CODE_BLOCK_FIELDS,
  accordion:   ACCORDION_BLOCK_FIELDS,
  card:        CARD_BLOCK_FIELDS,
  cta:         CTA_BLOCK_FIELDS,
  form:        FORM_BLOCK_FIELDS,
  video:       VIDEO_BLOCK_FIELDS,
  video_embed: VIDEO_EMBED_BLOCK_FIELDS,
  pricing:     PRICING_BLOCK_FIELDS,
  link_list:   LINK_LIST_BLOCK_FIELDS,
  social_icons:SOCIAL_ICONS_BLOCK_FIELDS,
  
};

// ============================================================
// 6. Allowed block types per section type
// ============================================================

// Source of truth: {% schema %} blocks in
// public/base-theme/streamlined-home.zip → sections/{header,footer,section}.liquid
// Header schema also allows 'dropdown', 'user', 'hello_bar' — not in our React lib yet.
export const ALLOWED_BLOCKS_PER_SECTION: Record<string, Set<string>> = {
  section:  new Set(['text', 'image', 'feature', 'cta', 'accordion', 'card', 'social_icons', 'code', 'video_embed', 'pricing', 'video', 'form', 'link_list']),
  header:   new Set(['logo', 'menu', 'cta', 'social_icons']),
  footer:   new Set(['logo', 'link_list', 'copyright', 'social_icons']),
};

// ============================================================
// 7. Alias repair map
// ============================================================

const FIELD_ALIASES: Record<string, string> = {
  btn_url:     'btn_action',
  button_url:  'btn_action',
  button_text: 'btn_text',
  image_link:  'img_action',
  image_url:   'image',
  cta_text:    'btn_text',
  cta_url:     'btn_action',
  cta_action:  'btn_action',
};

// ============================================================
// 8. String-token fields that must NEVER be boolean-coerced
// ============================================================

const STRING_TOKEN_FIELDS = new Set([
  'vertical', 'horizontal', 'alignment', 'logo_type',
  'position', 'text_align', 'mobile_text_align',
  'box_shadow', 'border_type', 'animation_type', 'animation_direction',
  'reveal_units', 'image_align_mobile', 'btn_style', 'btn_size', 'btn_width',
]);

// ============================================================
// 9. Alias repair function (mutates in place)
// ============================================================

function repairAliases(
  settings: Record<string, unknown>,
  context: string
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const [alias, canonical] of Object.entries(FIELD_ALIASES)) {
    if (alias in settings) {
      const val = settings[alias];
      delete settings[alias];
      // Only set canonical if not already present
      if (!(canonical in settings)) {
        settings[canonical] = val;
      }
      issues.push({
        level: 'auto_repair',
        sectionName: context,
        field: alias,
        message: `Repaired alias "${alias}" → "${canonical}"`,
        repaired: true,
      });
    }
  }

  return issues;
}

// ============================================================
// 10. Field type validator
// ============================================================

function validateFieldType(
  key: string,
  value: unknown,
  def: FieldDef,
  context: string,
  blockId?: string
): SchemaIssue | null {
  // String tokens — must be string
  if (STRING_TOKEN_FIELDS.has(key) || def.preserveAsString) {
    if (typeof value === 'boolean') {
      return {
        level: 'auto_repair',
        sectionName: context,
        blockId,
        field: key,
        message: `"${key}" is a string token but got boolean ${value}. Should be string.`,
      };
    }
    return null;
  }

  switch (def.type) {
    case 'boolean_string':
      if (typeof value !== 'string' || (value !== 'true' && value !== 'false')) {
        // Booleans are auto-repairable
        if (typeof value === 'boolean') {
          return {
            level: 'auto_repair',
            sectionName: context,
            blockId,
            field: key,
            message: `"${key}" should be string "true"/"false", got boolean ${value}`,
          };
        }
        if (value !== '' && value != null) {
          return {
            level: 'warning',
            sectionName: context,
            blockId,
            field: key,
            message: `"${key}" expected boolean string, got ${typeof value}: ${JSON.stringify(value)}`,
          };
        }
      }
      break;

    case 'number_string':
      if (typeof value === 'string' && value !== '') {
        if (isNaN(Number(value))) {
          return {
            level: 'warning',
            sectionName: context,
            blockId,
            field: key,
            message: `"${key}" expected number-like string, got "${value}"`,
          };
        }
      }
      break;

    case 'padding_object':
      if (value != null && typeof value !== 'object') {
        return {
          level: 'blocking_error',
          sectionName: context,
          blockId,
          field: key,
          message: `"${key}" must be a padding object {top,right,bottom,left}, got ${typeof value}`,
        };
      }
      if (value != null && !isValidPaddingObject(value)) {
        return {
          level: 'warning',
          sectionName: context,
          blockId,
          field: key,
          message: `"${key}" has invalid padding object shape`,
        };
      }
      break;

    case 'hex_color':
      if (typeof value === 'string' && value !== '' && !value.match(/^#[0-9a-fA-F]{3,8}$/)) {
        return {
          level: 'warning',
          sectionName: context,
          blockId,
          field: key,
          message: `"${key}" expected hex color, got "${value}"`,
        };
      }
      break;

    case 'enum':
      if (def.enumValues && typeof value === 'string' && value !== '' && !def.enumValues.includes(value)) {
        return {
          level: 'warning',
          sectionName: context,
          blockId,
          field: key,
          message: `"${key}" got "${value}", expected one of: ${def.enumValues.join(', ')}`,
        };
      }
      break;
  }

  return null;
}

// ============================================================
// 11. Minimum viable block validation
// ============================================================

function validateBlockContent(
  blockType: string,
  settings: Record<string, unknown>,
  context: string,
  blockId: string
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  switch (blockType) {
    case 'text': {
      const text = settings.text;
      if (!text || (typeof text === 'string' && text.replace(/<[^>]*>/g, '').trim().length === 0)) {
        issues.push({
          level: 'warning',
          sectionName: context,
          blockId,
          message: 'Text block has empty or whitespace-only content',
        });
      }
      // CTA validation: if use_btn is true, btn_text should exist
      if (settings.use_btn === 'true') {
        if (!settings.btn_text || (typeof settings.btn_text === 'string' && !settings.btn_text.trim())) {
          issues.push({
            level: 'warning',
            sectionName: context,
            blockId,
            message: 'Button enabled (use_btn=true) but btn_text is empty',
          });
        }
      }
      break;
    }

    case 'feature': {
      const text = settings.text;
      const hideImage = settings.hide_image;
      if (!text || (typeof text === 'string' && text.replace(/<[^>]*>/g, '').trim().length === 0)) {
        issues.push({
          level: 'warning',
          sectionName: context,
          blockId,
          message: 'Feature block has empty or whitespace-only text content',
        });
      }
      // If image is shown but no image URL
      if (hideImage !== 'true' && !settings.image) {
        issues.push({
          level: 'warning',
          sectionName: context,
          blockId,
          message: 'Feature block shows image (hide_image≠true) but no image URL set',
        });
      }
      break;
    }

    case 'copyright': {
      if (!settings.copyright || (typeof settings.copyright === 'string' && !settings.copyright.trim())) {
        issues.push({
          level: 'warning',
          sectionName: context,
          blockId,
          message: 'Copyright block has no text',
        });
      }
      break;
    }

    case 'menu': {
      if (!settings.menu) {
        issues.push({
          level: 'blocking_error',
          sectionName: context,
          blockId,
          message: 'Menu block has no menu reference',
        });
      }
      break;
    }
  }

  return issues;
}

// ============================================================
// 12. Boolean auto-repair (mutates in place)
// ============================================================

function repairBooleanStrings(
  settings: Record<string, unknown>,
  fieldDefs: Record<string, FieldDef>,
  context: string,
  blockId?: string
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const [key, value] of Object.entries(settings)) {
    const def = fieldDefs[key];
    if (!def) continue;

    // String token — coerce boolean back to string
    if (STRING_TOKEN_FIELDS.has(key) || def.preserveAsString) {
      if (typeof value === 'boolean') {
        settings[key] = String(value);
        issues.push({
          level: 'auto_repair',
          sectionName: context,
          blockId,
          field: key,
          message: `Coerced boolean to string for string-token "${key}"`,
          repaired: true,
        });
      }
      continue;
    }

    // Boolean string — repair actual booleans
    if (def.type === 'boolean_string' && typeof value === 'boolean') {
      settings[key] = value ? 'true' : 'false';
      issues.push({
        level: 'auto_repair',
        sectionName: context,
        blockId,
        field: key,
        message: `Coerced boolean → string for "${key}"`,
        repaired: true,
      });
    }
  }

  return issues;
}

// ============================================================
// 13. Pre-assembly validation (recipe compatibility)
// ============================================================

export interface RecipeCompatResult {
  compatible: boolean;
  issues: SchemaIssue[];
}

/**
 * Check if a recipe ID is known and its archetype has a valid
 * block/section mapping before assembly begins.
 */
export function validateRecipeCompat(
  recipeId: string,
  archetype: string,
  knownRecipes: Set<string>
): RecipeCompatResult {
  const issues: SchemaIssue[] = [];

  if (!knownRecipes.has(recipeId)) {
    issues.push({
      level: 'blocking_error',
      sectionName: archetype,
      message: `Unknown recipe ID "${recipeId}" — no recipe function registered`,
    });
  }

  // Verify the archetype maps to a section type we support
  const validArchetypes = new Set([
    'header', 'hero', 'stats_row', 'icon_card_row', 'feature_cards',
    'content_media_split', 'testimonials', 'cta_band', 'footer',
  ]);
  if (!validArchetypes.has(archetype)) {
    issues.push({
      level: 'warning',
      sectionName: archetype,
      message: `Archetype "${archetype}" is not in the supported set for streamlined-home`,
    });
  }

  return { compatible: issues.every(i => i.level !== 'blocking_error'), issues };
}

// ============================================================
// 14. Post-assembly validation (full output)
// ============================================================

export interface ValidationReport {
  valid: boolean;
  issues: SchemaIssue[];
  autoRepairCount: number;
  warningCount: number;
  errorCount: number;
}

/**
 * Full validation + auto-repair of assembled settings_data sections.
 * Mutates sections in place for auto-repairs.
 */
export function validateAndRepairSections(
  sections: Record<string, {
    type?: string;
    name?: string;
    settings?: Record<string, unknown>;
    blocks?: Record<string, { type: string; settings: Record<string, unknown> }>;
    block_order?: string[];
  }>
): ValidationReport {
  const issues: SchemaIssue[] = [];

  // Section types our schema models. Anything else (products, blog_listings,
  // blog_post_body, …) is a Kajabi-native section injected via <RawSection> —
  // its settings/blocks follow Kajabi's own schema, not ours, so we pass them
  // through verbatim instead of validating against our composed-block rules.
  const COMPOSED_SECTION_TYPES = new Set(['section', 'header', 'footer']);

  for (const [sectionId, section] of Object.entries(sections)) {
    const sectionName = section.name || sectionId;
    const sType = section.type || 'section';
    const settings = section.settings || {};
    const isComposed = COMPOSED_SECTION_TYPES.has(sType);

    // Raw Kajabi sections (products, blog_listings, blog_post_body, etc.) —
    // skip all of our schema checks. They use Kajabi's own per-type schema.
    if (!isComposed) continue;

    // --- Alias repair on section settings ---
    issues.push(...repairAliases(settings, sectionName));

    // --- Boolean repair on section settings ---
    issues.push(...repairBooleanStrings(settings, SECTION_FIELD_DEFS, sectionName));

    // --- Section-level field type validation ---
    for (const [key, value] of Object.entries(settings)) {
      const def = SECTION_FIELD_DEFS[key];
      if (def) {
        const issue = validateFieldType(key, value, def, sectionName);
        if (issue) issues.push(issue);
      }
    }

    // Skip header/footer block-in-section checks (they have unique schemas)
    if (sType !== 'header' && sType !== 'footer') {
      // --- Check for block-only fields leaked into section settings ---
      for (const key of Object.keys(settings)) {
        if (SECTION_ONLY_FIELDS.has(key)) continue; // valid at section level
        // Check if this field is block-only
        const isInAnyBlockSchema = Object.values(BLOCK_FIELD_SCHEMAS).some(schema => key in schema);
        const isInSectionSchema = key in SECTION_FIELD_DEFS;
        if (isInAnyBlockSchema && !isInSectionSchema) {
          issues.push({
            level: 'blocking_error',
            sectionName,
            field: key,
            message: `"${key}" is a block-level field but found in section settings`,
          });
        }
      }
    }

    // --- Block validation ---
    const blocks = section.blocks || {};
    const blockOrder = section.block_order || [];
    const allowedBlocks = ALLOWED_BLOCKS_PER_SECTION[sType];

    for (const [blockId, block] of Object.entries(blocks)) {
      const bType = block.type;
      const bSettings = block.settings || {};

      // Check block type is allowed in this section type
      if (allowedBlocks && !allowedBlocks.has(bType)) {
        issues.push({
          level: 'blocking_error',
          sectionName,
          blockId,
          message: `Block type "${bType}" is not allowed in section type "${sType}". Allowed: ${[...allowedBlocks].join(', ')}`,
        });
      }

      // Alias repair on block settings
      issues.push(...repairAliases(bSettings, sectionName));

      // Check for section-only fields in block
      for (const key of Object.keys(bSettings)) {
        if (SECTION_ONLY_FIELDS.has(key)) {
          issues.push({
            level: 'blocking_error',
            sectionName,
            blockId,
            field: key,
            message: `"${key}" is section-level only but found in block "${blockId}". ${key === 'background_image' ? 'Use "image" for block images.' : ''}`,
          });
        }
      }

      // Field type validation on block
      const blockSchema = BLOCK_FIELD_SCHEMAS[bType];
      if (blockSchema) {
        // Boolean repair
        issues.push(...repairBooleanStrings(bSettings, blockSchema, sectionName, blockId));

        for (const [key, value] of Object.entries(bSettings)) {
          const def = blockSchema[key];
          if (def) {
            const issue = validateFieldType(key, value, def, sectionName, blockId);
            if (issue) issues.push(issue);
          }
        }
      }

      // Minimum viable block content
      issues.push(...validateBlockContent(bType, bSettings, sectionName, blockId));
    }

    // --- block_order integrity ---
    for (const bId of blockOrder) {
      if (!blocks[bId]) {
        issues.push({
          level: 'blocking_error',
          sectionName,
          message: `block_order references missing block "${bId}"`,
        });
      }
    }
    for (const bId of Object.keys(blocks)) {
      if (!blockOrder.includes(bId)) {
        issues.push({
          level: 'warning',
          sectionName,
          blockId: bId,
          message: `Block "${bId}" exists but is not in block_order`,
        });
      }
    }
  }

  const autoRepairCount = issues.filter(i => i.level === 'auto_repair').length;
  const warningCount = issues.filter(i => i.level === 'warning').length;
  const errorCount = issues.filter(i => i.level === 'blocking_error').length;

  return {
    valid: errorCount === 0,
    issues,
    autoRepairCount,
    warningCount,
    errorCount,
  };
}

// ============================================================
// 15. Export gate — returns blocking errors only
// ============================================================

export function getExportBlockingErrors(report: ValidationReport): string[] {
  return report.issues
    .filter(i => i.level === 'blocking_error')
    .map(i => {
      const loc = [i.sectionName, i.blockId, i.field].filter(Boolean).join(' → ');
      return `[${loc}] ${i.message}`;
    });
}

// ============================================================
// Backward compat — old validateAssembledSections API
// ============================================================

/** @deprecated Use validateAndRepairSections instead */
export function validateAssembledSections(
  sections: Record<string, { type?: string; name?: string; settings?: Record<string, unknown>; blocks?: Record<string, { type: string; settings: Record<string, unknown> }>; block_order?: string[] }>
): { level: string; sectionName: string; message: string }[] {
  const report = validateAndRepairSections(sections);
  return report.issues.map(i => ({
    level: i.level,
    sectionName: i.sectionName,
    message: i.message,
  }));
}

// ============================================================
// 16. Schema-driven builders — single source of truth for recipes
// ============================================================

const EMPTY_PAD: PaddingObject = { top: '', right: '', bottom: '', left: '' };

/**
 * Build a complete default settings object for a given block type,
 * pulling every default from the schema. Overrides are applied on top.
 */
export function buildBlockDefaults(
  blockType: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const schema = BLOCK_FIELD_SCHEMAS[blockType];
  if (!schema) return { ...overrides };

  const defaults: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    if (def.defaultValue !== undefined) {
      // Deep-clone padding objects
      defaults[key] = def.type === 'padding_object' && typeof def.defaultValue === 'object'
        ? { ...def.defaultValue as PaddingObject }
        : def.defaultValue;
    } else if (def.type === 'padding_object') {
      defaults[key] = { ...EMPTY_PAD };
    }
  }

  // Apply overrides, running alias repair
  const merged = { ...defaults, ...overrides };
  repairAliases(merged, `buildBlockDefaults(${blockType})`);
  return merged;
}

/**
 * Build a complete section-level settings object from the schema.
 */
export function buildSectionDefaults(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SECTION_FIELD_DEFS)) {
    if (def.defaultValue !== undefined) {
      defaults[key] = def.type === 'padding_object' && typeof def.defaultValue === 'object'
        ? { ...def.defaultValue as PaddingObject }
        : def.defaultValue;
    } else if (def.type === 'padding_object') {
      defaults[key] = { ...EMPTY_PAD };
    }
  }

  const merged = { ...defaults, ...overrides };
  repairAliases(merged, 'buildSectionDefaults');
  return merged;
}

/**
 * Build a text block settings object from schema defaults.
 */
export function buildTextBlock(
  html: string,
  width = '12',
  align = 'center',
  opts: Record<string, unknown> = {}
): Record<string, unknown> {
  return buildBlockDefaults('text', {
    text: html,
    width,
    text_align: align,
    mobile_text_align: align,
    ...opts,
  });
}

/**
 * Build an image block settings object from schema defaults.
 */
export function buildImageBlock(
  width = '6',
  opts: Record<string, unknown> = {}
): Record<string, unknown> {
  return buildBlockDefaults('image', { width, ...opts });
}

/**
 * Fold legacy {heading, body, extraHtml} content into the canonical single
 * `text` HTML field used by the real Kajabi `block_feature.liquid` schema.
 *
 * Single source of truth — reused by builder and audit logic. Kept in this
 * module because both `exportParityAudit.ts` and `exportTransforms.ts`
 * already import from here (one-way), so no circular dependency arises.
 * If a future cycle appears, extract to `src/engines/featureNormalize.ts`
 * and have all sides import from there.
 */
export function normalizeLegacyFeatureContent(opts: {
  text?: string;
  heading?: string;
  body?: string;
  extraHtml?: string;
}): string {
  // Preserve intentional empty string ("" means "explicitly cleared").
  if (opts.text != null) return opts.text;
  return `${opts.extraHtml ?? ''}${opts.heading ? `<h3>${opts.heading}</h3>` : ''}${opts.body ? `<p>${opts.body}</p>` : ''}`;
}

/**
 * Build a feature block settings object from schema defaults.
 *
 * Canonical signature: `(text, width?, opts?)` — `text` is the rich HTML
 * content (heading inline as `<h3>`, body inline as `<p>`).
 *
 * Back-compat: legacy callers may pass `{ heading, body, extraHtml }` via
 * `opts` (or pass `text=''` and rely on opts). They are folded into `text`
 * via `normalizeLegacyFeatureContent` and stripped from output so they
 * never reach `settings_data.json`.
 */
export function buildFeatureBlock(
  text: string,
  width = '4',
  opts: Record<string, unknown> = {}
): Record<string, unknown> {
  const { heading, body, extraHtml, ...rest } = opts as {
    heading?: string;
    body?: string;
    extraHtml?: string;
    [k: string]: unknown;
  };
  // An explicitly passed `text` (including '') is always authoritative.
  // Legacy {heading, body, extraHtml} opts are only folded when `text`
  // was not provided at all (i.e. `null`/`undefined`).
  const finalText = normalizeLegacyFeatureContent({
    text: text == null ? undefined : text,
    heading,
    body,
    extraHtml,
  });
  return buildBlockDefaults('feature', { text: finalText, width, ...rest });
}

/**
 * Build a code block settings object from schema defaults.
 */
export function buildCodeBlock(
  code: string,
  width = '12',
  opts: Record<string, unknown> = {}
): Record<string, unknown> {
  return buildBlockDefaults('code', { code, width, ...opts });
}

/**
 * Build a complete section structure with schema-derived settings.
 */
export function buildSection(
  name: string,
  blocks: Record<string, { type: string; settings: Record<string, unknown> }>,
  blockOrder: string[],
  settingsOverrides: Record<string, unknown> = {}
): {
  name: string;
  type: string;
  hidden: string;
  blocks: Record<string, { type: string; settings: Record<string, unknown> }>;
  block_order: string[];
  settings: Record<string, unknown>;
} {
  return {
    name,
    type: 'section',
    hidden: 'false',
    blocks,
    block_order: blockOrder,
    settings: buildSectionDefaults(settingsOverrides),
  };
}

// ============================================================
// Template Capabilities — compact catalog for AI prompts
// ============================================================

export interface TemplateBlockCapability {
  type: string;
  /** Top 4-6 most relevant fields, summarized for prompt brevity */
  keyFields: string[];
  /** Short human description of when to use this block */
  purpose: string;
}

export interface TemplateSectionCapability {
  type: string;
  purpose: string;
  allowedBlocks: TemplateBlockCapability[];
}

export interface TemplateCapabilities {
  themeName: string;
  sectionTypes: TemplateSectionCapability[];
  notes: string[];
}

const BLOCK_PURPOSES: Record<string, string> = {
  text: 'Headings, paragraphs, eyebrows, and CTAs (use_btn=true with btn_text/btn_action)',
  image: 'Standalone image, hero photo, illustration, screenshot',
  feature: 'A card with rich HTML text content and optional image.',
  cta: 'Call-to-action block with button',
  accordion: 'Collapsible FAQ-style content',
  card: 'Generic card container',
  social_icons: 'Row of social media links',
  code: 'Custom HTML/Liquid markup',
  logo: 'Logo image or text (header/footer)',
  menu: 'Navigation menu reference (header/footer)',
  copyright: 'Copyright text (footer)',
  link_list: 'List of links (header/footer)',
};

const SECTION_PURPOSES: Record<string, string> = {
  header: 'Top of page: logo + nav menu + optional social/links',
  section: 'Body content. Compose blocks to make hero, feature_cards, testimonials, cta_band, content_media_split, stats_row, etc.',
  footer: 'Bottom of page: logo + nav + copyright + social',
};

function summarizeFieldsForBlock(blockType: string): string[] {
  const schema = BLOCK_FIELD_SCHEMAS[blockType];
  if (!schema) return [];
  // Pick required + a few high-signal optional fields
  const required = Object.entries(schema)
    .filter(([, def]) => def.required)
    .map(([k]) => k);
  const highSignal = ['heading', 'body', 'text', 'image', 'btn_text', 'btn_action', 'use_btn', 'logo', 'menu', 'copyright', 'code']
    .filter((k) => k in schema && !required.includes(k));
  return [...required, ...highSignal].slice(0, 6);
}

/**
 * Returns a compact catalog of section + block capabilities the AI can use
 * to map detected visual regions onto real Kajabi structures.
 *
 * Used by the `template_mapping` analysis pass.
 */
export function getTemplateCapabilities(themeName = 'streamlined-home'): TemplateCapabilities {
  const sectionTypes: TemplateSectionCapability[] = Object.entries(ALLOWED_BLOCKS_PER_SECTION).map(
    ([sectionType, allowedBlocks]) => ({
      type: sectionType,
      purpose: SECTION_PURPOSES[sectionType] || `Kajabi ${sectionType}`,
      allowedBlocks: Array.from(allowedBlocks).map((blockType) => ({
        type: blockType,
        purpose: BLOCK_PURPOSES[blockType] || `${blockType} block`,
        keyFields: summarizeFieldsForBlock(blockType),
      })),
    }),
  );

  return {
    themeName,
    sectionTypes,
    notes: [
      'The body of a Kajabi page is built from `section` instances containing blocks.',
      'A "hero" is typically: 1 section with 1 text block (headline + subheadline) + optional image block + 1-2 text blocks with use_btn=true for CTAs.',
      'A "feature_cards" or "icon_card_row" is: 1 section with N feature blocks (one per card). Each feature block has a single `text` HTML field — put the heading inline as `<h3>...</h3>` and body as `<p>...</p>`; there is no separate heading/body field.',
      'A "testimonials" row is: 1 section with N feature blocks (each card = quote + author, written inline in the `text` HTML).',
      'A "cta_band" is: 1 section with 1-2 text blocks where use_btn=true.',
      'A "content_media_split" is: 1 section with 1 text block + 1 image block side-by-side.',
      'A "stats_row" is: 1 section with N feature blocks (each = number + label, written inline in the `text` HTML as `<h3>` + `<p>`).',
    ],
  };
}
