/**
 * Tree walker — converts a JSX <Section> tree into Kajabi settings_data.json.
 */
import { Children, Fragment, isValidElement, type ReactNode, type ReactElement } from 'react';
import type {
  KajabiBlock,
  KajabiSection,
  BlockComponent,
  SectionFlavor,
  SectionLayoutProps,
  PaddingObject,
} from './types';
import { SECTION_FLAVOR_TO_KAJABI_TYPE } from './types';

let idCounter = 0;
let idSeed = 0;

function nextNumericId(): string {
  idCounter += 1;
  return String(idSeed + idCounter);
}

function nextBlockId(): string {
  return nextNumericId();
}

function nextSectionId(): string {
  return nextNumericId();
}

export interface SectionBackgroundOverride {
  url: string;
  position: string;
  fixed: boolean;
}
let externalBgOverrides = new Map<string, SectionBackgroundOverride>();

let activeBaseTheme: string | undefined;
function isProTheme(): boolean {
  return !!activeBaseTheme && activeBaseTheme.endsWith('-pro');
}

function isExternalImageUrl(url: string): boolean {
  if (!url) return false;
  if (/^\d+$/.test(url)) return false;
  if (url.startsWith('assets/')) return false;
  if (/^https?:\/\/[^/]*kajabi(-cdn)?\.com\//i.test(url)) return false;
  return /^(https?:|data:|blob:)/i.test(url);
}

export interface SectionComponent {
  (props: { children?: ReactNode } & SectionLayoutProps): JSX.Element | null;
  __kajabiSectionFlavor: SectionFlavor;
  __allowedBlockTypes: Set<string>;
}

function paddingToKajabi(p?: PaddingObject): Record<string, string> | undefined {
  if (!p) return undefined;
  return {
    top: p.top ?? '',
    right: p.right ?? '',
    bottom: p.bottom ?? '',
    left: p.left ?? '',
  };
}

const SECTION_DEFAULTS: Record<string, unknown> = {
  bg_type: 'none',
  bg_image: '',
  bg_video: '',
  bg_position: 'center',
  background_color: '',
  background_fixed: 'false',
  vertical: 'center',
  horizontal: 'center',
  full_width: 'false',
  full_height: 'false',
  equal_height: 'false',
  hide_on_mobile: 'false',
  hide_on_desktop: 'false',
  padding_desktop: { top: '', right: '', bottom: '', left: '' },
  padding_mobile: { top: '', right: '', bottom: '', left: '' },
};

function buildSectionSettings(layout: SectionLayoutProps, flavor: SectionFlavor): Record<string, unknown> {
  const settings: Record<string, unknown> = { ...SECTION_DEFAULTS };

  const hasImgUrl = typeof layout.backgroundImage === 'string' && layout.backgroundImage.length > 0;
  const hasVidUrl = typeof layout.backgroundVideo === 'string' && layout.backgroundVideo.length > 0;
  let effectiveBgType = layout.bgType;
  if (effectiveBgType === 'image' && !hasImgUrl) {
    console.warn('[serialize] bgType="image" with no backgroundImage — demoting to color');
    effectiveBgType = undefined;
  }
  if (effectiveBgType === 'video' && !hasVidUrl) {
    console.warn('[serialize] bgType="video" with no backgroundVideo — demoting to color');
    effectiveBgType = undefined;
  }
  if (effectiveBgType) {
    settings.bg_type = effectiveBgType;
  } else if (hasVidUrl) {
    settings.bg_type = 'video';
  } else if (hasImgUrl) {
    settings.bg_type = 'image';
  } else if (layout.background) {
    settings.bg_type = 'color';
  }
  if (layout.backgroundImage) {
    settings.bg_image = layout.backgroundImage;
  }
  if (layout.backgroundVideo) settings.bg_video = layout.backgroundVideo;
  if (layout.bgPosition) settings.bg_position = layout.bgPosition;
  if (layout.backgroundFixed) settings.background_fixed = 'true';
  if (layout.background) settings.background_color = layout.background;
  if (layout.textColor) settings.text_color = layout.textColor;

  if (layout.maxWidth != null) settings.max_width = String(layout.maxWidth);
  if (layout.hideOnMobile) settings.hide_on_mobile = 'true';
  if (layout.hideOnDesktop) settings.hide_on_desktop = 'true';

  const pd = paddingToKajabi(layout.paddingDesktop);
  const pm = paddingToKajabi(layout.paddingMobile);
  if (pd) settings.padding_desktop = pd;
  if (pm) settings.padding_mobile = pm;

  if (flavor === 'content') {
    if (layout.vertical) settings.vertical = layout.vertical;
    if (layout.horizontal) settings.horizontal = layout.horizontal;
    if (layout.equalHeight) settings.equal_height = 'true';
    if (layout.fullWidth) settings.full_width = 'true';
    if (layout.fullHeight) settings.full_height = 'true';

    if (isProTheme()) {
      if (layout.enableSlider) {
        settings.enable_slider = 'true';
        if (layout.slidesPerViewDesktop != null) settings.blocks_per_slide = String(layout.slidesPerViewDesktop);
        if (layout.sliderAutoplay) settings.autoplay = 'true';
        if (layout.sliderAutoplayDelay != null) settings.autoplay_delay = String(layout.sliderAutoplayDelay);
        if (layout.sliderSpeed != null) settings.transition_speed = String(layout.sliderSpeed);
        if (layout.sliderLoop) settings.loop = 'true';
        if (layout.sliderTransition) settings.transition_effect = layout.sliderTransition;
        if (layout.blockOffsetBefore != null) settings.block_offset = String(layout.blockOffsetBefore);
        if (layout.blockOffsetAfter != null) settings.block_end_offset = String(layout.blockOffsetAfter);
        if (layout.showArrows === false) settings.show_arrows = 'false';
        else if (layout.showArrows === true) settings.show_arrows = 'true';
        if (layout.arrowColor) settings.arrow_color = layout.arrowColor;
        if (layout.arrowSliderMargin != null) settings.arrow_slider_margin = String(layout.arrowSliderMargin);
        if (layout.showDots === false) settings.show_dots = 'false';
        else if (layout.showDots === true) settings.show_dots = 'true';
        if (layout.dotColor) settings.dot_color = layout.dotColor;
        if (layout.sliderPreset) settings.slider_preset = layout.sliderPreset;
      }
    }
  }

  if (isProTheme()) {
    if (layout.customCssClass) settings.custom_css_class = layout.customCssClass;
  }

  if (flavor === 'header') {
    delete settings.bg_type;
    delete settings.bg_image;
    delete settings.bg_video;
    delete settings.bg_position;
    delete settings.background_fixed;
    delete settings.vertical;
    delete settings.horizontal;
    delete settings.full_width;
    delete settings.full_height;
    delete settings.equal_height;

    if (layout.position) settings.position = layout.position;
    if (layout.sticky) settings.sticky = 'true';
    if (layout.stickyTextColor) settings.sticky_text_color = layout.stickyTextColor;
    if (layout.stickyBackgroundColor) settings.sticky_background_color = layout.stickyBackgroundColor;
    if (layout.cart) settings.cart = 'true';
    if (layout.horizontalAlignment) settings.horizontal = layout.horizontalAlignment;
    if (layout.fontSizeDesktop) settings.font_size_desktop = layout.fontSizeDesktop;
    if (layout.fontSizeMobile) settings.font_size_mobile = layout.fontSizeMobile;
    if (layout.mobileHeaderTextColor) settings.mobile_header_text_color = layout.mobileHeaderTextColor;
    if (layout.mobileHeaderBackgroundColor) settings.mobile_header_background_color = layout.mobileHeaderBackgroundColor;
    if (layout.hamburgerColor) settings.hamburger_color = layout.hamburgerColor;
    if (layout.stickyHamburgerColor) settings.sticky_hamburger_color = layout.stickyHamburgerColor;
    if (layout.closeOnScroll != null) settings.close_on_scroll = layout.closeOnScroll ? 'true' : 'false';
    if (layout.mobileMenuTextAlignment) settings.mobile_menu_text_alignment = layout.mobileMenuTextAlignment;

    if (isProTheme()) {
      if (layout.collapsed) settings.collapsed = 'true';
    }
  }

  if (flavor === 'footer') {
    delete settings.bg_type;
    delete settings.bg_image;
    delete settings.bg_video;
    delete settings.bg_position;
    delete settings.background_fixed;
    delete settings.vertical;
    delete settings.horizontal;
    delete settings.full_width;
    delete settings.full_height;
    delete settings.equal_height;

    if (layout.verticalLayout) settings.vertical_layout = 'true';
    if (layout.copyrightTextColor) settings.copyright_text_color = layout.copyrightTextColor;
    if (layout.poweredByTextColor) settings.powered_by_text_color = layout.poweredByTextColor;
    if (layout.fontSizeDesktop) settings.font_size_desktop = layout.fontSizeDesktop;
    if (layout.fontSizeMobile) settings.font_size_mobile = layout.fontSizeMobile;
  }

  return settings;
}

const CONTENT_GRID_ONLY_FIELDS = [
  'width', 'text_align', 'box_shadow', 'animation_type', 'animation_direction',
  'delay', 'duration', 'hide_on_desktop', 'hide_on_mobile', 'make_block',
] as const;

function stripContentGridFields(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if ((CONTENT_GRID_ONLY_FIELDS as readonly string[]).includes(k)) continue;
    out[k] = v;
  }
  return out;
}

interface SerializedSection {
  id: string;
  flavor: SectionFlavor;
  section: KajabiSection;
}

function isSectionComponent(type: unknown): type is SectionComponent {
  return (
    typeof type === 'function' &&
    '__kajabiSectionFlavor' in (type as object)
  );
}

interface RawSectionLike {
  __rawKajabiSection: true;
}
function isRawSectionComponent(type: unknown): type is RawSectionLike {
  return (
    typeof type === 'function' &&
    '__rawKajabiSection' in (type as object) &&
    (type as unknown as RawSectionLike).__rawKajabiSection === true
  );
}

function isBlockComponent(type: unknown): type is BlockComponent {
  return (
    typeof type === 'function' &&
    'kajabiType' in (type as object) &&
    'serialize' in (type as object)
  );
}

interface RawSectionProps {
  type: string;
  name?: string;
  settings?: Record<string, unknown>;
  blocks?: Record<string, KajabiBlock>;
  blockOrder?: string[];
  hidden?: 'true' | 'false';
}

function walkRawSection(el: ReactElement): SerializedSection {
  const props = (el.props ?? {}) as RawSectionProps;
  const blocks = props.blocks ?? {};
  const blockOrder = props.blockOrder ?? Object.keys(blocks);
  return {
    id: nextSectionId(),
    flavor: 'content',
    section: {
      type: props.type,
      name: props.name ?? props.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      hidden: props.hidden ?? 'false',
      settings: { ...(props.settings ?? {}) },
      blocks,
      block_order: blockOrder,
    },
  };
}

function walkSection(el: ReactElement): SerializedSection {
  const SectionType = el.type as SectionComponent;
  const flavor = SectionType.__kajabiSectionFlavor;
  const allowed = SectionType.__allowedBlockTypes;
  const props = (el.props || {}) as { children?: ReactNode } & SectionLayoutProps;

  const sectionSettings = buildSectionSettings(props, flavor);
  const blocks: Record<string, KajabiBlock> = {};
  const blockOrder: string[] = [];

  function collectBlocks(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const ChildType = child.type;

      if (isBlockComponent(ChildType)) {
        if (!allowed.has(ChildType.kajabiType)) {
          console.warn(
            `[serialize] Block type "${ChildType.kajabiType}" is not allowed in <${flavor}Section>. Skipping.`
          );
          return;
        }
        let blockSettings = ChildType.serialize(child.props as Record<string, unknown>);
        if (flavor === 'header' || flavor === 'footer') {
          blockSettings = stripContentGridFields(blockSettings);
        }
        const blockId = nextBlockId();
        blocks[blockId] = {
          type: ChildType.kajabiType,
          settings: blockSettings,
        };
        blockOrder.push(blockId);
        return;
      }

      const childProps = (child.props ?? {}) as { children?: ReactNode };
      if (childProps.children != null) {
        collectBlocks(childProps.children);
      }
    });
  }
  collectBlocks(props.children);

  const id =
    flavor === 'header' ? 'header' :
    flavor === 'footer' ? 'footer' :
    nextSectionId();

  return {
    id,
    flavor,
    section: {
      type: SECTION_FLAVOR_TO_KAJABI_TYPE[flavor],
      name: props.name ?? (flavor === 'header' ? 'Header' : flavor === 'footer' ? 'Footer' : 'Section'),
      hidden: 'false',
      settings: sectionSettings,
      blocks,
      block_order: blockOrder,
    },
  };
}

export interface SerializeTreeResult {
  settingsData: Record<string, unknown>;
  externalBackgrounds: Map<string, SectionBackgroundOverride>;
}

export type PageTrees = Record<string, ReactNode>;

export const SYSTEM_TEMPLATES = [
  'index', 'about', 'page', 'contact', 'blog', 'blog_post', 'thank_you', '404',
  'library', 'store', 'login', 'member_directory', 'announcements',
  'newsletter', 'newsletter_post', 'newsletter_subscribe', 'blog_search',
  'forgot_password', 'forgot_password_edit', 'sales_page',
] as const;
export type SystemTemplate = typeof SYSTEM_TEMPLATES[number];

export const SUPPORTED_TEMPLATES = SYSTEM_TEMPLATES;
export type SupportedTemplate = SystemTemplate;

const VALID_TEMPLATE_NAME = /^[a-z0-9_-]{1,48}$/;

function contentForKey(template: string): string {
  return `content_for_${template}`;
}

function isPageTreesMap(input: ReactNode | PageTrees): input is PageTrees {
  if (input == null) return false;
  if (typeof input !== 'object') return false;
  if (Array.isArray(input)) return false;
  if (isValidElement(input as object)) return false;
  const keys = Object.keys(input as Record<string, unknown>);
  if (keys.length === 0) return false;
  return true;
}

export interface SerializeTreeOptions {
  baseTheme?: string;
}

export function serializeTree(
  input: ReactNode | PageTrees,
  options: SerializeTreeOptions = {},
): SerializeTreeResult {
  idCounter = 0;
  idSeed = Date.now();
  externalBgOverrides = new Map();
  activeBaseTheme = options.baseTheme;

  const sections: Record<string, KajabiSection> = {};
  const contentForByTemplate: Record<string, string[]> = {};
  let headerSeenIn: string | null = null;
  let footerSeenIn: string | null = null;

  function visit(node: ReactNode, contentOrder: string[], templateName: string) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        visit((child.props as { children?: ReactNode }).children, contentOrder, templateName);
        return;
      }
      if (isRawSectionComponent(child.type)) {
        const ser = walkRawSection(child);
        sections[ser.id] = ser.section;
        contentOrder.push(ser.id);
        return;
      }
      if (isSectionComponent(child.type)) {
        const ser = walkSection(child);
        if (ser.flavor === 'header') {
          if (headerSeenIn && headerSeenIn !== templateName) {
            console.warn(
              `[serialize] HeaderSection found in template "${templateName}" but already defined by "${headerSeenIn}". Last one wins (header is shared site-wide).`,
            );
          }
          headerSeenIn = templateName;
        } else if (ser.flavor === 'footer') {
          if (footerSeenIn && footerSeenIn !== templateName) {
            console.warn(
              `[serialize] FooterSection found in template "${templateName}" but already defined by "${footerSeenIn}". Last one wins (footer is shared site-wide).`,
            );
          }
          footerSeenIn = templateName;
        }
        sections[ser.id] = ser.section;
        if (ser.flavor === 'content') {
          contentOrder.push(ser.id);
        }
        return;
      }
      if (typeof child.type === 'function') {
        try {
          const Comp = child.type as (p: unknown) => ReactNode;
          const rendered = Comp(child.props ?? {});
          visit(rendered, contentOrder, templateName);
          return;
        } catch (err) {
          console.warn('[serialize] Failed to render wrapper component:', child.type, err);
          return;
        }
      }
      console.warn('[serialize] Top-level child is not a Section component:', child.type);
    });
  }

  const trees: PageTrees = isPageTreesMap(input)
    ? (input as PageTrees)
    : { index: input as ReactNode };

  const NON_COMPOSABLE_TEMPLATES = new Set([
    'forgot_password', 'forgot_password_edit', 'sales_page',
  ]);

  for (const [templateName, tree] of Object.entries(trees)) {
    if (!VALID_TEMPLATE_NAME.test(templateName) && templateName !== '404') {
      console.warn(
        `[serialize] Invalid template name "${templateName}" — must match ${VALID_TEMPLATE_NAME}. Skipping.`,
      );
      continue;
    }
    if (NON_COMPOSABLE_TEMPLATES.has(templateName)) {
      console.warn(
        `[serialize] Skipping "${templateName}" — Kajabi auth/checkout templates can't be composed; their built-in Liquid is preserved.`,
      );
      continue;
    }
    const contentOrder: string[] = [];
    visit(tree, contentOrder, templateName);
    contentForByTemplate[contentForKey(templateName)] = contentOrder;
  }

  if (!contentForByTemplate['content_for_index']) {
    contentForByTemplate['content_for_index'] = [];
  }

  return {
    settingsData: {
      current: {
        sections,
        ...contentForByTemplate,
      },
    },
    externalBackgrounds: externalBgOverrides,
  };
}
