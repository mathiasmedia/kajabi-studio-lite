/**
 * Section wrappers — HeaderSection, ContentSection, FooterSection
 *
 * Each is a React component that:
 * 1. Renders its children inside a styled container (preview)
 * 2. Carries static metadata (__kajabiSectionFlavor, __allowedBlockTypes)
 *    used by the tree walker to assemble Kajabi JSON
 *
 * Allowed block types per flavor:
 * - header: logo, menu, dropdown, user, social_icons, link_list, cta
 * - content: text, cta, code, feature, image, pricing_card, social_icons,
 *            accordion, video_embed
 * - footer: copyright, logo, social_icons
 */
import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode, type CSSProperties } from 'react';
import type { BlockComponent, SectionLayoutProps } from './types';
import type { SectionComponent } from './serialize';

/**
 * Read the Kajabi column width (1-12) for a block child. Mirrors
 * `snippets/block.liquid` which wraps each block in `<div class="col-md-{width}">`.
 * Falls back to the block's serialize() output, then to '12' for safety.
 */
function getBlockColWidth(child: ReactElement): string {
  const props = (child.props ?? {}) as Record<string, unknown>;
  if (typeof props.width === 'string' && props.width) return props.width;
  if (typeof props.colWidth === 'string' && props.colWidth) return props.colWidth;
  const ChildType = child.type as Partial<BlockComponent>;
  if (typeof ChildType?.serialize === 'function') {
    try {
      const s = ChildType.serialize(props);
      if (s && typeof s.width === 'string' && s.width) return s.width;
    } catch {
      // ignore — preview-only fallback
    }
  }
  return '12';
}

function isBlockChild(child: ReactNode): child is ReactElement {
  return (
    isValidElement(child) &&
    typeof child.type === 'function' &&
    'kajabiType' in (child.type as object)
  );
}

/**
 * Wrap content-section children in a Bootstrap-style `.row` with each block
 * inside `<div class="col-md-{width}">`. Mirrors the Kajabi
 * `snippets/block.liquid` markup so multi-column layouts (features, cards,
 * pricing) reflow correctly in the live preview iframe.
 *
 * Non-block children (raw JSX) are passed through unwrapped to avoid
 * disrupting any caller that injects layout helpers directly.
 */
function wrapContentChildren(children: ReactNode): ReactNode {
  const wrapped: ReactNode[] = [];
  const counter = { i: 0 };

  // Kajabi uses Bootstrap-style gutters: columns keep their exact percentage
  // width and get horizontal padding inside each `.col-*`, rather than extra
  // gap between sibling columns. Using flex `columnGap` here made the preview
  // look much looser than the real Kajabi render.
  //
  // IMPORTANT: do NOT auto-margin columns when there are siblings in the row
  // — that pushes each column to the center of its own slot and creates huge
  // visual gaps. Auto-centering only applies when a single sub-12 column is
  // alone in its row (handled below after we know the full row contents).
  const COL_PADDING = 15;
  const ROW_GAP = 28;
  const cols: Array<{ w: number; node: ReactNode; key: string }> = [];

  function pushCol(width: string, content: ReactNode) {
    const w = Number(width) || 12;
    cols.push({ w, node: content, key: `col-${counter.i++}` });
  }

  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (isValidElement(child) && child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children);
        return;
      }
      if (isValidElement(child) && (child.props as Record<string, unknown>)?.['data-block-wrapper'] === 'true') {
        const inner = (child.props as { children?: ReactNode }).children;
        const innerEl = Children.toArray(inner).find(isBlockChild) as ReactElement | undefined;
        if (innerEl) {
          pushCol(getBlockColWidth(innerEl), child);
          return;
        }
      }
      if (isBlockChild(child)) {
        pushCol(getBlockColWidth(child), cloneElement(child));
        return;
      }
      if (isValidElement(child)) {
        wrapped.push(<Fragment key={`f-${counter.i++}`}>{child}</Fragment>);
      }
    });
  }

  visit(children);

  // Build the actual column wrappers now that we know how many siblings
  // share the row. Auto-margin is applied ONLY when a single sub-12 column
  // is alone in the row (so it centers like Kajabi's mx-auto on a lone col).
  const isSingleSubFull = cols.length === 1 && cols[0].w < 12;
  for (const c of cols) {
    const basis = `${(c.w / 12) * 100}%`;
    wrapped.push(
      <div
        key={c.key}
        className={`col-md-${c.w}`}
        style={{
          flex: `0 0 ${basis}`,
          maxWidth: basis,
          paddingLeft: `${COL_PADDING}px`,
          paddingRight: `${COL_PADDING}px`,
          marginLeft: isSingleSubFull ? 'auto' : undefined,
          marginRight: isSingleSubFull ? 'auto' : undefined,
          boxSizing: 'border-box',
        }}
      >
        {c.node}
      </div>,
    );
  }

  return (
    <div
      className="row font-extralight"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        rowGap: `${ROW_GAP}px`,
        margin: 0,
      }}
    >
      {wrapped}
    </div>
  );
}

// ---- Allowed block type sets ----

// Source of truth: {% schema %} blocks in
// public/base-theme/streamlined-home.zip → sections/{header,footer,section}.liquid.
// Header schema also allows 'dropdown', 'user', 'hello_bar' — not in our React lib yet.
const HEADER_ALLOWED = new Set(['logo', 'menu', 'cta', 'social_icons']);
const CONTENT_ALLOWED = new Set([
  'text', 'cta', 'code', 'feature', 'image',
  'pricing', 'social_icons', 'accordion', 'video_embed',
  'video', 'card', 'form', 'link_list',
]);
const FOOTER_ALLOWED = new Set(['logo', 'link_list', 'copyright', 'social_icons']);

// ---- Shared style builder for preview ----

function buildSectionStyle(props: SectionLayoutProps): CSSProperties {
  const style: CSSProperties = {};
  // Kajabi parity for image+color sections (AGENTS.md §4.6):
  //   In Kajabi's section.liquid, when bg_type === 'image', the section
  //   renders the image as one layer and the `background_color` as a
  //   SEPARATE OVERLAY DIV painted ON TOP of the image. So an opaque
  //   color completely hides the image — that's the whole point of the
  //   "use rgba with a<1 or empty string" rule.
  //
  //   Naïve CSS (`background-color` + `background-image` on the same
  //   element) layers them the OPPOSITE way — the image always paints
  //   on top of the color — which makes opaque-color-over-image bugs
  //   invisible in the editor preview but obvious after Kajabi export.
  //
  //   To match Kajabi, when BOTH are set we stack the color as a tinted
  //   gradient layer ABOVE the image inside `background-image`. Now an
  //   opaque `#000000` covers the image in the editor too, and authors
  //   (or the AI) catch the bug before exporting.
  const hasImage = typeof props.backgroundImage === 'string' && props.backgroundImage.length > 0;
  if (hasImage) {
    const layers: string[] = [];
    if (props.background) {
      // A solid-color "gradient" (same color top + bottom) acts as an
      // opaque overlay layer. rgba(...,a<1) authors get a real tint;
      // opaque hex/rgb authors get a full cover — same as Kajabi.
      layers.push(`linear-gradient(${props.background}, ${props.background})`);
    }
    layers.push(`url(${props.backgroundImage})`);
    style.backgroundImage = layers.join(', ');
    style.backgroundSize = 'cover';
    style.backgroundPosition = props.bgPosition ?? 'center';
    if (props.backgroundFixed) style.backgroundAttachment = 'fixed';
  } else if (props.background) {
    // No image — color renders normally.
    style.backgroundColor = props.background;
  }
  if (props.textColor) style.color = props.textColor;

  const pd = props.paddingDesktop;
  if (pd) {
    style.paddingTop = pd.top ? `${pd.top}px` : undefined;
    style.paddingRight = pd.right ? `${pd.right}px` : undefined;
    style.paddingBottom = pd.bottom ? `${pd.bottom}px` : undefined;
    style.paddingLeft = pd.left ? `${pd.left}px` : undefined;
  }

  // Vertical alignment (content sections)
  if (props.vertical) {
    style.display = 'flex';
    style.flexDirection = 'column';
    style.justifyContent =
      props.vertical === 'top' ? 'flex-start' :
      props.vertical === 'bottom' ? 'flex-end' : 'center';
  }
  if (props.fullHeight) style.minHeight = '100vh';

  return style;
}

function innerStyle(props: SectionLayoutProps): CSSProperties {
  const s: CSSProperties = {
    maxWidth: props.fullWidth ? '100%' : (props.maxWidth ? `${props.maxWidth}px` : '1170px'),
    margin: '0 auto',
    width: '100%',
  };
  if (props.horizontal) {
    s.textAlign = props.horizontal as CSSProperties['textAlign'];
  }
  return s;
}

// ---- HeaderSection ----

type SectionProps = { children?: ReactNode } & SectionLayoutProps;

export const HeaderSection: SectionComponent = (props) => {
  const base = buildSectionStyle(props);
  if (props.sticky) {
    base.position = 'sticky';
    base.top = 0;
    base.zIndex = 40;
  } else if (props.position === 'overlay') {
    base.position = 'absolute';
    base.top = 0;
    base.left = 0;
    base.right = 0;
    base.zIndex = 40;
  }
  const innerH: CSSProperties = {
    ...innerStyle(props),
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    justifyContent:
      props.horizontalAlignment === 'between' ? 'space-between' :
      props.horizontalAlignment === 'around' ? 'space-around' :
      props.horizontalAlignment === 'center' ? 'center' :
      props.horizontalAlignment === 'right' ? 'flex-end' :
      'space-between',
  };
  return (
    <header style={base}>
      <div style={innerH}>{props.children}</div>
    </header>
  );
};
HeaderSection.__kajabiSectionFlavor = 'header';
HeaderSection.__allowedBlockTypes = HEADER_ALLOWED;

// ---- ContentSection ----

export const ContentSection: SectionComponent = (props) => {
  return (
    <section style={buildSectionStyle(props)}>
      <div style={innerStyle(props)}>{wrapContentChildren(props.children)}</div>
    </section>
  );
};
ContentSection.__kajabiSectionFlavor = 'content';
ContentSection.__allowedBlockTypes = CONTENT_ALLOWED;

// ---- FooterSection ----

export const FooterSection: SectionComponent = (props) => {
  const inner: CSSProperties = {
    ...innerStyle(props),
    display: 'flex',
    flexDirection: props.verticalLayout ? 'column' : 'row',
    gap: props.verticalLayout ? 24 : 32,
    alignItems: props.verticalLayout ? 'center' : 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  };
  return (
    <footer style={buildSectionStyle(props)}>
      <div style={inner}>{props.children}</div>
    </footer>
  );
};
FooterSection.__kajabiSectionFlavor = 'footer';
FooterSection.__allowedBlockTypes = FOOTER_ALLOWED;
