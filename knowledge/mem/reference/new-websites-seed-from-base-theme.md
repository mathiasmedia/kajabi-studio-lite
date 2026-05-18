---
name: New websites seed every system page from base theme
description: Engine 0.7.57+. createSite seeds via importSiteFromZip(BASE_THEME_URLS[baseTheme]) so every Kajabi system page (library/store/blog/blog_post/thank_you/404/member_directory/announcements/blog_search/newsletter_*) lands populated with base-theme defaults. buildBlankDesign is fallback only. Landing pages unchanged.
type: feature
---
Engine 0.7.57+ (`packages/engine/src/data/siteStore.ts`).

`createSite` (kind:'site') no longer uses the minimal hand-authored `buildBlankDesign(brand)` as primary seed. It now calls `seedDesignFromBaseTheme(brand, baseTheme, buildBlankDesign)`:
1. `fetch(BASE_THEME_URLS[baseTheme])` → blob
2. `importSiteFromZip(blob)` → full SiteDesign
3. Use that design verbatim as the row seed
4. On any error, fall back to `buildBlankDesign(brand)`

Result: every new website lands with the SAME starting content the expert would get downloading the raw Kajabi theme — `index`, `about`, `page`, `contact`, `blog`, `blog_post`, `library`, `store`, `thank_you`, `404`, `member_directory`, `announcements`, `blog_search`, `newsletter_kjb_internal`, `newsletter_post_kjb_internal`, `newsletter_subscribe_kjb_internal` — plus sharedHeader/footer + `exit_pop` + `two_step` global sections, all populated.

Landing pages (`kind:'landing_page'`) are unchanged — `createLandingPage` still uses `buildLandingPageBlankDesign(brand)` because landing pages intentionally collapse to a single `index` page.

If Kajabi adds a new system page or sitewide slot in the future, update the base theme zip — `seedDesignFromBaseTheme` picks it up automatically. Don't hand-author system page seeds in `blank.ts`.

AGENTS.md §4.35ac.
