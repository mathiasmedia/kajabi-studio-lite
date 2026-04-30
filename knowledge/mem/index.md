# Project Memory

## Core
This is a Kajabi theme exporter. Compose pages ONLY from `@/blocks` (3 sections + 16 atomic blocks). Never invent block types. Never use raw HTML/JSX for page content — only block components.
Page shape: exactly 1 `<HeaderSection>` + 1–8 `<ContentSection>` + 1 `<FooterSection>`.
Header allows ONLY: Logo, Menu, CallToAction, SocialIcons.
Footer allows ONLY: Logo, LinkList, Text, SocialIcons, Copyright.
All field names come from `src/engines/kajabiFieldSchema.ts` and `mem://reference/block-field-catalog.md`. Never invent field names.
Read `src/engines/kajabi_rendering_guide.md` and `mem://reference/section-layout-gotchas.md` BEFORE writing block/section code.
Export pipeline supports single page OR multi-page: `exportFromTree(tree)` for homepage only, or `exportFromTree({ index, about, contact, ... })` for multi-page.
Multi-page: header/footer are SHARED site-wide.
SocialIcons render only when each platform URL is set.
`background_color` over `bg_image`/`bg_video` must be `rgba(...)` with a<1, OR empty string `""` to show the raw image.
`fullWidth` is inner-content breakout, NOT image coverage.
SECTION FULL WIDTH — NEVER set `fullWidth: true` on a `ContentSection` unless the expert explicitly asked.
TEMPLATE BUILD INCLUDES IMAGES — when a prompt lists per-page imagery, generate and wire images in the SAME loop as the template code.
SECTION NAMING — every `<ContentSection>` MUST pass a `name` prop.
NEVER set a block's `background_color` to the string `"transparent"`.
SECTION BACKGROUND IMAGES go directly into `bg_image` JSON.
CTA BUTTONS — every CTA on a single site MUST look identical and on-brand.
BLOCK CHROME KEY HYGIENE (CRITICAL) — Chrome props on EVERY block MUST be camelCase, `padding` MUST be a 4-sided object. snake_case keys silently dropped. Border radius value has NO `px` suffix.
PRO THEMES — `sites.base_theme` can be `streamlined-home`, `streamlined-home-pro`, `encore-page`, or `encore-page-pro`. Pro themes are ADDITIVE.
PRO STYLING — typography, button, and form rules belong in `themeSettings` (sitewide) or block-level overrides, NEVER inline `style="..."` in block HTML.
NATIVE BLOCK BUTTONS — for "Explore →"/"Learn more"/"Read story" CTA at the bottom of a `feature` or `pricing_card`, use the block's native button props.
TEXT BUTTON COLOR QUIRK — when `buttonStyle: "text"`, the visible link color comes from the dark/light pair slot matching `btn_type`, NOT from "buttonTextColor".
FONT CONTROLS BEFORE CSS — Use Kajabi's font pickers FIRST. NEVER hand-write `:root{--pathx-font-*}` in `customCss`.
FOOTER COPYRIGHT — `copyright` block text MUST start directly with the brand/owner name. NEVER include leading `©`, `Copyright`, or any 4-digit year.
DYNAMIC PAGES (CRITICAL) — NEVER hardcode posts/products/lessons on `blog`, `blog_post`, `library`, `store`, `login`, `register`, `forgot_password`, `reset_password`, `thank_you`, `404`, `newsletter*`, `member_directory`, `announcements`, `blog_search`. Required raw sections: `library` → `{ kind: "raw", type: "products" }`, `blog` → `{ kind: "raw", type: "blog_listings" }`, `blog_post` → `{ kind: "raw", type: "blog_post_body" }`.
PAGE TEMPLATE IS OFF-LIMITS — `design.pages.page` MUST be header + footer only.
AUTH PAGES OFF-LIMITS — `design.pages.login`, `register`, `forgot_password`, `reset_password` MUST be header + footer only.
TEMPLATE-WIDE BRANDING — every template should set `themeSettings` and `customCss` on its `TemplateDef`.
FEATURE BLOCK IMAGE WIDTH (#1 repeated complaint) — `feature` block's `imageWidth` defaults to **80px** (icon size). Card photos: `"480"`–`"640"` (3-up/4-up grids), `"800"`–`"1200"` (2-up split). NO middle ground.
WHITE-ON-WHITE BLOCKS VANISH — NEVER place a chrome-bearing block (`pricing_card`, `accordion`, `feature`, `card`) with `backgroundColor:"#FFFFFF"` inside a section whose `background` is also white. Tint the BLOCK, not the section.
SITE CLONING — MAP FIRST, BUILD SECOND. Phase 1: Firecrawl `map` + `scrape`. Phase 2: download every real image, upload via `upload-site-image`. Phase 3: build hero ONLY first, STOP for approval.
PREVIEW SHADOW PARITY — `SHADOW_MAP` must be 1:1 with Kajabi's `box-shadow-{small,medium,large}`.
SLIDER FADE EFFECT — Swiper `transitionEffect:"fade"` crossfades full-width slides; `blocksPerSlide` is silently forced to 1.
SLIDER `block_offset` IS MANDATORY (Pro #1 mistake) — every time you set `enableSlider:true`, count the leading non-slide blocks and set `block_offset:<count>`.
EXPLICIT FONT WEIGHTS (Pro templates) — Every Pro template's `themeSettings` MUST explicitly set `font_weight_heading` + `line_height_heading` + `font_weight_body` + `line_height_body`, AND for every heading level rendered: per-element overrides.

## Memories
See AGENTS.md and PRO_CAPABILITIES.md for full detail. Each rule above is elaborated there.

For full per-topic detail, the master sandbox stores ~60 individual `mem://` files keyed by topic — they're listed in this index on master. The bundle ships AGENTS.md + PRO_CAPABILITIES.md which contain the canonical authoring rules; the per-file mems are elaborations duplicated here.
