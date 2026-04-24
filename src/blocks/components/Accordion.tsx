/**
 * <Accordion> block — Kajabi `accordion` type.
 *
 * Real Kajabi schema (from block_accordion.liquid):
 *   - heading (the question / summary)
 *   - body (HTML answer)
 *   - background_color, accordion_icon, icon_color
 *
 * NOTE: There's no `expanded` field in Kajabi — the open/close state is UX-only.
 * Universal chrome (padding, border_radius, box_shadow) flows in via ChromeProps;
 * background_color lands the same way (overriding the legacy `backgroundColor` prop).
 */
import { useState } from 'react';
import type { BlockComponent } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface AccordionProps extends ChromeProps {
  heading: string;
  body: string;
  iconColor?: string;
  /** Bootstrap col 1-12. Default 12 (full row). */
  width?: string;
  defaultOpen?: boolean;
}

export const Accordion: BlockComponent<AccordionProps> = (props) => {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const chrome = getBlockChromeStyle(props);
  return (
    <div
      style={{
        borderBottom: '1px solid #ddd',
        padding: '12px 0',
        ...chrome,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', textAlign: 'left',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '1em', fontWeight: 600, padding: 0,
          display: 'flex', justifyContent: 'space-between',
          color: 'inherit',
        }}
      >
        <span>{props.heading}</span>
        <span style={{ color: props.iconColor }}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div
          style={{ paddingTop: 8 }}
          dangerouslySetInnerHTML={{ __html: props.body }}
        />
      )}
    </div>
  );
};

Accordion.kajabiType = 'accordion';
Accordion.allowedIn = ['content'];
Accordion.serialize = (p) => withBlockDefaults({
  width: p.width ?? '12',
  text_align: 'left',
  heading: p.heading ?? '',
  body: p.body ?? '',
  background_color: p.backgroundColor ?? '',
  ...serializeChromeProps(p),
  icon_color: p.iconColor ?? '',
});
