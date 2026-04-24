/**
 * <Logo> block — Kajabi `logo` type.
 *
 * Real Kajabi schema (from shared_block_logo.liquid):
 *   logo (image url), logo_text, logo_text_color, logo_type, logo_width, image_alt
 *
 * Universal chrome flows in via ChromeProps. Note the legacy `textColor`
 * prop is the Kajabi `logo_text_color`, distinct from the universal chrome.
 */
import type { BlockComponent } from '../types';
import { getBlockChromeStyle, type ChromeProps } from '../blockChrome';

export interface LogoProps extends ChromeProps {
  type?: 'image' | 'text';
  imageUrl?: string;
  imageAlt?: string;
  text?: string;
  textColor?: string;
  /** Width in pixels */
  width?: string;
  /** Preview-only alignment (not exported — Kajabi controls this at section level) */
  align?: 'left' | 'center' | 'right';
}

export const Logo: BlockComponent<LogoProps> = (props) => {
  const align = props.align ?? 'left';
  const justifyContent =
    align === 'left' ? 'flex-start' :
    align === 'right' ? 'flex-end' : 'center';
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={{ display: 'flex', justifyContent, padding: '8px 0', ...chrome }}>
      {props.type === 'text' || !props.imageUrl ? (
        <span style={{
          fontWeight: 700, fontSize: '1.4em',
          color: props.textColor || 'inherit',
        }}>
          {props.text || 'Brand'}
        </span>
      ) : (
        <img
          src={props.imageUrl}
          alt={props.imageAlt ?? props.text ?? ''}
          style={{ width: props.width ? `${props.width}px` : 'auto', maxWidth: 200 }}
        />
      )}
    </div>
  );
};

Logo.kajabiType = 'logo';
Logo.allowedIn = ['header', 'footer'];
Logo.serialize = (p) => ({
  logo: p.imageUrl ?? '',
  logo_text: p.text ?? '',
  logo_type: p.type ?? (p.imageUrl ? 'image' : 'text'),
  logo_width: p.width ?? '50',
  logo_text_color: p.textColor ?? '',
  image_alt: p.imageAlt ?? '',
});
