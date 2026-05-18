---
name: Template dynamic-content audit (mandatory)
description: Every new or modified template MUST pass a dynamic-content audit before being considered done. Never hardcode content on dynamic Kajabi pages.
type: preference
---

# Mandatory dynamic-content audit for every template

Before declaring ANY template build/edit complete, audit every page against
this checklist. No exceptions. If a violation exists, fix it in the same loop.

## Hard rules

1. **`library` page** MUST contain `<RawSection type="products" ... />`. Never hardcode product cards, course tiles, or pricing.
2. **`blog` page** MUST contain `<RawSection type="blog_listings" ... />`. Never hardcode post titles, excerpts, dates, or category lists.
3. **`blog_post` page** MUST contain `<RawSection type="blog_post_body" ... />`. Never hardcode article body, author bio, or related-posts.
4. **`store`, `login`, `newsletter*`, `member_directory`, `announcements`, `blog_search`** — header + optional intro + footer ONLY. No fake content.
5. RawSections inherit branding via `settings` (background, button colors, border radius) — always pass them so dynamic content matches the template aesthetic.

## Audit phrasing (apply silently, never narrate to user unless they ask)

For each page in the template, ask:
- "Does Kajabi render this page's primary content dynamically?"
- "If yes — am I using `<RawSection>` for that content, or did I hardcode it?"

If you find a violation mid-build, fix it before reporting completion. Do NOT
ship a template and wait for the user to catch it.

## References
- `mem://reference/dynamic-kajabi-content.md` — full list of dynamic pages
- `mem://reference/raw-kajabi-sections.md` — RawSection usage
