/**
 * Universal Kajabi block-level defaults.
 */

export interface BlockBaseSettings {
  width?: string;
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

export function withBlockDefaults<T extends Record<string, unknown>>(
  settings: T & BlockBaseSettings,
): T & typeof DEFAULTS {
  return { ...DEFAULTS, ...settings } as T & typeof DEFAULTS;
}
