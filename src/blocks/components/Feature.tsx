/**
 * <Feature> block — Kajabi `feature` type.
 *
 * Real Kajabi schema (from block_feature.liquid):
 *   - text (HTML, includes BOTH heading and body — single rich-text field)
 *   - image, image_alt, image_width, hide_image, image_border_radius
 *   - img_action, new_tab_image
 *   - use_btn + shared button fields
 *
 * Universal chrome (background_color, padding, border_radius, box_shadow)
 * lands on the root via getBlockChromeStyle so feature tiles render as
 * cards whenever the planner sets those fields.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface FeatureProps extends ChromeProps {
  /** HTML content — wrap heading in <h3> and body in <p> */
  text: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: string;
  imageBorderRadius?: string;
  hideImage?: boolean;
  imageHref?: string;
  newTabImage?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Bootstrap col 1-12. For a 3-col grid use width="4". */
  width?: string;
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

export const Feature: BlockComponent<FeatureProps> = (props) => {
  const align = props.align ?? 'center';
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={{ textAlign: align, padding: '16px 0', ...chrome }}>
      {!props.hideImage && props.image && (
        <img
          src={props.image}
          alt={props.imageAlt ?? ''}
          style={{
            maxWidth: props.imageWidth ? `${props.imageWidth}px` : 80,
            marginBottom: 12,
          }}
        />
      )}
      <div dangerouslySetInnerHTML={{ __html: props.text }} />
      {props.showButton && props.buttonText && (() => {
        const isOutline = props.buttonStyle === 'outline';
        const sizePad =
          props.buttonSize === 'small' ? '8px 16px' :
          props.buttonSize === 'large' ? '14px 28px' :
          '10px 20px';
        return (
          <a
            href={props.buttonUrl || '#'}
            target={props.newTab ? '_blank' : undefined}
            rel={props.newTab ? 'noopener noreferrer' : undefined}
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: sizePad,
              color: props.buttonTextColor || (isOutline ? '#3B82F6' : '#fff'),
              backgroundColor: isOutline ? 'transparent' : (props.buttonBackgroundColor || '#3B82F6'),
              border: isOutline ? `2px solid ${props.buttonBackgroundColor || '#3B82F6'}` : 'none',
              borderRadius: props.buttonBorderRadius ? `${props.buttonBorderRadius}px` : 4,
              textDecoration: 'none',
              width: props.buttonWidth === 'full' ? '100%' : 'auto',
            }}
          >
            {props.buttonText}
          </a>
        );
      })()}
    </div>
  );
};

Feature.kajabiType = 'feature';
Feature.allowedIn = ['content'];
Feature.serialize = (p) => withBlockDefaults({
  text: p.text ?? '',
  width: p.width ?? '4',  // default to 3-column grid
  text_align: p.align ?? 'center',
  ...serializeChromeProps(p),
  background_color: p.backgroundColor ?? '',
  border_radius: p.borderRadius != null ? String(p.borderRadius) : '',
  box_shadow: p.boxShadow === 'small' || p.boxShadow === 'medium' || p.boxShadow === 'large' ? p.boxShadow : 'none',
  image: p.image ?? '',
  image_alt: p.imageAlt ?? '',
  image_width: p.imageWidth ?? '',
  image_border_radius: p.imageBorderRadius ?? '',
  hide_image: p.hideImage === false ? 'false' : (p.image ? 'false' : 'true'),
  img_action: p.imageHref ?? '',
  new_tab_image: p.newTabImage ? 'true' : 'false',
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
