/**
 * <Text> block — Kajabi `text` type.
 *
 * Real Kajabi schema (from block_text.liquid):
 *   - text (HTML, the entire content — heading + paragraphs are inline)
 *   - use_btn (boolean_string)
 *   - drop_cap, cap_color
 *   - + shared button fields (btn_text, btn_action, btn_*) when use_btn=true
 *
 * NOTE: Kajabi's text block has NO separate heading field — write headings
 * as <h1>/<h2>/etc inside the `text` HTML.
 *
 * Universal chrome (background_color, padding, border_radius, box_shadow)
 * lands on this block's root via getBlockChromeStyle, so a Text block can
 * render as a card whenever the planner sets those fields.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface TextProps extends ChromeProps {
  /** HTML / rich text content. Use <h1>...<h6> for headings. */
  text: string;
  align?: 'left' | 'center' | 'right';
  /** Bootstrap-style column width 1-12. Default 12 (full width). */
  width?: string;
  /** If true, renders a CTA button below text */
  showButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  buttonTextColor?: string;
  buttonBackgroundColor?: string;
  buttonBorderRadius?: string;
  buttonStyle?: 'solid' | 'outline';
  buttonSize?: 'small' | 'medium' | 'large';
  buttonWidth?: 'auto' | 'full';
  newTab?: boolean;
}

export const Text: BlockComponent<TextProps> = (props) => {
  const align = props.align ?? 'center';
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={{ textAlign: align, padding: '12px 0', ...chrome }}>
      <div dangerouslySetInnerHTML={{ __html: props.text }} />
      {props.showButton && props.buttonText && (
        <a
          href={props.buttonUrl || '#'}
          target={props.newTab ? '_blank' : undefined}
          rel={props.newTab ? 'noopener noreferrer' : undefined}
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '12px 24px',
            color: props.buttonTextColor || '#fff',
            backgroundColor: props.buttonBackgroundColor || '#3B82F6',
            borderRadius: props.buttonBorderRadius ? `${props.buttonBorderRadius}px` : 4,
            textDecoration: 'none',
          }}
        >
          {props.buttonText}
        </a>
      )}
    </div>
  );
};

Text.kajabiType = 'text';
Text.allowedIn = ['content'];
Text.serialize = (p) => withBlockDefaults({
  text: p.text ?? '',
  width: p.width ?? '12',
  text_align: p.align ?? 'center',
  ...serializeChromeProps(p),
  background_color: p.backgroundColor ?? '',
  border_radius: p.borderRadius != null ? String(p.borderRadius) : '',
  box_shadow: p.boxShadow === 'small' || p.boxShadow === 'medium' || p.boxShadow === 'large' ? p.boxShadow : 'none',
  use_btn: p.showButton ? 'true' : 'false',
  btn_text: p.buttonText ?? '',
  btn_action: p.buttonUrl ?? '',
  btn_text_color: p.buttonTextColor ?? '',
  btn_background_color: p.buttonBackgroundColor ?? '',
  btn_border_radius: p.buttonBorderRadius ?? '',
  btn_style: p.buttonStyle ?? 'solid',
  btn_size: p.buttonSize ?? 'medium',
  btn_width: p.buttonWidth ?? 'auto',
  new_tab: p.newTab ? 'true' : 'false',
});
