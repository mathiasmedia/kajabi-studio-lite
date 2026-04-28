/**
 * SitePreview — renders the home page from a site's `design` JSON, scaled
 * to a thumbnail. Sites without a design fall back to a friendly empty card.
 *
 * Parity with the editor preview:
 *  - The thumbnail tree is wrapped in `.preview-root` so authors' preview-
 *    scoped customCss selectors (e.g. `.preview-root > section:first-of-type
 *    ::before`) match here too — without this, hero overlays render in the
 *    editor and the export but are invisible in the dashboard thumbnail.
 *  - The site's customCss is injected into the inner stage as a scoped
 *    <style> tag (instance-scoped via a unique id so multiple thumbnails on
 *    the same dashboard don't collide).
 *  - Site fonts are injected per-instance the same way SiteEditor does, so
 *    headings/body in thumbnails use the right family.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Site } from '@/lib/siteStore';
import { renderDesign } from '@/lib/siteDesign/render';
import { resolvePreviewFonts } from '@/lib/siteDesign/resolvePreviewFonts';

const RENDER_WIDTH = 1280;
const RENDER_HEIGHT = 800;
const AT_RULE_BLOCK_RE = /@(media|supports|container|layer)[^{]+\{[\s\S]*?\}\s*\}/g;
const TOP_LEVEL_RULE_RE = /(^|\})\s*([^@{}][^{}]*)\{/g;

function scopeSelectorList(selectorList: string, scope: string) {
  return selectorList
    .split(',')
    .map((selector) => {
      const trimmed = selector.trim();
      if (!trimmed) return trimmed;
      if (trimmed.startsWith(scope)) return trimmed;
      if (/^(:root|html|body)\b/.test(trimmed)) {
        return trimmed.replace(/^(:root|html|body)\b/, scope);
      }
      return `${scope} ${trimmed}`;
    })
    .join(', ');
}

function scopeCss(css: string, scope: string) {
  const scopeTopLevelRules = (fragment: string) =>
    fragment.replace(TOP_LEVEL_RULE_RE, (_match, brace, selectorList) => {
      return `${brace} ${scopeSelectorList(selectorList, scope)} {`;
    });

  return scopeTopLevelRules(
    css.replace(AT_RULE_BLOCK_RE, (block) => {
      const openIndex = block.indexOf('{');
      const closeIndex = block.lastIndexOf('}');
      if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) return block;

      const header = block.slice(0, openIndex + 1);
      const inner = block.slice(openIndex + 1, closeIndex);
      const footer = block.slice(closeIndex);

      return `${header}${scopeTopLevelRules(inner)}${footer}`;
    }),
  );
}

export function SitePreview({ site }: { site: Site }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);
  const reactId = useId();
  // CSS-safe scope class — useId returns ":r0:" style values that aren't
  // valid in selectors, so strip non-alphanumerics.
  const scopeClass = useMemo(
    () => `preview-thumb-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`,
    [reactId],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / RENDER_WIDTH);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scope the site's customCss to THIS thumbnail. We rewrite every selector
  // so it's prefixed with `.<scopeClass>` — this both isolates the styles to
  // this tile (so 12 thumbnails don't fight each other) and makes the
  // author's `.preview-root > ...` selectors actually match the tree we
  // render below (which IS wrapped in `.preview-root` inside this scope).
  const scopedCss = useMemo(() => {
    const css = site.design?.customCss;
    if (!css || typeof css !== 'string' || css.trim() === '') return '';
    return scopeCss(css, `.${scopeClass}`);
  }, [site.design?.customCss, scopeClass]);

  // Inject Google Fonts + family rules per-instance, scoped to this tile.
  // Honors Pro themeSettings custom-font slots so thumbnails match the
  // exported Kajabi site (not just design.fonts.heading/body).
  useEffect(() => {
    const resolved = resolvePreviewFonts(site.design ?? null);
    if (!resolved) return;
    const { headingFamily, bodyFamily, googleFamilies, rawLinkTags } = resolved;
    const cleanupNodes: HTMLElement[] = [];

    if (googleFamilies.length > 0) {
      const families = googleFamilies.map((k) =>
        `${k.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800`,
      );
      const href = `https://fonts.googleapis.com/css2?${families
        .map((f) => `family=${f}`)
        .join('&')}&display=swap`;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.thumbFonts = scopeClass;
      document.head.appendChild(link);
      cleanupNodes.push(link);
    }

    rawLinkTags.forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.thumbFonts = scopeClass;
      document.head.appendChild(link);
      cleanupNodes.push(link);
    });

    const headingStack = headingFamily ? `'${headingFamily}', Georgia, serif` : null;
    const bodyStack = bodyFamily
      ? `'${bodyFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
      : null;
    if (headingStack || bodyStack || resolved.overrideCss) {
      const style = document.createElement('style');
      style.dataset.thumbFonts = scopeClass;
      const scope = `.${scopeClass}`;
      const scopedOverrides = resolved.overrideCss ? scopeCss(resolved.overrideCss, scope) : '';
      style.textContent = [
        bodyStack ? `${scope}, ${scope} * { font-family: ${bodyStack}; }` : '',
        headingStack
          ? `${scope} :is(h1,h2,h3,h4,h5,h6), ${scope} :is(h1,h2,h3,h4,h5,h6) * { font-family: ${headingStack}; }`
          : '',
        scopedOverrides,
      ]
        .filter(Boolean)
        .join('\n');
      document.head.appendChild(style);
      cleanupNodes.push(style);
    }

    return () => {
      cleanupNodes.forEach((n) => n.remove());
    };
  }, [site.design, scopeClass]);

  let content: React.ReactNode = null;
  try {
    if (site.design) {
      // Image slot resolution at thumbnail scale isn't worth a DB round-trip.
      content = renderDesign(site.design, 'index', {});
    }
  } catch (err) {
    console.error('[SitePreview] render failed:', err);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: `${RENDER_WIDTH} / ${RENDER_HEIGHT}` }}
    >
      {content ? (
        <div
          aria-hidden
          className={`preview-root ${scopeClass}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: RENDER_WIDTH,
            height: RENDER_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {scopedCss && <style>{scopedCss}</style>}
          {content}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10">
          <div className="text-center">
            <div className="font-serif text-2xl font-semibold text-foreground">
              {site.brandName}
            </div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              No design yet
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
