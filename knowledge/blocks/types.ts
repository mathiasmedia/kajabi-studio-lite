/**
 * Component Library — Base Types
 *
 * Defines the contracts for the new declarative Section/Block system.
 * Each Block component renders React in the preview AND has a static
 * `serialize()` method that emits a Kajabi-compatible JSON shape.
 *
 * The tree walker reads JSX children of <Section> components, calls
 * each block's serialize(), and assembles the final settings_data.json.
 */

// ---- Kajabi JSON shapes ----

export interface KajabiBlock {
  type: string;
  settings: Record<string, unknown>;
}

export interface KajabiSection {
  type: string; // 'header' | 'footer' | 'section'
  /** Display name shown in the Kajabi editor sidebar */
  name?: string;
  /** "true" | "false" — section visibility flag */
  hidden?: string;
  settings: Record<string, unknown>;
  blocks: Record<string, KajabiBlock>;
  block_order: string[];
}

// ---- Section flavor ----

export type SectionFlavor = 'header' | 'content' | 'footer';

/**
 * Maps a SectionFlavor to the Kajabi `type` field on the section.
 * - header → 'header'
 * - content → 'section'
 * - footer → 'footer'
 */
export const SECTION_FLAVOR_TO_KAJABI_TYPE: Record<SectionFlavor, string> = {
  header: 'header',
  content: 'section',
  footer: 'footer',
};

// ---- Block component contract ----

/**
 * Every Block component (functional React) must have a static `kajabiType`
 * and a static `serialize(props)` method.
 *
 * Why static: lets the tree walker introspect the component constructor
 * without needing to instantiate React elements.
 */
export interface BlockComponent<P = Record<string, unknown>> {
  (props: P): JSX.Element | null;
  /** The Kajabi block.type string this component emits */
  kajabiType: string;
  /** Which section flavors this block is allowed in */
  allowedIn: SectionFlavor[];
  /** Convert React props → Kajabi block.settings JSON */
  serialize: (props: P) => Record<string, unknown>;
}

// ---- Shared layout props (Section wrapper props) ----

export interface PaddingObject {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * Layout/background fields shared by all 3 section flavors.
 * Source: streamlined-home/sections/section.liquid {% schema %} groups
 * "Background" + "Desktop layout" + "Mobile layout".
 */
export interface CommonSectionProps {
  /** hex color → settings.background_color */
  background?: string;
  /** url → settings.bg_image (forces bg_type="image") */
  backgroundImage?: string;
  /** url → settings.bg_video (forces bg_type="video") */
  backgroundVideo?: string;
  /** Override bg_type explicitly. Auto-set from backgroundImage/backgroundVideo if omitted. */
  bgType?: 'none' | 'color' | 'image' | 'video';
  /** Position keyword for bg image/video → settings.bg_position */
  bgPosition?: 'top' | 'center' | 'bottom' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
  /** Parallax-style fixed background → settings.background_fixed */
  backgroundFixed?: boolean;
  /** hex color → settings.text_color */
  textColor?: string;
  /** Constrain inner content width. Number = px. */
  maxWidth?: number | string;
  paddingDesktop?: PaddingObject;
  paddingMobile?: PaddingObject;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  /** Stable id used for content_for_index ordering. Auto-generated if omitted. */
  id?: string;
  /**
   * Display name shown in Kajabi's editor sidebar (e.g. "Hero", "Community", "FAQ").
   * Falls back to "Header" / "Footer" / "Section" when omitted.
   */
  name?: string;

  // ---- Pro-only (silently dropped on Standard themes) ----
  /**
   * Pro-only — space-separated CSS class names attached to the section's
   * outer element. Combine with `TemplateDef.customCss` to scope bespoke
   * styling without forking the base theme. Verified: Pro
   * `sections/section.liquid` reads `section.settings.custom_css_class`.
   */
  customCssClass?: string;
}

/**
 * Content section (`<ContentSection>`) — extends Common with the layout
 * fields that only appear on `sections/section.liquid`.
 */
export interface ContentSectionProps extends CommonSectionProps {
  /** Vertical alignment of blocks → settings.vertical */
  vertical?: 'top' | 'center' | 'bottom';
  /** Horizontal alignment of blocks → settings.horizontal */
  horizontal?: 'left' | 'center' | 'right';
  /** Force all blocks to equal height → settings.equal_height */
  equalHeight?: boolean;
  /** Stretch section to viewport edges → settings.full_width */
  fullWidth?: boolean;
  /** Stretch section to viewport height → settings.full_height */
  fullHeight?: boolean;

  // ---- Pro-only slider (silently dropped on Standard themes) ----
  /** Pro-only — turns the section's blocks into a Swiper carousel. */
  enableSlider?: boolean;
  slidesPerViewDesktop?: number | string;
  slidesPerViewMobile?: number | string;
  sliderAutoplay?: boolean;
  sliderAutoplayDelay?: number | string;
  sliderSpeed?: number | string;
  sliderLoop?: boolean;
  sliderTransition?: 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip';
  /** Keep N leading blocks OUTSIDE the slider but inside the section. */
  blockOffsetBefore?: number | string;
  /** Keep N trailing blocks OUTSIDE the slider but inside the section. */
  blockOffsetAfter?: number | string;
  /** Show carousel nav arrows → settings.show_arrows (Pro default true). */
  showArrows?: boolean;
  /** Arrow stroke color → settings.arrow_color. */
  arrowColor?: string;
  /** Px gap pushing arrows away from slider edge → settings.arrow_slider_margin. */
  arrowSliderMargin?: number | string;
  /** Show pagination dots → settings.show_dots (Pro default true). */
  showDots?: boolean;
  /** Pagination dot color → settings.dot_color. */
  dotColor?: string;
  /**
   * Slider layout preset → settings.slider_preset.
   * - "default" (Classic): centered dots & arrows, classic Swiper layout.
   * - "modern" (Kajabi default): dots bottom-left, arrows bottom-right, on one line below the slider.
   * This is the ONLY field that controls dot/arrow alignment in Kajabi — there
   * are no separate `dot_align` / `arrow_align` fields in section.liquid.
   */
  sliderPreset?: 'default' | 'modern';
  /** Px gap between slides (desktop) → settings.space_between_slide_blocks. Pro default 0. */
  spaceBetweenDesktop?: number | string;
  /** Px gap between slides (mobile) → settings.space_between_slide_blocks_mobile. Pro default 0. */
  spaceBetweenMobile?: number | string;

  // ---- Pro-only multi-column layout (silently dropped on Standard themes) ----
  /**
   * Pro-only — split section into 2 or 3 desktop columns.
   * Maps to `multiple_columns_on_desktop`: 1 → "no", 2 → "two", 3 → "three".
   * Mobile collapses 1 → 2 → 3 automatically (Kajabi runtime behavior).
   * Per-block `column: 1|2|3` assigns each block to its column (default 1).
   * Verified against Pro `sections/section.liquid`.
   */
  columns?: 1 | 2 | 3;
  /**
   * Per-column widths in `fr` units, one entry per column. Defaults to "4,4" / "4,4,4".
   * Examples: [6,6] for even split, [4,8] for sidebar layouts, [3,9] for narrow sidebar.
   * Maps to `column_one_width` / `column_two_width` / `column_three_width`.
   */
  columnWidths?: number[];
  /** Px gap between columns (0–150) → settings.multiple_column_gap. */
  columnGap?: number | string;
  /**
   * Which column hosts the slider when `enableSlider` AND `columns >= 2` are both set.
   * 1 → "first", 2 → "second", 3 → "third". Default 1.
   */
  sliderColumn?: 1 | 2 | 3;

  // ---- Pro-only Tabs (silently dropped on Standard themes) ----
  /**
   * Pro-only — mark this section as a tab pane. Pair with a `<Tabs>` (`code_tabs`)
   * block in a section ABOVE that defines the tab buttons. Each tab pane section
   * needs a unique `tabSlug`; exactly ONE pane should set `defaultTab: true`.
   * Verified field IDs: `use_as_tab`, `tab_slug`, `default_tab`, `tab_fade_effect`
   * in Pro `sections/section.liquid`.
   */
  useAsTab?: boolean;
  /** Lowercase identifier — must match a slug in the controlling Tabs block. */
  tabSlug?: string;
  /** True for the pane shown on initial page load. Set on exactly one pane. */
  defaultTab?: boolean;
  /** Whether to fade between panes (default true in Kajabi). */
  tabFadeEffect?: boolean;
}

/**
 * Header section — extends Common with header-only fields from
 * `sections/header.liquid`.
 */
export interface HeaderSectionProps extends CommonSectionProps {
  /** "static" | "overlay" first section → settings.position */
  position?: 'static' | 'overlay';
  /** Sticky-on-scroll behavior → settings.sticky */
  sticky?: boolean;
  /** Sticky text color (only used when sticky=true) → settings.sticky_text_color */
  stickyTextColor?: string;
  /** Sticky background color (only used when sticky=true) → settings.sticky_background_color */
  stickyBackgroundColor?: string;
  /** Show shopping cart icon → settings.cart */
  cart?: boolean;
  /** Desktop horizontal alignment → settings.horizontal (between/around/left/center/right) */
  horizontalAlignment?: 'left' | 'center' | 'right' | 'between' | 'around';
  /** Desktop font size keyword (e.g. "16px") → settings.font_size_desktop */
  fontSizeDesktop?: string;
  /** Mobile font size keyword → settings.font_size_mobile */
  fontSizeMobile?: string;
  /** Mobile-only: header text color override → settings.mobile_header_text_color */
  mobileHeaderTextColor?: string;
  /** Mobile-only: header background override → settings.mobile_header_background_color */
  mobileHeaderBackgroundColor?: string;
  /** Mobile-only: hamburger icon color → settings.hamburger_color */
  hamburgerColor?: string;
  /** Mobile-only: sticky hamburger color → settings.sticky_hamburger_color */
  stickyHamburgerColor?: string;
  /** Mobile-only: close menu on scroll → settings.close_on_scroll */
  closeOnScroll?: boolean;
  /** Mobile menu text alignment → settings.mobile_menu_text_alignment */
  mobileMenuTextAlignment?: 'left' | 'center' | 'right';

  /**
   * Pro-only — Full-Time Hamburger: forces the mobile slide-in panel to
   * also show on desktop. Composes with sticky/overlay.
   */
  collapsed?: boolean;
}

/**
 * Footer section — extends Common with footer-only fields from
 * `sections/footer.liquid`.
 */
export interface FooterSectionProps extends CommonSectionProps {
  /** Stacked instead of horizontal layout → settings.vertical_layout */
  verticalLayout?: boolean;
  /** Copyright row text color → settings.copyright_text_color */
  copyrightTextColor?: string;
  /** "Powered by Kajabi" text color → settings.powered_by_text_color */
  poweredByTextColor?: string;
  /** Desktop font size keyword → settings.font_size_desktop */
  fontSizeDesktop?: string;
  /** Mobile font size keyword → settings.font_size_mobile */
  fontSizeMobile?: string;
}

/**
 * Backwards-compatible union — used by serialize.ts where flavor isn't known yet.
 * Most code should prefer the flavor-specific interfaces above.
 */
export type SectionLayoutProps =
  & CommonSectionProps
  & Partial<ContentSectionProps>
  & Partial<HeaderSectionProps>
  & Partial<FooterSectionProps>;
