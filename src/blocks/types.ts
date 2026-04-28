// (synced from master)
export interface KajabiBlock {
  type: string;
  settings: Record<string, unknown>;
}

export interface KajabiSection {
  type: string;
  name?: string;
  hidden?: string;
  settings: Record<string, unknown>;
  blocks: Record<string, KajabiBlock>;
  block_order: string[];
}

export type SectionFlavor = 'header' | 'content' | 'footer';

export const SECTION_FLAVOR_TO_KAJABI_TYPE: Record<SectionFlavor, string> = {
  header: 'header',
  content: 'section',
  footer: 'footer',
};

export interface BlockComponent<P = Record<string, unknown>> {
  (props: P): JSX.Element | null;
  kajabiType: string;
  allowedIn: SectionFlavor[];
  serialize: (props: P) => Record<string, unknown>;
}

export interface PaddingObject {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export interface CommonSectionProps {
  background?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  bgType?: 'none' | 'color' | 'image' | 'video';
  bgPosition?: 'top' | 'center' | 'bottom' | 'top left' | 'top right' | 'bottom left' | 'bottom right';
  backgroundFixed?: boolean;
  textColor?: string;
  maxWidth?: number | string;
  paddingDesktop?: PaddingObject;
  paddingMobile?: PaddingObject;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
  id?: string;
  name?: string;
  customCssClass?: string;
}

export interface ContentSectionProps extends CommonSectionProps {
  vertical?: 'top' | 'center' | 'bottom';
  horizontal?: 'left' | 'center' | 'right';
  equalHeight?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  enableSlider?: boolean;
  slidesPerViewDesktop?: number | string;
  slidesPerViewMobile?: number | string;
  sliderAutoplay?: boolean;
  sliderAutoplayDelay?: number | string;
  sliderSpeed?: number | string;
  sliderLoop?: boolean;
  sliderTransition?: 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip';
  blockOffsetBefore?: number | string;
  blockOffsetAfter?: number | string;
  showArrows?: boolean;
  arrowColor?: string;
  arrowSliderMargin?: number | string;
  showDots?: boolean;
  dotColor?: string;
  sliderPreset?: 'default' | 'modern';
  spaceBetweenDesktop?: number | string;
  spaceBetweenMobile?: number | string;
  columns?: 1 | 2 | 3;
  columnWidths?: number[];
  columnGap?: number | string;
  sliderColumn?: 1 | 2 | 3;
}

export interface HeaderSectionProps extends CommonSectionProps {
  position?: 'static' | 'overlay';
  sticky?: boolean;
  stickyTextColor?: string;
  stickyBackgroundColor?: string;
  cart?: boolean;
  horizontalAlignment?: 'left' | 'center' | 'right' | 'between' | 'around';
  fontSizeDesktop?: string;
  fontSizeMobile?: string;
  mobileHeaderTextColor?: string;
  mobileHeaderBackgroundColor?: string;
  hamburgerColor?: string;
  stickyHamburgerColor?: string;
  closeOnScroll?: boolean;
  mobileMenuTextAlignment?: 'left' | 'center' | 'right';
  collapsed?: boolean;
}

export interface FooterSectionProps extends CommonSectionProps {
  verticalLayout?: boolean;
  copyrightTextColor?: string;
  poweredByTextColor?: string;
  fontSizeDesktop?: string;
  fontSizeMobile?: string;
}

export type SectionLayoutProps =
  & CommonSectionProps
  & Partial<ContentSectionProps>
  & Partial<HeaderSectionProps>
  & Partial<FooterSectionProps>;
