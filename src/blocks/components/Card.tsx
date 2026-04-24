/**
 * <Card> block — Kajabi `card` type.
 *
 * Flexible content tile: image + heading + text + optional CTA.
 * Universal chrome flows in via ChromeProps. Built-in defaults: white bg,
 * 8px radius, light border. ChromeProps overrides any of these when set.
 */
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface CardProps extends ChromeProps {
  image?: string;
  imageAlt?: string;
  showImage?: boolean;
  heading?: string;
  /** HTML body */
  text?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
  /** Bootstrap col 1-12. For a 3-card row use width="4". */
  width?: string;
}

export const Card: BlockComponent<CardProps> = (props) => {
  const chrome = getBlockChromeStyle(props) ?? {};
  // Built-in defaults — chrome props win where they overlap.
  const style = {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    ...chrome,
  };
  return (
    <div style={style}>
      {props.showImage !== false && props.image && (
        <img
          src={props.image}
          alt={props.imageAlt ?? ''}
          style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }}
        />
      )}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {props.heading && (
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{props.heading}</h3>
        )}
        {props.text && (
          <div
            style={{ fontSize: 14, lineHeight: 1.5, color: '#475569', flex: 1 }}
            dangerouslySetInnerHTML={{ __html: props.text }}
          />
        )}
        {props.buttonText && (
          <a
            href={props.buttonUrl || '#'}
            style={{
              display: 'inline-block',
              alignSelf: 'flex-start',
              marginTop: 8,
              padding: '8px 16px',
              backgroundColor: props.buttonBackgroundColor ?? '#3B82F6',
              color: props.buttonTextColor ?? '#ffffff',
              borderRadius: 4,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {props.buttonText}
          </a>
        )}
      </div>
    </div>
  );
};

Card.kajabiType = 'card';
Card.allowedIn = ['content'];
Card.serialize = (p) => {
  const headingHtml = p.heading ? `<h3>${p.heading}</h3>` : '';
  const description = headingHtml + (p.text ?? '');
  return withBlockDefaults({
    width: p.width ?? '4',
    text_align: 'left',
    image: p.image ?? '',
    description,
    action: '',
    new_tab: 'false',
    show_cta: p.buttonText ? 'true' : 'false',
    btn_text: p.buttonText ?? '',
    btn_width: 'auto',
    btn_style: 'solid',
    btn_size: 'small',
    btn_border_radius: '',
    btn_text_color: p.buttonTextColor ?? '',
    btn_background_color: p.buttonBackgroundColor ?? '',
    background_color: p.backgroundColor ?? '#FFFFFF',
    ...serializeChromeProps(p),
  });
};
