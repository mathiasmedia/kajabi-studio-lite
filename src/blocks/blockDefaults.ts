/**
 * Universal Kajabi block-level defaults.
 *
 * Every block, regardless of type, is rendered through `snippets/block.liquid`
 * which reads these fields:
 *   - width            (1-12 column width — REQUIRED, missing = `col-` = collapsed/broken)
 *   - text_align       (left | center | right — used as `text-<value>` class)
 *   - box_shadow       (none | small | medium | large)
 *   - background_color (color scheme class — leave blank for transparent)
 *   - animation_type, animation_direction, delay, duration
 *   - reveal_offset, reveal_event, reveal_units
 *   - hide_on_desktop, hide_on_mobile (boolean_string)
 *   - make_block        (inserts visual break)
 *
 * Use `withBlockDefaults({ width: '6', ... })` to merge defaults with
 * per-block overrides in each component's serialize() function.
 */

export interface BlockBaseSettings {
  width?: string;                 // '1'..'12'
  text_align?: 'left' | 'center' | 'right';
  box_shadow?: 'none' | 'small' | 'medium' | 'large';
  background_color?: string;
  animation_type?: string;
  animation_direction?: string;
  delay?: string;
  duration?: string;
  hide_on_desktop?: 'true' | 'false';
  hide_on_mobile?: 'true' | 'false';
  make_block?: 'true' | 'false';
}

const DEFAULTS: Required<Pick<BlockBaseSettings,
  'width' | 'text_align' | 'box_shadow' | 'animation_type' | 'animation_direction' |
  'delay' | 'duration' | 'hide_on_desktop' | 'hide_on_mobile' | 'make_block'
>> = {
  width: '12',
  text_align: 'center',
  box_shadow: 'none',
  animation_type: 'none',
  animation_direction: 'none',
  delay: '0',
  duration: '500',
  hide_on_desktop: 'false',
  hide_on_mobile: 'false',
  make_block: 'false',
};

/** Merge universal block defaults with per-block settings. Per-block wins. */
export function withBlockDefaults<T extends Record<string, unknown>>(
  settings: T & BlockBaseSettings,
): T & typeof DEFAULTS {
  return { ...DEFAULTS, ...settings } as T & typeof DEFAULTS;
}
