/**
 * <Menu> block — Kajabi `menu` type.
 *
 * Renders a navigation menu by referencing a Kajabi menu by handle.
 * Universal chrome flows in via ChromeProps.
 */
import type { BlockComponent } from '../types';
import { getBlockChromeStyle, type ChromeProps } from '../blockChrome';

export interface MenuItem {
  label: string;
  url: string;
}

export interface MenuProps extends ChromeProps {
  /** Kajabi menu handle. Defaults to 'main-menu'. */
  handle?: string;
  alignment?: 'left' | 'center' | 'right';
  stretch?: boolean;
  /**
   * Optional explicit link list shown ONLY in the live preview.
   * Kajabi resolves the real menu by `handle` at render time and ignores this.
   */
  previewItems?: MenuItem[];
}

export const Menu: BlockComponent<MenuProps> = (props) => {
  const items: MenuItem[] = props.previewItems ?? [
    { label: 'Home', url: '#' },
    { label: 'Features', url: '#' },
    { label: 'Pricing', url: '#' },
    { label: 'About', url: '#' },
  ];
  const justify =
    props.alignment === 'left' ? 'flex-start' :
    props.alignment === 'center' ? 'center' : 'flex-end';
  const chrome = getBlockChromeStyle(props);
  return (
    <nav style={{
      display: 'flex',
      gap: 24,
      justifyContent: justify,
      alignItems: 'center',
      flex: props.stretch === false ? '0 0 auto' : 1,
      ...chrome,
    }}>
      {items.map((item) => (
        <a key={item.label} href={item.url} style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}>
          {item.label}
        </a>
      ))}
    </nav>
  );
};

Menu.kajabiType = 'menu';
Menu.allowedIn = ['header', 'footer'];
Menu.serialize = (p) => ({
  menu: p.handle ?? 'main-menu',
  alignment: p.alignment ?? 'right',
  stretch: p.stretch === false ? 'false' : 'true',
});
