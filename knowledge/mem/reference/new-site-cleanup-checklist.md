---
name: New site / cleanup checklist
description: Four invariants every kind:'site' MUST satisfy — both popups seeded from base, all system pages seeded from base, all typography in themeSettings (not customCss), all sitewide colors+buttons in themeSettings (not per-block or customCss). One consolidated pre-flight for new builds AND existing-site audits.
type: feature
---
AGENTS §4.35ae. Combines §4.35ab (popup seed), §4.35ac (system page seed), §4.35ad (style guide cascade), §4.7 (CTA consistency) into a single named workflow. Engine handles popup + system page seed automatically on createSite via seedDesignFromBaseTheme(); AI is responsible for the style guide layers and for re-seeding existing sites missing popup/page content. Pre-flight checklist included in §4.35ae — walk it before declaring any site "clean".
