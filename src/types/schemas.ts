// ===== AI Kajabi Homepage Builder — V1 Core Schemas =====

// ---------- Section Archetypes ----------
export const SECTION_ARCHETYPES = [
  'header', 'hero', 'stats_row', 'icon_card_row', 'feature_cards',
  'content_media_split', 'testimonials', 'cta_band', 'footer',
] as const;

export type SectionArchetype = typeof SECTION_ARCHETYPES[number];

// ---------- Feasibility ----------
export type FeasibilityLevel =
  | 'exactly_reproducible'
  | 'approximately_reproducible'
  | 'requires_theme_fallback'
  | 'unsupported_in_v1';

// ---------- Section Stage ----------
export type SectionStage =
  | 'detected'
  | 'confirmed'
  | 'planned'
  | 'generated'
  | 'critiqued'
  | 'refined'
  | 'locked';

// ---------- Recipe IDs ----------
export const RECIPE_MAP: Record<SectionArchetype, string> = {
  header: 'streamlined-home.header.marketing.v1',
  hero: 'streamlined-home.hero.rich.v1',
  stats_row: 'streamlined-home.stats.cards.v1',
  icon_card_row: 'streamlined-home.icon-cards.feature-row.v1',
  feature_cards: 'streamlined-home.program-cards.feature.v2',
  content_media_split: 'streamlined-home.split.text-image.v1',
  testimonials: 'streamlined-home.testimonials.cards.v2',
  cta_band: 'streamlined-home.cta.unified-panel.v2',
  footer: 'streamlined-home.footer.marketing-rich.v1',
};

// ---------- VisualPlanV1 ----------
export type SectionOrigin = 'ai-detected' | 'user-created';

export interface SectionModel {
  id: string;
  archetype: SectionArchetype;
  label: string;
  description: string;
  confidence: number; // 0-1
  feasibility: FeasibilityLevel;
  stage: SectionStage;
  locked: boolean;
  evidence: string[];
  styleHints: Record<string, string>;
  origin: SectionOrigin;
}

export interface VisualPlanV1 {
  pageTone: string;
  styleKeywords: string[];
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  typographyDirection: string;
  headingFont?: string;
  bodyFont?: string;
  spacingDensity: 'tight' | 'normal' | 'spacious';
  header: SectionModel;
  hero: SectionModel;
  sections: SectionModel[];
  footer?: SectionModel;
  layoutConfidence: number;
  evidence: string[];
}

// ---------- Firecrawl Branding ----------
export interface FirecrawlBranding {
  colorScheme?: string;
  logo?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textPrimary?: string;
    textSecondary?: string;
  };
  fonts?: Array<{ family: string }>;
  typography?: {
    fontFamilies?: { primary?: string; heading?: string; code?: string };
    fontSizes?: Record<string, string>;
    fontWeights?: Record<string, number>;
  };
  spacing?: { baseUnit?: number; borderRadius?: string };
  components?: Record<string, Record<string, string>>;
  images?: { logo?: string; favicon?: string; ogImage?: string };
}

// ---------- Source Provenance ----------
export type SourceProvenance = 'screenshot' | 'url-dom' | 'url-meta' | 'inferred' | 'user-edited';

// ---------- URL Extracted Data ----------
export interface UrlExtractedData {
  markdown?: string;
  headings: string[];
  navLinks: Array<{ text: string; href: string }>;
  footerLinks: Array<{ text: string; href: string }>;
  imageUrls: string[];
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

// ---------- CopyDraftV1 ----------
export interface CopyField {
  value: string;
  confidence: number;
  source: 'observed' | 'inferred';
  /** Where this value came from — enables trust/provenance in Plan Review */
  provenance?: SourceProvenance;
}

export type CopyBindingQuality = 'exact-id' | 'archetype-match' | 'positional-fallback';

export interface SectionCopy {
  sectionId: string;
  /** Optional small label that visually sits above (or below) the heading. */
  eyebrow?: CopyField;
  /** 'above' (default) or 'below' the heading. Mirrors hero eyebrow positioning. */
  eyebrowPosition?: EyebrowPosition;
  heading: CopyField;
  subheading?: CopyField;
  body?: CopyField;
  ctaLabels: CopyField[];
  items?: CopyField[];
  /** How this copy was bound to its section — 'exact-id' is most trustworthy */
  bindingQuality?: CopyBindingQuality;
}

export type EyebrowPosition = 'above' | 'below';

export interface CopyDraftV1 {
  heroHeadline: CopyField;
  heroSubheadline: CopyField;
  heroEyebrow?: CopyField;
  heroEyebrowPosition?: EyebrowPosition;
  heroCtas: CopyField[];
  sections: SectionCopy[];
  footerText: CopyField;
  proofRowText?: CopyField[];
}

// ---------- KajabiPagePlanV1 ----------
export interface SectionPlan {
  sectionId: string;
  archetype: SectionArchetype;
  recipeId: string;
  blockPattern: string;
  mustPreserveFields: string[];
  fallbackRules: string[];
  warnings: string[];
  simplified: boolean;
  // Out-of-scope for milestone 1 (planner / template-mapping pipeline):
  // mappingFit, mappingScore, mappedRegion. These return when planner lands.
}

export interface KajabiPagePlanV1 {
  baseTheme: 'streamlined-home';
  header: SectionPlan;
  hero: SectionPlan;
  sections: SectionPlan[];
  footer?: SectionPlan;
  globalWarnings: string[];
  /** Phase 4: true if the validated template mapping was used to attach mappedRegion to plan sections */
  templateMappingApplied?: boolean;
}

// ---------- RenderCheckResultV1 ----------
export interface Mismatch {
  sectionId: string;
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion: string;
}

export interface RenderCheckResultV1 {
  mismatches: Mismatch[];
  overallScore: number; // 0-100
  criticalRegressions: string[];
  diagnostics: string[];
}

// ---------- Project ----------
export type StartMode = 'screenshot' | 'blank' | 'zip' | 'url' | 'screenshot_url';
export type ProjectStep = 'create' | 'analyze' | 'plan_review' | 'building' | 'export';

export interface Project {
  id: string;
  name: string;
  startMode: StartMode;
  step: ProjectStep;
  screenshotUrl?: string;
  sourceUrl?: string;
  firecrawlBranding?: FirecrawlBranding;
  urlExtractedData?: UrlExtractedData;
  visualPlan?: VisualPlanV1;
  copyDraft?: CopyDraftV1;
  pagePlan?: KajabiPagePlanV1;
  renderCheck?: RenderCheckResultV1;
  // Out-of-scope for milestone 1 (will return when planner/critique/grounding
  // are wired in later milestones): fullCritique, mergeDiagnostics, pageGrounding.
  settingsData?: Record<string, unknown>;
  uploadedAssets?: Record<string, string>; // sectionId:blockId → blob URL
  createdAt: string;
}
