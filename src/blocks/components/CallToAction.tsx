/**
 * <CallToAction> block — Kajabi `cta` type.
 *
 * Real Kajabi schema (from block_cta.liquid): NO heading or subheading.
 * Just a button — text/action/style/colors plus an optional image action.
 * If you need text alongside the button, use a separate <Text> block.
 *
 * Universal chrome flows in via ChromeProps so a CTA can render as a card.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface CallToActionProps extends ChromeProps {
  buttonText: string;
  buttonUrl: string;
  buttonStyle?: 'solid' | 'outline';
  buttonSize?: 'small' | 'medium' | 'large';
  buttonWidth?: 'auto' | 'full';
  buttonTextColor?: string;
  buttonBackgroundColor?: string;
  buttonBorderRadius?: string;
  newTab?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Bootstrap col 1-12 — default 12 */
  width?: string;
}

export const CallToAction: BlockComponent<CallToActionProps> = (props) => {
  const align = props.align ?? 'center';
  const isOutline = props.buttonStyle === 'outline';
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={{ textAlign: align, padding: '12px 0', ...chrome }}>
      <a
        // .btn so Pro themeSettings button overrides (uppercase, letter-spacing,
        // weight, padding, font-family) reach the preview via overrideCss.
        className={`btn btn--${props.buttonStyle ?? 'solid'} btn--${props.buttonSize ?? 'medium'}`}
        href={props.buttonUrl}
        target={props.newTab ? '_blank' : undefined}
        rel={props.newTab ? 'noopener noreferrer' : undefined}
        style={{
          display: 'inline-block',
          // No inline padding/font-size — let `.btn` overrideCss from
          // resolvePreviewFonts() (driven by themeSettings.button_*_padding)
          // win. Inline styles outrank external CSS, so setting padding here
          // would silently break the Pro padding controls in the preview.
          color: props.buttonTextColor || (isOutline ? 'currentColor' : '#fff'),
          backgroundColor: isOutline ? 'transparent' : (props.buttonBackgroundColor || '#3B82F6'),
          // Outline border falls back to buttonTextColor (matches Pro Liquid
          // semantics) and finally currentColor — never a hardcoded blue.
          border: isOutline
            ? `1px solid ${props.buttonBackgroundColor || props.buttonTextColor || 'currentColor'}`
            : 'none',
          borderRadius: props.buttonBorderRadius ? `${props.buttonBorderRadius}px` : 4,
          textDecoration: 'none',
          width: props.buttonWidth === 'full' ? '100%' : 'auto',
          // Tasteful preview defaults that .btn overrideCss can override.
          padding: undefined,
        }}
      >
        {props.buttonText}
      </a>
    </div>
  );
};

CallToAction.kajabiType = 'cta';
CallToAction.allowedIn = ['content'];
CallToAction.serialize = (p) => withBlockDefaults({
  width: p.width ?? '12',
  text_align: p.align ?? 'center',
  alignment: p.align ?? 'center',
  ...serializeChromeProps(p),
  btn_text: p.buttonText ?? '',
  btn_action: p.buttonUrl ?? '',
  btn_style: p.buttonStyle ?? 'solid',
  btn_size: p.buttonSize ?? 'medium',
  btn_width: p.buttonWidth ?? 'auto',
  btn_text_color: p.buttonTextColor ?? '',
  btn_background_color: p.buttonBackgroundColor ?? '',
  btn_border_radius: p.buttonBorderRadius ?? '',
  new_tab: p.newTab ? 'true' : 'false',
});
