/**
 * BlockWrapper — visibility + animation hooks only.
 *
 * Universal block-level CHROME (background_color, padding, border_radius,
 * box_shadow, text_align) now lives ON each block component itself via
 * `blockChrome.ts` — that's the "self-chromed for everyone" contract that
 * matches Kajabi exactly, so a value present on a block paints the block's
 * own visible shape rather than a colored band around it.
 *
 * What's left here:
 *   - hide_on_desktop / hide_on_mobile (CSS class breakpoint hiding)
 *   - both-hidden short-circuit (return null)
 *   - animation_type stamped as a CSS variable for inspection only —
 *     the live preview doesn't actually run Kajabi's reveal lib
 *
 * If the block has none of those set, we return the original element
 * unchanged so we don't add an unnecessary DOM node.
 */
import { isValidElement, useId, type CSSProperties, type ReactElement, type ReactNode } from 'react';

type BlockValues = Record<string, unknown>;

interface FontOverride {
  role: 'heading' | 'body' | 'all';
  family: string;
  stack: string;
}

function readFontOverride(values: BlockValues): FontOverride | null {
  const raw = values.fontOverride;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const role = o.role;
  const stack = typeof o.stack === 'string' ? o.stack : null;
  const family = typeof o.family === 'string' ? o.family : null;
  if (!stack || !family) return null;
  if (role !== 'heading' && role !== 'body' && role !== 'all') return null;
  return { role, family, stack };
}

function asString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function isTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

interface WrapperShape {
  style: CSSProperties;
  classes: string[];
  hidden: boolean;
}

function computeWrapper(values: BlockValues): WrapperShape | null {
  const style: CSSProperties = {};
  const classes: string[] = [];
  let touched = false;

  const hideDesktop = isTrue(values.hide_on_desktop);
  const hideMobile = isTrue(values.hide_on_mobile);
  if (hideDesktop) classes.push('hidden md:block');
  if (hideMobile) classes.push('md:hidden');
  if (hideDesktop || hideMobile) touched = true;
  const hidden = hideDesktop && hideMobile;

  const animType = asString(values.animation_type);
  if (animType && animType !== 'none') {
    (style as CSSProperties & { ['--kjb-anim']?: string })['--kjb-anim'] = animType;
    touched = true;
  }

  if (!touched) return null;
  return { style, classes, hidden };
}

/**
 * Wrap a block element with visibility/animation chrome only.
 * Returns the original element unchanged when no relevant fields are set.
 * Returns null when both hide_on_desktop AND hide_on_mobile are true.
 */
export function wrapBlock(element: ReactElement, values: BlockValues, _blockType?: string): ReactNode {
  if (!isValidElement(element)) return element;
  if (!values || typeof values !== 'object') return element;

  const wrapper = computeWrapper(values);
  const fontOverride = readFontOverride(values);
  if (!wrapper && !fontOverride) return element;
  if (wrapper?.hidden) return null;

  const className = wrapper && wrapper.classes.length > 0 ? wrapper.classes.join(' ') : undefined;
  return (
    <FontOverrideWrapper
      className={className}
      style={wrapper?.style}
      fontOverride={fontOverride}
    >
      {element}
    </FontOverrideWrapper>
  );
}

/**
 * Wrap children in a div that optionally applies a per-block font override.
 * For role='all' the family lands on the div via inline style. For role=
 * 'heading' / 'body' we scope the rule via a unique class + a tiny <style>
 * tag so we only retint h1-h6 (or paragraphs), not sibling controls.
 */
function FontOverrideWrapper({
  className,
  style,
  fontOverride,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  fontOverride: FontOverride | null;
  children: ReactNode;
}) {
  const reactId = useId();
  const scopeClass = `pxfo-${reactId.replace(/[^a-z0-9]/gi, '')}`;
  const mergedStyle: CSSProperties = { ...(style ?? {}) };
  if (fontOverride && fontOverride.role === 'all') {
    mergedStyle.fontFamily = fontOverride.stack;
  }
  const finalClassName = [className, fontOverride ? scopeClass : null].filter(Boolean).join(' ') || undefined;
  const selector =
    fontOverride?.role === 'heading'
      ? `.${scopeClass} :is(h1,h2,h3,h4,h5,h6)`
      : fontOverride?.role === 'body'
      ? `.${scopeClass} :is(p,li)`
      : null;
  return (
    <div className={finalClassName} style={mergedStyle} data-block-wrapper="true">
      {selector && (
        <style dangerouslySetInnerHTML={{ __html: `${selector}{font-family:${fontOverride!.stack} !important}` }} />
      )}
      {children}
    </div>
  );
}
