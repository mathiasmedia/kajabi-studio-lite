/**
 * SitePreview — renders the home page from a site's `design` JSON, scaled
 * to a thumbnail. Sites without a design fall back to a friendly empty card.
 */
import { useEffect, useRef, useState } from 'react';
import type { Site } from '@/lib/siteStore';
import { renderDesign } from '@/lib/siteDesign/render';

const RENDER_WIDTH = 1280;
const RENDER_HEIGHT = 800;

export function SitePreview({ site }: { site: Site }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);

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
