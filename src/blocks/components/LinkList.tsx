/**
 * <LinkList> block — Kajabi `link_list` type.
 *
 * Universal chrome flows in via ChromeProps so a link list can be carded.
 */
import type { BlockComponent, SectionFlavor } from '../types';
import { withBlockDefaults } from '../blockDefaults';
import { getBlockChromeStyle, serializeChromeProps, type ChromeProps } from '../blockChrome';

export interface LinkListProps extends ChromeProps {
  heading?: string;
  /** Kajabi menu handle whose links to render. */
  handle?: string;
  alignment?: 'left' | 'center' | 'right';
  layout?: 'horizontal' | 'vertical';
  /** Bootstrap col 1-12 (only used in content sections) */
  width?: string;
  /** Preview-only items shown in the editor (Kajabi resolves the real menu by handle). */
  previewItems?: { label: string; url?: string }[];
}

export const LinkList: BlockComponent<LinkListProps> = (props) => {
  const items = props.previewItems ?? [
    { label: 'Privacy' }, { label: 'Terms' }, { label: 'Contact' }, { label: 'Support' },
  ];
  const isHorizontal = (props.layout ?? 'vertical') === 'horizontal';
  const align =
    props.alignment === 'center' ? 'center' :
    props.alignment === 'right' ? 'flex-end' : 'flex-start';
  const chrome = getBlockChromeStyle(props);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: 10, ...chrome }}>
      {props.heading && (
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.85 }}>{props.heading}</div>
      )}
      <ul style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        gap: isHorizontal ? 16 : 8,
      }}>
        {items.map((item) => (
          <li key={item.label}>
            <a href={item.url ?? '#'} style={{ color: 'inherit', textDecoration: 'none', fontSize: 14, opacity: 0.78 }}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

LinkList.kajabiType = 'link_list';
LinkList.allowedIn = ['header', 'content', 'footer'] as SectionFlavor[];
LinkList.serialize = (p) => {
  return withBlockDefaults({
    width: p.width ?? '6',
    text_align: p.alignment ?? 'center',
    ...serializeChromeProps(p),
    menu: p.handle ?? 'main-menu',
    show_title: p.heading ? 'true' : 'false',
    title: p.heading ?? '',
    vertical: p.layout === 'horizontal' ? 'row' : 'column',
    new_tab: 'false',
  });
};
