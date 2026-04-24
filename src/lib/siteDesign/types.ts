/**
 * Site Design — JSON shape that fully describes a site.
 */
import type {
  ContentSectionProps,
  HeaderSectionProps,
  FooterSectionProps,
} from '@/blocks/types';

export const SITE_DESIGN_VERSION = 1 as const;

export interface DesignBlock {
  type: string;
  props: Record<string, unknown>;
}

export type DesignSection =
  | { kind: 'header'; name?: string; props: HeaderSectionProps; blocks: DesignBlock[]; }
  | { kind: 'content'; name?: string; props: ContentSectionProps; blocks: DesignBlock[]; }
  | { kind: 'footer'; name?: string; props: FooterSectionProps; blocks: DesignBlock[]; }
  | {
      kind: 'raw';
      type: string;
      name?: string;
      settings?: Record<string, unknown>;
      blocks?: Record<string, { type: string; settings: Record<string, unknown> }>;
      blockOrder?: string[];
      hidden?: 'true' | 'false';
    };

export interface DesignPage {
  sections: DesignSection[];
}

export interface SiteDesign {
  version: typeof SITE_DESIGN_VERSION;
  pageKeys: string[];
  pages: Record<string, DesignPage>;
  fonts?: { heading?: string; body?: string; extras?: string[]; };
  themeSettings?: Record<string, string>;
  customCss?: string;
}

export function isSiteDesign(value: unknown): value is SiteDesign {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { version?: unknown }).version === SITE_DESIGN_VERSION &&
    Array.isArray((value as { pageKeys?: unknown }).pageKeys) &&
    typeof (value as { pages?: unknown }).pages === 'object'
  );
}

export interface SlotRef { slot: string; }

export function isSlotRef(value: unknown): value is SlotRef {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { slot?: unknown }).slot === 'string'
  );
}
