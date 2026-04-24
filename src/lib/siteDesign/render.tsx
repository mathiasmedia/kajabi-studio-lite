/**
 * SiteDesign → JSX renderer.
 *
 * Given a `SiteDesign` JSON document, render any of its pages back into
 * the React block components from `@/blocks`. The output is a normal React
 * tree that:
 *   - The preview can render directly
 *   - The Kajabi exporter can serialize via the existing serializeTree
 *
 * Slot resolution: any prop whose value is `{ slot: 'someKey' }` is
 * replaced with the resolved image URL from the provided slot map. This
 * is how AI-driven edits will reference images without baking absolute
 * URLs into the JSON.
 */
import { createElement, Fragment, type ReactElement, type ReactNode } from 'react';
import {
  HeaderSection,
  ContentSection,
  FooterSection,
  RawSection,
  Logo,
  Menu,
  CallToAction,
  SocialIcons,
  Text,
  Feature,
  Image,
  PricingCard,
  Accordion,
  VideoEmbed,
  Video,
  Card,
  Form,
  CustomCode,
  LinkList,
  Copyright,
} from '@/blocks';
import type { SiteImage } from '@/lib/imageStore';
import type { PageTrees } from '@/blocks';
import type {
  SiteDesign,
  DesignPage,
  DesignSection,
  DesignBlock,
} from './types';
import { isSlotRef } from './types';

/**
 * Block type → React component map.
 * Keys must match the `kajabiType` static on each block component.
 */
const BLOCK_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  logo: Logo as unknown as React.ComponentType<Record<string, unknown>>,
  menu: Menu as unknown as React.ComponentType<Record<string, unknown>>,
  cta: CallToAction as unknown as React.ComponentType<Record<string, unknown>>,
  social_icons: SocialIcons as unknown as React.ComponentType<Record<string, unknown>>,
  text: Text as unknown as React.ComponentType<Record<string, unknown>>,
  feature: Feature as unknown as React.ComponentType<Record<string, unknown>>,
  image: Image as unknown as React.ComponentType<Record<string, unknown>>,
  pricing: PricingCard as unknown as React.ComponentType<Record<string, unknown>>,
  accordion: Accordion as unknown as React.ComponentType<Record<string, unknown>>,
  video_embed: VideoEmbed as unknown as React.ComponentType<Record<string, unknown>>,
  video: Video as unknown as React.ComponentType<Record<string, unknown>>,
  card: Card as unknown as React.ComponentType<Record<string, unknown>>,
  form: Form as unknown as React.ComponentType<Record<string, unknown>>,
  code: CustomCode as unknown as React.ComponentType<Record<string, unknown>>,
  link_list: LinkList as unknown as React.ComponentType<Record<string, unknown>>,
  copyright: Copyright as unknown as React.ComponentType<Record<string, unknown>>,
};

/**
 * Recursively replace `{ slot: 'key' }` refs in props with the resolved
 * image URL. Walks objects + arrays so nested fields (e.g. card.imageRef)
 * are resolved too.
 *
 * If a slot has no matching image, returns `undefined` (NOT empty string)
 * so downstream cleanup (see `sanitizeSectionBackground`) can detect the
 * miss and strip any dangling `bgType: 'image'` that would otherwise
 * render a black section with no image.
 */
function resolveSlots(value: unknown, images: Record<string, SiteImage>): unknown {
  if (value == null) return value;
  if (typeof value !== 'object') return value;
  if (isSlotRef(value)) {
    const img = images[value.slot];
    if (!img) {
      console.warn(
        `[siteDesign] slot "${value.slot}" has no matching site_images row — field will be dropped. ` +
          `Fix: either generate+assign an image to this slot, or replace the { slot } ref with a direct https URL.`,
      );
      return undefined;
    }
    return img.url;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveSlots(v, images));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const resolved = resolveSlots(v, images);
    if (resolved !== undefined) out[k] = resolved;
  }
  return out;
}

/**
 * Post-resolution safety net for section props. If a section declared
 * `bgType: 'image'` (or `'video'`) but its `backgroundImage` / `backgroundVideo`
 * failed to resolve (unknown slot, empty string, etc.), demote `bgType` so
 * the section falls back to its solid `background` color instead of
 * rendering as a black void. Same fix is applied for exports via serialize.ts.
 */
function sanitizeSectionBackground(props: Record<string, unknown>): Record<string, unknown> {
  const out = { ...props };
  const hasImage = typeof out.backgroundImage === 'string' && out.backgroundImage.length > 0;
  const hasVideo = typeof out.backgroundVideo === 'string' && out.backgroundVideo.length > 0;
  if (out.bgType === 'image' && !hasImage) {
    console.warn('[siteDesign] section had bgType:"image" but no resolvable backgroundImage — falling back to color');
    delete out.bgType;
  }
  if (out.bgType === 'video' && !hasVideo) {
    console.warn('[siteDesign] section had bgType:"video" but no resolvable backgroundVideo — falling back to color');
    delete out.bgType;
  }
  // Also strip empty strings so serialize's truthy checks behave.
  if (out.backgroundImage === '') delete out.backgroundImage;
  if (out.backgroundVideo === '') delete out.backgroundVideo;
  return out;
}

function renderBlock(
  block: DesignBlock,
  images: Record<string, SiteImage>,
  index: number,
): ReactElement | null {
  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) {
    console.warn(`[siteDesign] unknown block type "${block.type}" — skipped`);
    return null;
  }
  const resolved = resolveSlots(block.props, images) as Record<string, unknown>;
  return createElement(Component, { key: `b-${index}`, ...resolved });
}

function renderSection(
  section: DesignSection,
  images: Record<string, SiteImage>,
  index: number,
): ReactElement | null {
  if (section.kind === 'raw') {
    return createElement(RawSection, {
      key: `s-${index}`,
      type: section.type,
      name: section.name,
      settings: section.settings,
      blocks: section.blocks,
      blockOrder: section.blockOrder,
      hidden: section.hidden,
    });
  }

  const SectionComponent =
    section.kind === 'header'
      ? HeaderSection
      : section.kind === 'footer'
        ? FooterSection
        : ContentSection;

  const resolvedProps = sanitizeSectionBackground(
    resolveSlots(section.props, images) as Record<string, unknown>,
  );
  const children = section.blocks
    .map((b, i) => renderBlock(b, images, i))
    .filter((c): c is ReactElement => c !== null);

  return createElement(
    SectionComponent as unknown as React.ComponentType<Record<string, unknown>>,
    { key: `s-${index}`, name: section.name, ...resolvedProps },
    ...children,
  );
}

/**
 * Render one page from a SiteDesign as a React tree.
 * Returns a Fragment with header + content sections + footer in order.
 */
export function renderDesignPage(
  page: DesignPage,
  images: Record<string, SiteImage>,
): ReactNode {
  const elements = page.sections
    .map((s, i) => renderSection(s, images, i))
    .filter((e): e is ReactElement => e !== null);
  return createElement(Fragment, null, ...elements);
}

/**
 * Render a single page from a full SiteDesign by key.
 */
export function renderDesign(
  design: SiteDesign,
  pageKey: string,
  images: Record<string, SiteImage>,
): ReactNode {
  const page = design.pages[pageKey];
  if (!page) {
    console.warn(`[siteDesign] design has no page "${pageKey}"`);
    return null;
  }
  return renderDesignPage(page, images);
}

/**
 * Build the `PageTrees` map (for the existing exporter) from a SiteDesign.
 * Each entry is a React tree the existing `exportFromTree` can consume.
 */
export function designToPageTrees(
  design: SiteDesign,
  images: Record<string, SiteImage>,
): PageTrees {
  const trees: PageTrees = {};
  for (const key of design.pageKeys) {
    const page = design.pages[key];
    if (!page) continue;
    trees[key] = renderDesignPage(page, images);
  }
  return trees;
}
