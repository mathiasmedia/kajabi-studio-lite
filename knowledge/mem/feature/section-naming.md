---
name: Section naming for Kajabi sidebar
description: Every <ContentSection> in a template SHOULD pass a `name` prop — it becomes the section label in Kajabi's editor sidebar (otherwise every section reads as the generic "Section").
type: feature
---

# What it does

`CommonSectionProps.name` (in `src/blocks/types.ts`) flows through
`serialize.ts` → `section.name` in `settings_data.json`. Kajabi's editor
sidebar renders that string as the section's label. Without it, every
content section appears as "Section" — making the sidebar unusable on
multi-section pages.

Header and footer fall back to "Header" / "Footer" if `name` is omitted.

# Rules

- Every `<ContentSection>` in a template SHOULD have a `name` prop:
  ```tsx
  <ContentSection name="Hero" ...>
  <ContentSection name="Community" ...>
  <ContentSection name="FAQ" ...>
  ```
- Use short, human-friendly labels (1–3 words). Match the section's
  purpose, not its block types ("About", not "Text + Image").
- Header/footer `name` is optional — defaults are fine unless a template
  needs to disambiguate (rare).
- This affects ONLY the Kajabi editor sidebar; preview render and runtime
  Kajabi layout are unchanged.
- When building any new template or editing an existing one, name every
  content section. Treat unlabeled sections as a bug.
