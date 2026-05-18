---
name: Kajabi page creation
description: How to add and delete pages in a Kajabi theme — never use (page) or (sales_page) templates; create dedicated template + dynamic_sections_for + content_for_<name> array; never delete system pages
type: reference
---

# Adding pages to a Kajabi theme

## Hard rule
❌ **Never use** the `(page)` or `(sales_page)` templates to add new pages. Do not route new pages through them under any circumstance.

## Correct procedure (per new page)

For each new page, do all four steps. The template filename, the `dynamic_sections_for` argument, and the `content_for_<name>` key MUST all match exactly.

### 1. Create a new template file
Path: `templates/<page_name>.liquid` (unique name per page)

Example: `templates/membership_page.liquid`

### 2. Add the dynamic sections tag
Inside the template, the body should call:
```liquid
{% dynamic_sections_for "<page_name>" %}
```

Example:
```liquid
{% dynamic_sections_for "membership_page" %}
```

### 3. Define the section instances
Add each section the page needs to `settings_data.json` under `current.sections` — each with its own id, type, settings, blocks, and block_order. (Same shape as homepage sections.)

### 4. Register the page's section order
At the bottom of `settings_data.json`, add a `content_for_<page_name>` array listing the section IDs **in the order they should render**:

```json
"content_for_member_directory": [
  "1776722625022",
  "1776722625024",
  "1776722625032",
  "1776722625035",
  "1597434984398"
]
```

## Naming consistency check
- Template file: `templates/membership_page.liquid`
- Tag inside template: `{% dynamic_sections_for "membership_page" %}`
- JSON key: `"content_for_membership_page": [...]`

All three names must be identical.

## What this means for the app
When a template (in `src/templates/<id>.tsx`) declares additional pages beyond `index`, the export pipeline must:
- Emit a `templates/<page_name>.liquid` file containing `{% dynamic_sections_for "<page_name>" %}`
- Emit the section definitions under `current.sections`
- Emit `content_for_<page_name>: [...]` in `settings_data.json`

Never shortcut by routing pages through `(page)` or `(sales_page)`.

---

# Deleting pages from a Kajabi theme

## Hard rule — never delete system pages
Kajabi marks required pages as **System** in the admin Pages list. These MUST always exist in the theme. Never delete them, never omit them from export.

**System pages (NEVER delete):**
`Home, Announcements, Newsletter Subscribe, 404, Thank You, Newsletter, Newsletter Post, Login, Blog Post, Blog, Store, Library, Blog Search, Member Directory`

**Safe to delete:**
- Non-system pages that ship in the template (e.g. `About`, `Contact`)
- Any custom page we added ourselves (e.g. `membership_page`, `member_directory`)

## Correct deletion procedure (reverse of creation)
For each page being removed:

1. **Delete the template file** — remove `templates/<page_name>.liquid`
2. **Remove section instances** — delete the section entries from `settings_data.json` under `current.sections` that belonged only to that page
3. **Remove the page key** — delete the `content_for_<page_name>` array from the bottom of `settings_data.json`

If a section was shared with another page, leave it in `current.sections` and only remove it from the deleted page's `content_for_*` array.
