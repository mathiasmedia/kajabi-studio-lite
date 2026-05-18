---
name: Raw Kajabi sections via <RawSection>
description: Use <RawSection type="..."> to inject Kajabi-native section types (products, blog_listings, blog_post_body) into our composed pages so dynamic Kajabi content renders alongside our chrome
type: feature
---

For pages where Kajabi renders dynamic content via dedicated section TYPES
(not just dynamic templates), use the `<RawSection>` component from
`@/blocks` to inject them into our tree. This keeps branded chrome (header,
intro, outro, footer) AND the dynamic Kajabi-native section in the same
`content_for_<page>` array.

## Section types to inject

- `products` — member library / purchased-products grid (used on the `library` page)
- `blog_listings` — blog post listing with optional sidebar (used on the `blog` page)
- `blog_post_body` — single blog post body (title, author, date, content, optional sidebar) (used on the `blog_post` page)

These are NOT in `CONTENT_ALLOWED` for `<ContentSection>` because they're
section TYPES, not block types. They render their own layout entirely.

## Usage

```tsx
<RawSection
  type="products"
  name="My Products"
  settings={{
    background_color: '#F4EFE6',
    text_heading: 'Your library',
    btn_background_color: '#9DB29A',
    btn_border_radius: '999',
    layout: '12',
    // ... any settings the Kajabi section schema accepts
  }}
  blocks={{
    sb_search: { type: 'sidebar_search', settings: { ... } },
    sb_categories: { type: 'sidebar_categories', settings: { ... } },
  }}
  blockOrder={['sb_search', 'sb_categories']}
/>
```

`settings` and `blocks` are pass-through — no field validation. The shape
must match the Kajabi section's own schema (see the example zip under
`config/settings_data.json`'s `sections` map for reference).

## Why this matters

Without RawSection, our serializer REPLACES the original
`content_for_library` / `content_for_blog` / `content_for_blog_post` arrays
in `settings_data.json`, losing the Kajabi-shipped products/listings/body
sections. With RawSection we re-include them ourselves with branded settings.

## Pages that should use it

- `library` → branded intro + `<RawSection type="products"/>` + branded outro
- `blog` → branded intro + `<RawSection type="blog_listings"/>` + branded outro
- `blog_post` → `<RawSection type="blog_post_body"/>` + branded outro

For other dynamic pages (login, store, member_directory, announcements,
etc.) we still emit chrome only and let Kajabi's base template render —
those pages don't have a section-type counterpart we need to inject.
