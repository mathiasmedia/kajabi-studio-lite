/**
 * Site Design — JSON shape that fully describes a site.
 *
 * This is the new "design as data" model. A site's full visual identity
 * (page layout, copy, colors, image refs, fonts) lives in `sites.design`
 * jsonb in the database. The renderer + exporter read this JSON and
 * produce React/Kajabi output — no template `.tsx` files involved.
 *
 * Shape mirrors the existing JSX block tree:
 *   <ContentSection background="#fff" padding={...}>
 *     <Text html="..." />
 *     <CallToAction label="..." url="..." />
 *   </ContentSection>
 *
 * becomes:
 *   {
 *     kind: 'content',
 *     name: 'Hero',
 *     props: { background: '#fff', paddingDesktop: {...} },
 *     blocks: [
 *       { type: 'text', props: { html: '...' } },
 *       { type: 'cta', props: { label: '...', url: '...' } }
 *     ]
 *   }
 *
 * Image references support two forms:
 *   - Direct URL (string): used by backfill + AI generations
 *     `{ backgroundImage: 'https://.../mountain.jpg' }`
 *   - Slot reference (object): resolved to current image at render time
 *     `{ backgroundImage: { slot: 'homeHero' } }`
 */
import type {
  ContentSectionProps,
  HeaderSectionProps,
  FooterSectionProps,
} from '@k-studio-pro/engine';

/** Bumped when the JSON shape changes in a non-backwards-compatible way. */
export const SITE_DESIGN_VERSION = 1 as const;

/** Block in a section: type tag + raw props for that block component. */
export interface DesignBlock {
  /** Kajabi block type, e.g. 'text', 'cta', 'feature', 'logo', 'menu'. */
  type: string;
  /** Component props passed verbatim into the block at render time. */
  props: Record<string, unknown>;
}

/** Section variants — one for each section flavor + a passthrough for raw Kajabi sections. */
export type DesignSection =
  | {
      kind: 'header';
      name?: string;
      props: HeaderSectionProps;
      blocks: DesignBlock[];
    }
  | {
      kind: 'content';
      name?: string;
      props: ContentSectionProps;
      blocks: DesignBlock[];
    }
  | {
      kind: 'footer';
      name?: string;
      props: FooterSectionProps;
      blocks: DesignBlock[];
    }
  | {
      kind: 'raw';
      /** Kajabi raw section type (e.g. 'products', 'blog_listings'). */
      type: string;
      name?: string;
      settings?: Record<string, unknown>;
      blocks?: Record<string, { type: string; settings: Record<string, unknown> }>;
      blockOrder?: string[];
      hidden?: 'true' | 'false';
    };

/** A single page = ordered list of sections (header → content[] → footer). */
export interface DesignPage {
  sections: DesignSection[];
}

/**
 * Full site design — all pages plus the global settings the export pipeline
 * needs (fonts, themeSettings, customCss). Mirrors what `TemplateDef` used
 * to declare in code.
 */
export interface SiteDesign {
  version: typeof SITE_DESIGN_VERSION;
  /** Ordered page keys for the editor's tab switcher. */
  pageKeys: string[];
  /** Page key → DesignPage. Must include every key in `pageKeys`. */
  pages: Record<string, DesignPage>;
  fonts?: {
    heading?: string;
    body?: string;
    extras?: string[];
  };
  /** Top-level Kajabi theme settings (color_primary, etc.). */
  themeSettings?: Record<string, string>;
  /** Custom CSS appended to settings_data current.css. */
  customCss?: string;
}

/** Type guard. */
export function isSiteDesign(value: unknown): value is SiteDesign {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { version?: unknown }).version === SITE_DESIGN_VERSION &&
    Array.isArray((value as { pageKeys?: unknown }).pageKeys) &&
    typeof (value as { pages?: unknown }).pages === 'object'
  );
}

/**
 * Slot reference — used inside a block prop to defer image resolution to
 * render time. `{ slot: 'homeHero' }` is replaced with the current
 * site_images URL for that slot.
 */
export interface SlotRef {
  slot: string;
}

export function isSlotRef(value: unknown): value is SlotRef {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { slot?: unknown }).slot === 'string'
  );
}
