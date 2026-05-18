---
name: Multi-page export
description: exportFromTree accepts either a single tree (homepage) or a map keyed by Kajabi template name (index/about/page/contact/blog/blog_post/thank_you/404)
type: feature
---

`exportFromTree` and `serializeTree` accept two input shapes:

**Single page (homepage only):**
```tsx
exportFromTree(<><HeaderSection/>...<FooterSection/></>);
```
→ emits `content_for_index` only.

**Multi-page:**
```tsx
exportFromTree({
  index: <HomePage/>,
  about: <AboutPage/>,
  contact: <ContactPage/>,
});
```
→ emits `content_for_index`, `content_for_about`, `content_for_contact`.

Supported template keys (must match base theme's `templates/*.liquid` that use `{% dynamic_sections_for "<name>" %}`): `index`, `about`, `page`, `contact`, `blog`, `blog_post`, `thank_you`, `404`. Unknown keys are warned and skipped.

**Header/footer are SHARED site-wide.** They live in `sections.header` / `sections.footer` and are rendered by the layout via `{% section "header" %}`. Define them in any one tree (or repeat them in each — the LAST definition wins, with a console warning on collision). Pattern: extract a `<SharedHeader/>` and `<SharedFooter/>` component and include both in every page tree so the in-app preview looks complete on every tab.

Untouched templates in the base theme (e.g. `content_for_blog` when only index+about were built) are preserved exactly from the original `settings_data.json` — `mergeSettings` only overwrites the `content_for_*` arrays the generator emitted.
