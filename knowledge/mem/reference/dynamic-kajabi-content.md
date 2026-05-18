---
name: dynamic-kajabi-content
description: Pages and blocks Kajabi renders dynamically — never hardcode content. For library/blog/blog_post you MUST inject the matching Kajabi-native section via <RawSection>; other dynamic pages get chrome only.
type: constraint
---

# Dynamic Kajabi content — never hardcode

Kajabi renders certain pages and content slots **dynamically** at runtime via its own Liquid templates and section types. If we hardcode that content in our React templates, it either gets clobbered by Kajabi or appears alongside the real dynamic content.

## Two flavors of dynamic content

### A) Dynamic via Kajabi-native section TYPES (use `<RawSection>`)

Some "dynamic" content is actually a Kajabi-native section type that we MUST include in our `content_for_<page>` array. Inject it with `<RawSection type="..."/>` from `@/blocks` so branded chrome wraps the dynamic section. See `mem://reference/raw-kajabi-sections.md`.

| Page | RawSection type | What renders |
|---|---|---|
| `library` | `products` | Member's purchased products / courses grid |
| `blog` | `blog_listings` | Post listing with optional sidebar (search, categories) |
| `blog_post` | `blog_post_body` | Single post — title, author, date, body, sidebar |

### B) Dynamic via the base `templates/<name>.liquid` only (chrome only)

These don't have a section-type counterpart — Kajabi's own template renders the body and we provide nothing but header + intro + outro + footer.

| Page | What Kajabi injects |
|---|---|
| `store` | Live product catalog with prices and CTAs |
| `login` | Auth form |
| `newsletter`, `newsletter_post`, `newsletter_subscribe` | Email opt-in flows |
| `member_directory` | Member listing |
| `announcements` | Admin-managed announcements |
| `blog_search` | Search form + results |

## What NOT to do

- ❌ Add `Feature`/`Card`/`Text` blocks containing fake post titles, product names, or prices.
- ❌ Render hardcoded blog post bodies on `blog_post`.
- ❌ Render product cards on `library` or `store`.
- ❌ Skip the `<RawSection>` on `library` / `blog` / `blog_post` — without it the dynamic Kajabi section is dropped from `content_for_<page>` and the user sees only chrome.

## What TO do

- ✅ Header + intro section.
- ✅ For `library` / `blog` / `blog_post`: include the matching `<RawSection>` between intro and outro with branded settings (colors, button styles, padding).
- ✅ Outro section (newsletter CTA, related-pages links).
- ✅ Footer.

## Engine-level enforcement

`src/blocks/serialize.ts → SYSTEM_TEMPLATES` includes ALL of these dynamic page slots. The export engine in `src/engines/exportEngine.ts` skips emitting a custom `templates/<name>.liquid` for any page in `SYSTEM_TEMPLATES` — preserving the base zip's dynamic Liquid template.

## Example: blog page with RawSection

```tsx
function BlogPage({ brand }: { brand: string }) {
  return (
    <>
      <SharedHeader brand={brand} />
      <ContentSection>{/* intro */}</ContentSection>
      <RawSection
        type="blog_listings"
        settings={{ background_color: CREAM, layout_style: 'list', sidebar_on_right: 'true' }}
        blocks={{ sb_search: { type: 'sidebar_search', settings: {} } }}
        blockOrder={['sb_search']}
      />
      <ContentSection>{/* outro */}</ContentSection>
      <SharedFooter brand={brand} />
    </>
  );
}
```
