# Thin Client Agent Guide

> **SCOPE GUARD — READ FIRST:**
> This file applies ONLY to **thin client remixes** of Kajabi Studio (per-expert site-building projects).
> If this project IS the master (project name contains "Kajabi Studio Max", or the project ID is `4fd872bc-5636-4a8a-bde9-a334a0656f59`), **IGNORE this entire file** and follow normal master-project behavior (full freedom to modify app shell, backend, dashboard, edge functions, etc.).
> The rest of this guide assumes you are inside a thin client remix.

> **You are the Lovable AI inside a thin client remix used to build a custom Kajabi site for one expert/client.**
> Your job is to **edit the site's design data** (and generate images for it) so the expert gets a great Kajabi site.
> If this guide conflicts with a casual user assumption, **this guide wins** unless the operator explicitly overrides it.

---

## 1. What this project is

This is a **per-expert remix** of Kajabi Studio. The expert opens it, picks a site, and asks you to build/refine it. You make the changes; they review the preview; you ship the export to Kajabi.

There are **no code-side templates anymore**. Every site's full visual identity (pages, sections, blocks, copy, fonts, colors, image references) lives as JSON in the `sites.design` column in the database. Editing a site means **editing that JSON and saving it**.

---

## 2. Your primary job

✅ **You SHOULD edit site design data to build/refine the site.**

That includes:
- redesigning sections (hero, features, CTAs, footers)
- adding, removing, or reordering pages
- rewriting copy and headlines
- generating and wiring imagery
- changing fonts, colors, spacing, theme settings
- adjusting page structure within the existing Kajabi architecture

When the expert asks to redesign a page or section, **just do the work** and show them the result.

---

## 3. How to actually edit a site (THE CORE WORKFLOW)

Sites are stored as JSON in the `sites` table, in the `design` column. The shape is defined in `src/lib/siteDesign/types.ts`. **Thin clients do NOT have direct database access** (no service-role key, no `psql`, and `select`/`update` against `sites` is RLS-blocked without a user JWT).

Master exposes two edge functions for thin clients:
- **`get-site-design`** — read the current `{ id, name, brandName, design, updatedAt }` for a site.
- **`update-site-design`** — write a new `design` JSON for a site.

Both accept the thin-client app token via the `X-App-Token` header (same token already used by `generate-site-image`). You do NOT need a service role key — the edge functions hold it server-side.

### 3.1 Default workflow: GET → mutate → POST

**ALWAYS load the existing design first** with `get-site-design`. Never POST a new `design` object you built from scratch — that wipes every other page on the site. Always mutate what's already there and send the full updated object back.

**Pattern (one-shot Deno or Node script):**

```ts
// /tmp/edit-site.ts — run with: deno run -A /tmp/edit-site.ts
const SUPABASE_URL = "<from .env: VITE_SUPABASE_URL>";
const APP_TOKEN = "<thin client app token — same one used by generate-site-image>";
const SITE_ID = "<site uuid from the editor route /sites/:siteId>";

const headers = {
  "Content-Type": "application/json",
  "X-App-Token": APP_TOKEN,
};

// 1. LOAD the current design via get-site-design.
const getResp = await fetch(`${SUPABASE_URL}/functions/v1/get-site-design`, {
  method: "POST",
  headers,
  body: JSON.stringify({ siteId: SITE_ID }),
});
if (!getResp.ok) throw new Error(`Load failed: ${getResp.status} ${await getResp.text()}`);
const { design } = await getResp.json();
if (!design) throw new Error("Site has no design yet");

// 2. MUTATE it in place. Example: replace the hero section on the homepage.
//    Touch ONLY the parts you're changing — keep every other page/section intact.
design.pages.index.sections[1] = {
  kind: "content",
  name: "Hero",
  props: {
    background: "#0B0B0F",
    paddingDesktop: { top: "140", bottom: "140" },
  },
  blocks: [
    { type: "text", props: { width: "12", align: "center", text: "<h1>...</h1><p>...</p>" } },
    { type: "cta",  props: { width: "12", align: "center", label: "Get Started", url: "#" } },
  ],
};

// 3. SAVE the full design via update-site-design.
const putResp = await fetch(`${SUPABASE_URL}/functions/v1/update-site-design`, {
  method: "POST",
  headers,
  body: JSON.stringify({ siteId: SITE_ID, design }),
});
if (!putResp.ok) throw new Error(`Save failed: ${putResp.status} ${await putResp.text()}`);
console.log("Updated:", await putResp.json());
```

**Where to find each value:**
- `SUPABASE_URL` → `.env` file in the thin client (`VITE_SUPABASE_URL`)
- `APP_TOKEN` → search the thin client codebase for `THIN_CLIENT_APP_TOKEN` or `x-app-token` — the helper that calls `generate-site-image` already uses it
- `SITE_ID` → from the editor route `/sites/:siteId` the expert is currently on

### 3.2 NEVER write raw SQL or use the anon key to read sites

Do NOT use `psql`, the anon key, or any direct DB connection — `sites` is RLS-protected and reads require a user JWT the sandbox doesn't have. Always go through `get-site-design` / `update-site-design`.

### 3.3 NEVER just edit `src/lib/siteDesign/blank.ts` to fix one site

`blank.ts` is the baseline used **only when creating brand-new sites**. Editing it does NOT change any existing site (their JSON is already saved in the DB). Only edit `blank.ts` if the operator explicitly asks you to change the default starting design for new sites.

### 3.4 NEVER add "regenerate" buttons or new editor UI to do this work

The expert is talking to you. You ARE the editor. Don't build UI to do what you can already do directly through the edge function.

---

## 4. Guardrails

### 4.1 Use the existing Kajabi block system

- Compose pages from the existing block types defined in `src/blocks/` (text, cta, feature, image, logo, menu, copyright, etc.).
- Never invent new block types.
- Never invent field names — refer to `src/blocks/types.ts` and the block components.
- Use the existing export pipeline. The editor handles export; you don't need to.

### 4.2 Do NOT change shared backend/master plumbing

Off-limits unless the operator explicitly asks:
- database schema / tables / RLS / migrations
- edge functions
- auth configuration
- `THIN_CLIENT_APP_TOKEN` wiring
- `src/lib/siteStore.ts` (the helper layer — fine to import from, never to modify)
- `src/lib/imageStore.ts`
- `src/lib/siteDesign/types.ts` and `render.tsx` (engine)
- `src/blocks/**` (block components — owned by master)
- `src/engines/**` (export pipeline — owned by master)
- `src/pages/**` and `src/components/**` (app shell — owned by operator)
- secrets / admin tooling

You can READ all of these to understand the system. You just can't MODIFY them.

### 4.3 Do NOT add localStorage or any client-side persistence

All site data, images, and slot assignments persist server-side in Supabase. If something isn't appearing, it is **never** because "we need to store it in localStorage."

### 4.4 NEVER use sticky / fixed / overlay headers unless explicitly asked

Default headers are **static** — they scroll off the page with the rest of the content. Do NOT set `sticky: true` or `position: 'overlay'` on `HeaderSection` props unless the expert **explicitly** asks for "sticky header", "fixed header", "header that stays at the top", or "header overlaid on the hero". This applies to new sites, redesigns, and any "make it more premium" pass. Sticky headers are a deliberate choice the expert must opt into — never assume.

### 4.5 NEVER add titles to footer `link_list` blocks unless explicitly asked

Footer link lists (e.g. "Explore", "Programs", "Resources", "Legal") should render as **untitled column groups** by default. Do NOT set `title` (and leave `show_title: false` / omit the title prop) on `link_list` blocks placed in the footer unless the expert **explicitly** asks for column headings like "Add a 'Resources' header above this list". Most modern footers look cleaner without column titles — the link labels themselves are enough. This applies to new sites, redesigns, and any footer pass.

### 4.6 NEVER overlay an opaque color on a section with a background image

When a section has `bgType: 'image'` (or any `backgroundImage` set), its `background` color prop MUST be either **empty** (`""`) or a **semi-transparent** `rgba(...)` value with alpha `< 1`. An opaque hex like `#FBF8F2` or `#000000` completely covers the image — Kajabi renders the color on top, the image is technically loaded but invisible, and the expert reports "my hero image isn't showing."

Defaults for image sections:
- **Want the raw image to show:** `background: ""` (empty string).
- **Want a tint/darken/lighten over the image:** `background: "rgba(0,0,0,0.45)"` (or any alpha `< 1`).
- **Never:** opaque hex (`#xxxxxx`), `rgb(...)`, or `rgba(...)` with alpha `1`.

This applies to every section type, including hero, CTA, and full-bleed image bands. When generating a hero image and wiring it onto a section, default to `background: ""` unless the expert explicitly asks for a tint.



### 4.7 CTA buttons across a site MUST look consistent and on-brand

Every CTA block on a single site should feel like it came from the same brand system. The bug to avoid is **two CTAs on the same site looking like they belong to different brands** — e.g. one navy pill outline, one cream square solid, picked at random by the AI.

**The rule is consistency, not abstinence.** You SHOULD set per-block button styling — `buttonBackgroundColor`, `buttonTextColor`, `buttonStyle`, `buttonBorderRadius`, `buttonSize` — but you must:

1. **Decide the brand button look ONCE per site**, then apply it identically to every primary CTA. Pull the colors from the site's palette (often visible in `design.themeSettings`: `color_button`, `color_button_text`, `color_primary`, `color_accent`). If the site has no `themeSettings`, infer from the section/page palette or ask the expert to pick.
2. **When editing a single CTA, audit every other CTA on the site first** (`get-site-design` → walk all pages → list every `cta` block's button props) and match them. If you change one, change them all to match.
3. **Reserve secondary/ghost variants** (outline, transparent bg) only for genuine secondary actions next to a primary CTA in the same section — never as a "let's mix it up" choice across pages.

Good defaults to copy when creating a new CTA on a branded site:
```ts
{
  type: "cta",
  props: {
    width: "12",
    align: "center",
    buttonText: "Get Started",
    buttonUrl: "#",
    buttonStyle: "solid",
    buttonBackgroundColor: "#1F2A44",   // brand primary, same on every CTA
    buttonTextColor: "#FBF8F2",          // brand on-primary, same on every CTA
    buttonBorderRadius: "999",           // same radius on every CTA (or "8" for soft, "0" for sharp)
  }
}
```

If you generated this CTA and the site already has 3 other CTAs with different colors/radii, **fix the inconsistency** — either update this one to match the existing style, or update all of them to a unified style. Don't ship a site with mismatched buttons.

### 4.8 Section + block background images go directly into the JSON

When you put an image URL on a section (`backgroundImage`) or block (`src`), the export pipeline writes it **straight into `bg_image` / `image`** in `settings_data.json` — Kajabi's `image_picker_url` Liquid filter passes external `https://` URLs through unchanged. There is **no longer** any CSS-injection workaround that pins backgrounds onto sections by id; if you see code or comments referencing `__externalBg`, `assets/inject.css`, or `buildExternalBgCssBlock` in a thin client, it's stale and a `sync from master` is overdue.

Symptom that you have a stale engine: hero/section background images appear in the **rendered preview** but Kajabi shows the section as a black box, or the exported zip's `settings_data.json` has empty `bg_image` fields with the image URL only present in injected CSS. Fix: ask the operator to run `sync from master`.

### 4.9 Image references must be public URLs

Any image URL embedded in `design` JSON must be one of:
- a `https://...supabase.co/storage/v1/object/public/site-images/...` URL from the project's bucket
- a slot reference `{ slot: 'hero' }` **— but ONLY if a `site_images` row with that exact slot exists for this site**
- another fully-qualified `https://` URL on a public CDN

Never use bundler paths (`/src/...`, `/assets/...`, `blob:`, `data:`). Kajabi can't fetch them.

**CRITICAL — slot refs without an image = black section.** A `{ slot: 'x' }` ref that doesn't match a `site_images` row resolves to nothing, the section's `bgType: 'image'` is then demoted, and the section renders as its fallback color (usually black). Symptoms: "my hero is just a black box." To avoid this:

1. **Default to direct URLs.** When you generate an image via `generate-site-image`, it returns `{ url, imageId }`. Put that `url` directly on the block/section prop (`backgroundImage: "https://..."`, `src: "https://..."`). Done — no slot bookkeeping needed.
2. **Only use `{ slot }` refs** if the site already has a `site_images` row with that slot (check by reading the site first, or by asking `generate-site-image` with an explicit `slot` parameter that it writes to the row). If you set `{ slot: 'hero' }` in `design`, you MUST have also assigned a row to slot `'hero'` in the same change.
3. **Never invent a slot name** and hope it resolves. If you're not sure the slot exists, use the direct URL.

To add a new image: call the `generate-site-image` edge function (it writes to `site_images` and returns `{ url, imageId }`), then reference that `url` directly in `design`. The render pipeline + exporter both have a safety net that demotes broken `bgType: 'image'` to the fallback color, but they also emit a console warning — if you see `[siteDesign] slot "..." has no matching site_images row`, you shipped a broken reference and must fix it.

### 4.10 NEVER hardcode dynamic Kajabi content (blog, blog post, library/products)

🚨 **This is the #1 cause of "the live site doesn't match the preview".** Some Kajabi pages render content from the expert's Kajabi data (their real blog posts, their real products) at runtime. If you hardcode mock posts/products into `design`, the export ships those mocks to Kajabi and the expert's real content is hidden.

**The pages that are dynamic — NEVER fill them with hardcoded content blocks:**

| Page key | What Kajabi renders dynamically | What you MUST use |
|---|---|---|
| `blog` | The expert's real blog post list | `{ kind: "raw", type: "blog_listings" }` |
| `blog_post` | The body of whichever post the visitor clicked | `{ kind: "raw", type: "blog_post_body" }` |
| `library` | The expert's real products / member library | `{ kind: "raw", type: "products" }` |

**Forbidden on these pages:** hardcoded `card` blocks for posts/products, hardcoded post bodies, hardcoded lesson content, hardcoded product grids, hardcoded "course progress" or "continue learning" lists, hardcoded "related posts" cards. None of it. The Kajabi raw section renders all of that from the expert's real data.

**Allowed on these pages:** header (shared), an optional branded intro `content` section above the raw section (eyebrow + headline + subhead — copy only, no fake post/product cards), an optional branded outro `content` section below it (e.g. CTA), and footer (shared). That's it.

**Correct shape — `blog`:**
```jsonc
{
  "sections": [
    { "kind": "header", ... },
    { "kind": "content", "name": "Journal hero", "blocks": [/* eyebrow + h1 + lede only */] },
    {
      "kind": "raw",
      "type": "blog_listings",
      "name": "Blog posts (dynamic)",
      "settings": {
        "background_color": "#FBF8F2",
        "text_color": "#1F2A44",
        "btn_background_color": "#1F2A44",   // brand
        "btn_text_color": "#FBF8F2",          // brand
        "btn_border_radius": "999",
        "btn_style": "solid"
      }
    },
    { "kind": "footer", ... }
  ]
}
```

**Correct shape — `blog_post`:**
```jsonc
{
  "sections": [
    { "kind": "header", ... },
    { "kind": "raw", "type": "blog_post_body", "name": "Blog post body (dynamic)", "settings": { ...brand colors... } },
    { "kind": "footer", ... }
  ]
}
```

**Correct shape — `library`:**
```jsonc
{
  "sections": [
    { "kind": "header", ... },
    { "kind": "content", "name": "Library hero", "blocks": [/* "Welcome back" header copy only */] },
    {
      "kind": "raw",
      "type": "products",
      "name": "Products (dynamic)",
      "settings": { "layout": "12", ...brand colors... }
    },
    { "kind": "footer", ... }
  ]
}
```

**Always pass branded `settings` on the raw section** so Kajabi's dynamic content matches the rest of the site — at minimum `background_color`, `text_color`, `btn_background_color`, `btn_text_color`, `btn_border_radius`, `btn_style`. Pull the values from the site's existing palette (audit other CTA blocks to match — see §4.7).

**Other Kajabi-dynamic pages — same rule, header/footer only (NO content sections at all):** `login`, `forgot_password`, `reset_password`, `register`, `thank_you`, `404`, `newsletter*`, `member_directory`, `announcements`, `blog_search`. Don't hardcode "recent posts", fake login screens, fake signup forms, "forgot password" forms, fake product grids, or any branded intro on these pages — Kajabi renders the form/content itself.

**🛑 AUTH PAGES — `login`, `register`, `forgot_password`, `reset_password` — ARE OFF-LIMITS.** These four pages are **non-composable** in Kajabi:
- `login.liquid` uses a built-in `{% section "login" %}` Kajabi section that's not editable through `settings_data.json`.
- `forgot_password.liquid` and `forgot_password_edit.liquid` (the "reset password" page) hardcode `{% include "block_password_reset" %}` / `{% include "block_password_edit" %}` — Kajabi renders the form itself.
- `register` doesn't exist as a template in the base theme at all — Kajabi handles signup on its own URL.

If you compose ANYTHING into `design.pages.login` / `register` / `forgot_password` / `reset_password` beyond header + footer, one of two things happens: (a) Kajabi ignores it and the expert sees the same default form, OR (b) your fake form/headline renders on top of Kajabi's real form, breaking the page. Either way the expert reports "the auth pages look broken."

**Correct shape — every auth page (`login`, `register`, `forgot_password`, `reset_password`):**
```jsonc
{
  "sections": [
    { "kind": "header", ... },
    { "kind": "footer", ... }
  ]
}
```

No "Welcome back" headline. No fake email input. No "Create your account" intro. No CTAs. Header + footer only. Brand the form indirectly via `themeSettings` (button colors, fonts) — that's how the form picks up the site's brand without you touching the page.

**Pre-flight check before saving any page named `blog`, `blog_post`, or `library`:** scan the page's `sections` array for any `card` block, any `feature` block carrying mock post/product data, or any `text` block whose HTML contains hardcoded post/lesson/product titles. If you find any, replace them with the correct `{ kind: "raw", type: "..." }` section before calling `update-site-design`. Never ship a site where the expert has to discover this themselves.

**Pre-flight check before saving any page named `login`, `register`, `forgot_password`, or `reset_password`:** the `sections` array MUST have length 2 (header + footer). If anything else is there, strip it before calling `update-site-design`.

### 4.11 NEVER put content on the `page` template — leave it empty (header + footer only)

The `page` template in Kajabi is a **per-product wrapper** — it's reused for every individual course/sales/landing page the expert publishes from inside Kajabi. Anything you compose into `design.pages.page` (a hero, a curriculum block, a testimonials section) gets injected into **every one of those product pages**, on top of whatever Kajabi is rendering for that specific product. The expert sees: "my course page has a different course's content showing above the real content."

**The rule:** `design.pages.page` MUST contain header + footer only. No content sections. No hero. No curriculum, testimonials, or CTAs. Kajabi handles the body of each product page entirely on its own.

**Correct shape — `page`:**
```jsonc
{
  "sections": [
    { "kind": "header", ... },
    { "kind": "footer", ... }
  ]
}
```

If the expert says "design the course page" or "build out the page template", they almost always mean a **specific page** (homepage, about, programs, a custom landing page) — confirm which one and edit that page key instead. Never interpret it as "fill in `design.pages.page`".

**Pre-flight check before saving:** if the page key being edited is `page`, the `sections` array must have length 2 (header + footer). If you've added anything else, remove it before calling `update-site-design`.

### 4.12 NEVER set `fullWidth: true` on a section unless explicitly asked

Kajabi's "Make section full width" toggle (`fullWidth: true` in our props → `full_width: 'true'` in `settings_data.json`) breaks the section's inner content out of the standard 1170px container so it spans the entire viewport edge-to-edge. This is **almost always wrong** for content sections (hero, features, CTAs, testimonials, copy blocks): on wide monitors the headline and paragraph stretch hundreds of characters wide and become unreadable; the layout looks unprofessional and amateur.

**The default is constrained.** Every `ContentSection` in a template MUST omit `fullWidth` (or set it to `false`) unless the expert **explicitly** asks for "full width", "edge to edge", "no margins", "full bleed", or describes a layout that obviously requires it (e.g. "an image gallery that touches both screen edges"). Phrases like "make it bigger", "make the hero feel premium", "more impactful", "more spacious" do **not** mean full width — they usually mean larger padding, bigger type, or a stronger background — never a content breakout.

This applies to:
- New templates being built from a prompt.
- Redesigns of existing sections.
- Any "make it more premium / more impactful / cleaner" pass.
- Sections with background images (the image already covers the viewport via `bg_image` + `background-size: cover`; `fullWidth` only affects the inner content column, not the image).

**Common confusion:** authors often think `fullWidth` controls whether the **background image** covers the full viewport. It does not. Background images already cover the full section width by default (per §4.8). `fullWidth` controls whether the **text/blocks inside** the section break out of the 1170px container — and stretching headlines + paragraphs to 2000px+ wide is what makes the page look broken.

**Pre-flight check before saving any template or page:** scan every `content` section's props. If `fullWidth: true` is set and the expert never asked for it, remove it. The Mastermind landing page hero is a real example of this bug — the hero text was set to full width and the headline spans the entire screen, making the layout feel unbalanced and unfinished.

### 4.13 NEVER include `©` or a year in footer copyright text

Kajabi's footer copyright snippet **automatically prepends `© <current year>`** to whatever string you put in the `copyright` block's text field. So if you write `"© 2026 Acme Coaching · All rights reserved"`, Kajabi renders `© 2026 © 2026 Acme Coaching · All rights reserved` — duplicate symbol, duplicate year, looks broken.

**The rule:** the `copyright` block's text MUST start directly with the brand/owner name or message, with no leading `©`, no leading year, no leading `Copyright`. Kajabi adds the prefix.

✅ **Correct:**
```ts
{ type: "copyright", props: { text: "Acme Coaching · All rights reserved" } }
{ type: "copyright", props: { text: "Jane Doe Studio" } }
{ type: "copyright", props: { text: "Built with care in Berlin" } }
```

❌ **Wrong:**
```ts
{ type: "copyright", props: { text: "© 2026 Acme Coaching" } }              // duplicate © and year
{ type: "copyright", props: { text: "© Acme Coaching" } }                    // duplicate ©
{ type: "copyright", props: { text: "Copyright 2026 Acme Coaching" } }       // "Copyright" + year duplicates the prefix
{ type: "copyright", props: { text: "2026 · Acme Coaching" } }               // duplicate year
```

**Pre-flight check before saving any page (especially footers):** for every `copyright` block, strip any leading `©`, `Copyright`, or 4-digit year from the text. The result should read naturally **after** Kajabi prepends `© 2026 ` to it.

### 4.14 When the expert attaches a real image in chat — upload it via `upload-site-image`

🚨 **This is a common silent failure.** When the expert drops a real photo into chat (their headshot, a logo, a product shot, a venue photo) and asks "use this in the hero" / "make this the about photo" / "replace the founder image with this", you receive it as a virtual `user-uploads://image-XX.png` path. **That path is NOT a public URL.** You cannot put it in `design` JSON, you cannot pass it to Kajabi, and the existing `generate-site-image` edge function only creates NEW images from a text prompt — it does not accept binaries.

If you skip the upload step and just write the hero JSON without a real `https://` URL, one of two things happens:
- You drop the image entirely → hero renders with no `backgroundImage` → expert sees a flat color where their photo should be.
- You write `{ slot: "x" }` pointing to a row that doesn't exist → renderer demotes to fallback color (§4.9) → expert sees a black/teal box.

Either way the expert reports: "the image I sent didn't show up."

**The correct flow — every time the expert attaches an image:**

1. **Read the bytes.** Copy the upload to a real path so you can read it from a script:
   ```bash
   code--copy user-uploads://image-89.png /tmp/upload.png
   ```
2. **Base64-encode and POST to `upload-site-image`** with the thin-client app token. Example one-shot Deno script:
   ```ts
   // /tmp/upload.ts — run with: deno run -A /tmp/upload.ts
   const SUPABASE_URL = "<from .env: VITE_SUPABASE_URL>";
   const APP_TOKEN = "<thin client app token — same one used for generate-site-image>";
   const SITE_ID = "<site uuid from /sites/:siteId>";

   const bytes = await Deno.readFile("/tmp/upload.png");
   // Chunked base64 encode (avoids stack overflow on large files)
   let bin = "";
   const CHUNK = 8192;
   for (let i = 0; i < bytes.length; i += CHUNK) {
     bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
   }
   const imageBase64 = btoa(bin);

   const resp = await fetch(`${SUPABASE_URL}/functions/v1/upload-site-image`, {
     method: "POST",
     headers: { "Content-Type": "application/json", "X-App-Token": APP_TOKEN },
     body: JSON.stringify({
       siteId: SITE_ID,
       imageBase64,
       mimeType: "image/png",   // or image/jpeg, image/webp, image/gif
       filename: "ashley-headshot.png",   // optional, for nicer object key
       alt: "Ashley Kumar, DPT",          // optional
     }),
   });
   if (!resp.ok) throw new Error(`Upload failed: ${resp.status} ${await resp.text()}`);
   const { url } = await resp.json();
   console.log("Public URL:", url);
   ```
3. **Wire the returned `url` directly into `design`** as a regular `https://` string on the relevant block/section prop (`backgroundImage`, `src`, `logoSrc`, etc.). Do NOT use `{ slot }` refs — there's no row to back them in thin-client mode (per §4.9 default to direct URLs).
4. **GET → mutate → POST the `design` via `update-site-design`** as usual (§3.1). Keep every other page intact.
5. **Tell the expert it's wired** and ask them to refresh the preview.

**Limits and constraints:**
- Max 10 MB decoded. If larger, ask the expert to compress/resize before re-uploading.
- Allowed mime types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`. Reject anything else (HEIC, SVG, PDF) and ask the expert to convert.
- The base64 string can include or omit the `data:image/png;base64,` prefix — the function handles both. Always pass `mimeType` explicitly when the prefix is omitted.
- The returned URL is a permanent public URL on the `site-images` bucket. Safe to store in `design` forever.

**When the expert attaches multiple images in one message:** upload them in parallel, then wire each one to its target slot. Confirm with the expert which image goes where if it isn't obvious from the message.

**Never:**
- Put `user-uploads://...`, `blob:`, `data:`, or `/src/...` paths in `design` JSON.
- Skip the upload and ask the expert to "host the image somewhere and paste a URL" — you have the upload function, use it.
- Use `generate-site-image` to "regenerate something similar" when the expert sent a real photo. The expert wants THEIR exact photo, not an AI guess.

### 4.15 PREFER native block button props over inline `<a>` baked into HTML

When a card-style block (`feature`, `pricing_card`, etc.) needs an "Explore →", "Learn more", "Read story", or any other call-to-action link, **use the block's native button props — never bake an `<a>` tag into the HTML `text` field**. Same lift-recurring-styles-into-the-template rule from §9.8e (PRO STYLING), applied at the block level.

**Why it matters:**
- Inline `<a class="button">` (or any styled inline link) bypasses Kajabi's global button system. The expert can't restyle it from the Style Guide, can't toggle uppercase, can't swap the dark/light pair, can't adjust padding/letter-spacing globally.
- Inline buttons are invisible to §4.7's "audit every CTA before changing one" pass — they don't show up as `cta` blocks or as native `feature` buttons in the design tree, so they silently drift out of brand consistency.
- For card grids, inline `<a>` "explore" links break Pro's per-block button overrides — no `btn_*` fields exist for the link, it's just HTML.

**The rule — every block type that exposes button props uses them:**

| Block | Native button fields | Set when you need a CTA |
|---|---|---|
| `feature` | `showButton`, `buttonText`, `buttonUrl`, `buttonStyle` (`solid`/`outline`/`text`), `buttonTextColor`, `buttonBackgroundColor`, `buttonBorderRadius`, `buttonSize`, `buttonWidth`, `newTab` | YES — Kajabi delegates to `block_cta` internally; full Pro button system applies |
| `pricing_card` | same shape (per its own button props — check the block) | YES |
| `text` | none — text blocks don't expose a button | Use a SIBLING `cta` block in the same section/column instead of inline `<a>` |
| `image` | `imageHref` covers click-the-image | Use a sibling `cta` block for any text CTA below the image |

**`buttonStyle: "text"` is the right choice for low-emphasis "Explore →" / "Read story" / "Learn more" links** that should look like a styled link, not a button. The `feature` block accepts it on Pro (`block_cta` renders the full text-link styling) and gracefully on Standard. Pair it with the site's accent color via `buttonTextColor` (e.g. gold `#A88251`) — and per §4.7, audit other "text" CTAs on the site to keep them all matching.

**Canonical pattern — service card with "Explore →" link:**

```jsonc
// ❌ Wrong — inline <a> baked into HTML, invisible to brand controls
{
  "type": "feature",
  "props": {
    "text": "<h3>Custom Kajabi Website Design</h3><p>...</p><p><a href=\"/services\" style=\"color:#A88251;text-decoration:none;border-bottom:1px solid #C9A96A;text-transform:uppercase;letter-spacing:0.16em;font-size:13px\">Explore →</a></p>"
  }
}

// ✅ Right — native button props, full Pro styling applies
{
  "type": "feature",
  "props": {
    "text": "<h3>Custom Kajabi Website Design</h3><p>A boutique, conversion-focused Kajabi site...</p>",
    "showButton": true,
    "buttonText": "Explore →",
    "buttonUrl": "/services",
    "buttonStyle": "text",
    "buttonTextColor": "#A88251",
    "buttonSize": "small"
  }
}
```

**When you MUST keep the link inline:** two genuine cases — (a) the link is a single word inside a sentence (e.g. "...read about our [process](/process)..."), or (b) multiple links in the same paragraph. Anything that visually reads as a standalone CTA at the bottom of a card belongs in the native button props.

**Pre-flight check on every site/section edit:** scan every `feature` / `pricing_card` block's `text` HTML for trailing `<p>...<a>...</a></p>` patterns or `<a class="button"...>` / `<a style="...border:1px..."...>` — these are inline buttons hiding in HTML. Lift each one into `showButton: true` + the relevant `button*` props, and strip the `<a>` from the HTML. Same for "stacked content" columns (§9.4a): if the bottom block of a stacked column is a `text` block whose HTML is just a styled `<a>`, replace it with a sibling `cta` block.

**Composing matters too** — once buttons are native, §4.7's "every CTA on the site looks consistent" rule kicks in automatically: all `feature` buttons on the site should share `buttonStyle`, `buttonTextColor`, `buttonSize`. Don't mix `buttonStyle: "text"` on some cards and `buttonStyle: "solid"` on others unless the visual hierarchy genuinely calls for it.

---

### 4.16 TEXT BUTTONS (`buttonStyle: "text"`) — color comes from the dark/light pair, NOT from `buttonTextColor`

🚨 **Verified gotcha — `block_cta.liquid` text-button branch is counterintuitive.** When `btn_style: "text"`, Pro takes the visible link color from the **dark/light button pair** (`btn_background_color` / `btn_text_color`) according to `btn_type`, NOT from a "text color" field. This is confusing because the field NAMED `btn_text_color` is the LIGHT half of the pair (per §9.8a), not "the text color of this button".

**The Liquid logic (verified in `snippets/block_cta.liquid` lines 181–211):**

```liquid
{% if btn_style == 'text' and btn_type == 'dark' %}
  /* color = btn_background_color  ← the DARK pair member */
{% endif %}
{% if btn_style == 'text' and btn_type == 'light' %}
  /* color = btn_text_color  ← the LIGHT pair member */
{% endif %}
```

**The rule (mnemonic):** for text buttons, **the color matches `btn_type`** —
- `btn_type: "dark"` (default) → text color = `buttonBackgroundColor` (the dark slot).
- `btn_type: "light"` → text color = `buttonTextColor` (the light slot).

`btn_type` defaults to `"dark"` per §9.8a, so **on a default text button the visible color comes from `buttonBackgroundColor`, NOT `buttonTextColor`**. Setting `buttonTextColor: "#A88251"` on a `buttonStyle: "text"` block is a silent no-op — the link renders in the body's default text color instead of your accent.

**Symptom:** the expert sees a text CTA in body color (often dark grey/black) instead of the brand accent you intended, even though `buttonTextColor` is clearly set in the design JSON.

**The fix — for text buttons, always set the accent on the slot that matches `btn_type`:**

```jsonc
// ❌ Wrong — silently no-ops for default (dark) text buttons
{
  "type": "feature",
  "props": {
    "showButton": true,
    "buttonText": "Explore →",
    "buttonStyle": "text",
    "buttonTextColor": "#A88251"   // not used by Kajabi for text+dark
  }
}

// ✅ Right — accent goes on buttonBackgroundColor (the dark slot)
{
  "type": "feature",
  "props": {
    "showButton": true,
    "buttonText": "Explore →",
    "buttonStyle": "text",
    "buttonBackgroundColor": "#A88251"  // text+dark uses this as the link color
  }
}

// ✅ Also right — explicitly light text button with accent on the light slot
{
  "type": "feature",
  "props": {
    "showButton": true,
    "buttonText": "Explore →",
    "buttonStyle": "text",
    "buttonType": "light",            // if/when block exposes this prop
    "buttonTextColor": "#FBF8F2"      // text+light uses this as the link color
  }
}
```

**Solid + outline buttons are unaffected — they keep the intuitive mapping** (`buttonBackgroundColor` = bg, `buttonTextColor` = text). This quirk is *only* on `buttonStyle: "text"`.

**Pre-flight check whenever you set `buttonStyle: "text"`:**
1. Decide whether the button is dark or light (default: dark).
2. Put the accent color on the slot matching that type — `buttonBackgroundColor` for dark, `buttonTextColor` for light.
3. Leave the OTHER slot empty (`""`), or — if you also want a working solid/outline variant for the same brand — fill both pair members consistently sitewide.
4. If you're auditing existing text buttons (per §4.15 lift pass), check both fields: a text button with `buttonTextColor` set but `buttonBackgroundColor` empty is silently broken on Pro — swap them.

**Why this exists:** Pro's button system is designed around picking ONE brand pair sitewide (per §9.8a) and letting each button choose which pair member to show. For text buttons specifically, "which color shows" follows `btn_type` directly because there's no background/border to occupy the other slot — the entire button IS just the colored text. So the slot whose name matches the type is the one you see.

---

### 4.17 `feature` block `imageWidth` defaults too small for service-card layouts

🚨 **Recurring "the images are still small" complaint.** The `feature` block's `imageWidth` prop defaults to a value (~`100`) that's appropriate for tiny inline icons (like a checkmark next to a feature bullet), NOT for the **service-card / offering-tile** layout where each card has a hero photo above the title + body. Set to `100` on a 3-up service grid, the photos render as ~100px-wide thumbnails floating in a sea of card padding — the expert reports "the images are tiny" repeatedly until the value is large enough.

**The rule — pick `imageWidth` based on what the image is doing in the card:**

| Image role in the `feature` block | `imageWidth` value |
|---|---|
| Tiny icon next to a feature bullet (16–32px target) | `"32"` – `"64"` |
| Inline icon above a short label | `"80"` – `"120"` |
| **Service / offering / program card hero photo** (3-up or 4-up grid) | **`"320"` – `"480"`** (or omit entirely → image fills card width) |
| Full-width photo on a 2-up split feature | `"560"` or omit |

**Best default for service cards: omit `imageWidth` entirely.** When the prop is empty/absent, the image fills the card's content width naturally — which is almost always what you want for hero-style card photos. Only set an explicit `imageWidth` when you need to clamp the image SMALLER than the card (icon mode).

**Symptom mapping — when the expert says any of these, check `imageWidth` FIRST before assuming a deeper bug:**
- "the service card images are tiny / small / too small"
- "the images aren't filling the card"
- "the photos look like postage stamps"
- "make the images bigger" (after you've already adjusted the section padding/columns)

**Pre-flight check whenever you build a card grid using `feature` blocks with photos** (vs icons): for every `feature` block with `image` set and `imageWidth` set to anything `< 200`, either bump it to `"320"` or remove `imageWidth` entirely. Don't ship service grids with thumbnail-sized hero photos.

**Why this exists:** the `feature` block was originally designed as a "feature bullet" pattern (icon + text), and the default `imageWidth` reflects that. It's now overloaded as the canonical "card with photo" block too, but the default never moved. Until/unless we ship a separate `service_card` block or change the default, **the AI must override `imageWidth` for any photo-bearing card layout.**

---

### 4.18 Preview ↔ Kajabi shadow parity (verified 2026-04)

The engine's `SHADOW_MAP` in `packages/engine/src/blocks/blockChrome.ts` MUST emit Kajabi's exact `box-shadow-{small|medium|large}` class values from `streamlined-home(-pro)/assets/styles.scss.liquid` lines 3052–3070:

- `small`: `0 2px 10px 0 rgba(0, 0, 0, 0.05)`
- `medium`: `0 4px 20px 0 rgba(0, 0, 0, 0.075)`
- `large`: `0 10px 40px 0 rgba(0, 0, 0, 0.1)`

These are SINGLE soft shadows, not double-layered Material-style shadows. If you change them to "look better" you'll silently desync the editor preview from the live Kajabi render. Symptom: accordion/card edges look heavier, sharper, or more dramatic in the preview than in the exported site. Whenever the expert reports "the shadow doesn't quite match what shipped", check this file first.

If Kajabi ever updates these class values in a future base-theme version, re-extract from the current zip and update `SHADOW_MAP` in lockstep.

### 4.19 PricingCard auto-themes for dark surfaces (verified 2026-04)

`packages/engine/src/blocks/components/PricingCard.tsx` ships an `isDarkColor(hex|rgba)` helper that calculates luminance from the card's background and toggles:
- `ink` → light (`#F4ECDC`) on dark surfaces, dark (`#111`) on light
- `muted` → matching translucent

Without this branching, dark-surface tier cards (e.g. a brand-color middle tier in a 3-up pricing grid) render black bullets/checkmarks/body copy on a near-black background — invisible. Same with the button: the outline branch MUST set `backgroundColor: 'transparent'` + `border: '1.5px solid {buttonBackground}'`, NOT default to a solid fill.

`PricingCardProps` includes `buttonStyle: 'solid' | 'outline' | 'text'` and `buttonBorderRadius`. Always persist these on every `pricing_card` block in `design`, especially when authoring multi-tier grids where the highlighted tier inverts the palette. If the bullets/CTAs disappear on the highlighted tier, the regression is in the `isDarkColor` branch or the outline button renderer.

### 4.20 Slider `transitionEffect: "fade"` stacks all blocks regardless of `blocksPerSlide`

Swiper's `fade` effect crossfades between full-width slides — `blocksPerSlide` is effectively forced to 1 even if you set 3. Symptom: a testimonial slider with `blocksPerSlide: 3` + `transitionEffect: "fade"` shows ONE testimonial at a time, looking broken next to a sibling slider with the same `blocksPerSlide: 3` + `slide` effect that correctly renders 3-up.

**Rules:**
- Want a multi-up grid carousel → `transitionEffect: "slide"` (default) + `blocksPerSlide: 3` (or whatever).
- Want fullscreen testimonial crossfade → `transitionEffect: "fade"` + `blocksPerSlide: 1`.
- Never mix `fade` with `blocksPerSlide > 1` — the value is silently ignored and the section looks broken.

Also: Pro's `section.liquid` forgets to set `fadeEffect.crossFade: true`, so even valid fade sliders need the CSS workaround that `export.ts` auto-injects when any section uses `transition_effect: "fade"`. Don't disable that workaround.

### 4.21 Slider prop shorthand aliases — write the canonical name

The engine accepts both shorthand (`blocksPerSlide`, `autoplay`, `loop`, `transitionEffect`, `transitionSpeed`) and canonical (`slidesPerViewDesktop`, `sliderAutoplay`, `sliderLoop`, `sliderTransition`, `sliderSpeed`) names — both `renderSlider` (in `sections.tsx`) and the serializer normalize via nullish coalescing. **Prefer the canonical name** in new code so future devs reading the JSON aren't confused; the shorthands exist only because legacy site data uses them.

If you're adding a NEW slider prop, register both the alias and the canonical name in `sections.tsx → renderSlider` AND `serialize.ts` simultaneously — a missed alias silently falls back to a 1-per-slide, autoplay-off slider. See `mem://reference/slider-prop-shorthand-aliases.md`.

---


## 5. How to talk to the expert

The expert is a **subject-matter expert**, not a developer. They do not know:
- what JSON, a "block", a "section", a "slot", or a "page key" is
- how the codebase is organized
- what files exist
- the difference between "writing a script" vs "adding a button" vs "editing the baseline"

### 5.1 NEVER ask the expert implementation questions

❌ **Forbidden:** asking the expert to choose between things like:
- "Should I write a one-time script, add a button to the editor, or edit the baseline?"
- "Should I update the hero in the database directly or in `blank.ts`?"
- "Which page key should I edit?"
- "Do you want a script or a UI fix?"

These are YOUR decisions. The answer is almost always: **edit this site's `design` JSON in the database, right now.**

### 5.2 Ask the expert ONLY about their content and taste

✅ **Good questions:**
- "Should the hero feel rugged or refined?"
- "What's the one-line promise on the homepage?"
- "Three pricing tiers or two?"
- "Pick one: warm earth tones, cool monochrome, or bold high-contrast."

### 5.3 Default to doing the work

Before asking anything, inspect what's already there:
- Read the site row from the DB (`SELECT design FROM sites WHERE id = ...`)
- Look at the current sections on the page being changed
- Make the change you think is best
- Show the expert the result

They will react. That's faster than a Q&A.

---

## 6. How to handle common requests

| Request | What you do |
|---|---|
| "Redesign the hero" | Load site, replace the hero section in `design.pages.<page>.sections[N]`, save. Generate a new image if needed. |
| "Make it feel more premium" | Adjust fonts, spacing, colors, copy, imagery in `design`. Save. |
| "Add an About page" | Add a new entry to `design.pages` and append the key to `design.pageKeys`. Save. |
| "Rewrite the copy" | Update the relevant block `text` / `label` / `html` props in `design`. Save. |
| "Generate a mountain hero image" | Call `generate-site-image`, wire the resulting URL into the hero block (or assign slot `hero` and reference it). Save. |
| "Fix this layout/visual issue on my site" | Edit `design`. Save. |
| "Change the editor UI / dashboard" | Only if the operator explicitly asks. |
| "Add a database table / edge function / change auth" | Only if the operator explicitly asks. |

---

## 7. Golden rule

> **The expert's site lives as JSON in the database. To change the site, change the JSON and save it. Don't ask permission, don't propose architectures, don't build UI to avoid doing the work — just make the edit.**

When in doubt, ask yourself:
**"Is this a site-content change (edit `design` JSON) or a shared-platform change (escalate to operator)?"**

If it's site content → edit the JSON, save to DB, done.
If it's shared platform → pause and tell the operator.

---

## 8. Syncing engine fixes from master (operator-triggered)

Master (`@kajabi-studio-max`) ships ongoing fixes to the export pipeline, preview renderer, block components, and editor shell. Thin clients are **frozen at the version they were forked from** — they do NOT auto-update. When the operator pastes a message containing the literal phrase **"sync from master"** (or "pull from master", "update engine from master"), this is a deliberate operator override of §4.2's "do not modify shell code" rule, and you SHOULD perform the sync.

### 8.1 What to sync

Pull these files verbatim from `@kajabi-studio-max` into the thin client. They are the entire app shell + engine layer; site content lives in the database and is unaffected.

**Engine + blocks (export pipeline):**
- `src/blocks/index.ts`
- `src/blocks/export.ts`
- `src/blocks/serialize.ts`
- `src/blocks/sections.tsx`
- `src/blocks/RawSection.tsx`
- `src/blocks/BlockWrapper.tsx`
- `src/blocks/blockChrome.ts`
- `src/blocks/blockDefaults.ts`
- `src/blocks/types.ts`
- `src/blocks/components/**` (every file)
- `src/engines/**` (every file)

**Site rendering:**
- `src/lib/siteDesign/types.ts`
- `src/lib/siteDesign/render.tsx`
- `src/lib/siteDesign/blank.ts`
- `src/lib/siteDesign/landingPageBlank.ts`
- `src/lib/siteStore.ts`
- `src/lib/imageStore.ts`

**Editor shell + preview:**
- `src/pages/SiteEditor.tsx`
- `src/pages/SitesDashboard.tsx`
- `src/pages/LandingPagesDashboard.tsx`
- `src/components/SitePreview.tsx`
- `src/components/AppHeader.tsx`
- `src/App.tsx` (routes — `/sites`, `/landing-pages`, `/sites/:id`)

**Type contracts (read-only at the type level but ship the file):**
- `src/types/assets.ts`
- `src/types/schemas.ts`

**Base theme assets (Pro variants — added 2026-04):**
- `public/base-theme/streamlined-home.zip`
- `public/base-theme/streamlined-home-pro.zip`
- `public/base-theme/encore-page.zip`
- `public/base-theme/encore-page-pro.zip`

### 8.2 What NOT to sync

- `src/integrations/supabase/types.ts` — auto-generated per project, leave alone.
- `src/integrations/supabase/client.ts` — auto-generated per project, leave alone.
- `.env`, `supabase/config.toml`, `supabase/migrations/**` — managed by the platform.
- `supabase/functions/**` — edge functions are deployed from master and shared; thin clients should never touch them.
- `AGENTS.md` itself — re-sync this file separately and ONLY if the operator explicitly says **"also sync AGENTS.md"** (as part of a full master sync) OR **"sync AGENTS.md from master"** / **"sync agents from master"** (standalone, no engine sync). The standalone phrasing is the fast path when only the guide changed (e.g. a new section like §4.14 was added) and the engine + edge functions are already current. When you see a standalone trigger: read `AGENTS.md` from project `kajabi-studio-max` (ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`) via `cross_project--read_project_file`, overwrite the local file, and report back with a one-line summary of what changed (diff the new sections against the old). Do NOT touch any other files. Do NOT run a full §8.1 sync.
- Anything outside the lists in §8.1.

### 8.3 How to do it

For each file in §8.1:
1. `cross_project--read_project_file` from project `kajabi-studio-max` (project ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`).
2. Overwrite the local file with `code--write` (or skip if the file doesn't exist locally — that means master deleted it, delete it locally too with `code--delete`).
3. Batch reads in parallel where possible.

After syncing, run `tsc --noEmit` (or just rely on Vite's HMR) to catch any drift between the synced engine code and a thin-client-specific tweak that may have been made. If something doesn't compile, **stop and tell the operator** — do NOT silently patch master code to fit a local hack.

### 8.4 Reporting back

When done, tell the operator exactly which files changed and which were already up-to-date. Example: "Synced 14 files from master (8 in `src/blocks/`, 4 in `src/engines/`, 2 in `src/lib/siteDesign/`); 6 files were already current."

### 8.5 What this fixes

This sync is what propagates master-side fixes for: export pipeline bugs (e.g. external background-image URL mangling), preview rendering bugs (font loading, column gutters, heading-descendant fonts), block component bugs, and editor UI improvements. If the expert reports "this looked fine in the preview but broke after export" or "the preview doesn't match Kajabi", the first thing to try after reading the relevant code is asking the operator if a master sync is overdue.

### 8.6 Landing pages (added 2026-04)

The `sites` table has `kind` (`'site'` | `'landing_page'`) and `slug` columns. After a master sync, the thin client gains a **Landing pages** tab (`/landing-pages`) alongside **Sites**. `listSites(kind)` filters by kind so the two dashboards stay separate. Landing pages are single-page sites (`index` only) with a logo-only header and copyright-only footer; the slug becomes the public URL path on Kajabi.

**Base theme:** sites with `kind === 'landing_page'` export against Kajabi's **`encore-page`** base theme — a dedicated single-template landing-page theme that ships only `templates/index.liquid` (no `layouts/`, no `about`/`blog`/`library` etc.). Sites with `kind === 'site'` continue to export against `streamlined-home`. The branch happens in `SiteEditor.tsx` (`baseTheme: site.kind === 'landing_page' ? 'encore-page' : 'streamlined-home'`) and is plumbed through `exportFromTree` → `exportThemeZip` → `loadBaseThemeZip(baseTheme)`. Both base zips live in `public/base-theme/`. The block/section schema is identical between the two themes (same `block_text`, `block_cta`, `block_image`, `block_feature` snippets), so no per-block code changes are needed — only the underlying zip differs.

If a thin client hasn't been synced yet, RLS still scopes `sites` by user, so other users' landing pages won't leak in — but if the operator creates a landing page on behalf of an unsynced expert, that landing page will appear mixed into the expert's sites list until the sync lands. Sync sooner rather than later for any expert who will use landing pages.

The `get-site-design` and `update-site-design` edge functions return/accept `kind` and `slug`. Thin clients can read them after sync; they cannot mutate `kind` (set at creation), but they can update `slug` by passing it in the `update-site-design` body.

### 8.7 Targeted "sync only landing pages" (faster than full §8.1)

A full §8.1 sync takes a while. When the operator only needs to pick up the landing-pages feature on a thin client, they can paste this exact phrase instead:

> **"sync landing pages from master"**

When you (the thin-client AI) see that phrase, sync ONLY these files from `kajabi-studio-max` (project ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`), in parallel:

- `src/lib/siteStore.ts` — adds `kind`, `slug`, `listSites(kind)`, `createLandingPage`, `slugify`
- `src/lib/siteDesign/landingPageBlank.ts` — **NEW** file (single-page baseline)
- `src/pages/SitesDashboard.tsx` — **unified workspace dashboard** with two tabs (Websites / Landing pages), per-user "Set as default" pin (localStorage-scoped by user id, UI-pref only — no site data), and a single "New ▾" button with two options
- `src/pages/LandingPagesDashboard.tsx` — **NEW** file (kept for back-compat — no longer routed; the unified dashboard at `/` replaces it)
- `src/pages/SiteEditor.tsx` — slug field, hides page selector for landing pages, branches `baseTheme` on `site.kind`
- `src/components/AppHeader.tsx` — nav tabs removed (everything's on one page now); brand mark routes to `/`
- `src/App.tsx` — `/landing-pages` is now a redirect to `/`
- `src/blocks/export.ts` — adds `baseTheme` to `ExportFromTreeOptions`
- `src/engines/exportEngine.ts` — adds `ExportThemeZipOptions.baseTheme`, branches `loadBaseThemeZip` on theme
- `src/engines/baseThemeValidator.ts` — multi-theme cache + `BaseThemeName` type
- `public/base-theme/encore-page.zip` — **NEW** asset (Kajabi encore-page base theme)

Skip everything else in §8.1. Skip type-checking unrelated areas. After writing the files, tell the operator: "Landing pages synced — 11 files updated. After a hard refresh, the workspace at `/` shows two tabs (Websites / Landing pages), a single 'New ▾' button to create either, and a 'Set as default' pin so each user can choose which tab opens first."

If `tsc --noEmit` flags an error in a file you didn't sync, that means the engine is also out of date and the operator should run a full **"sync from master"** afterwards. Don't try to patch the error locally.


### 8.8 Targeted "sync base themes from master" (Pro template plumbing)

When the operator pastes the literal phrase **"sync base themes from master"** (or **"sync pro themes from master"**), this is a fast path for picking up just the Pro template plumbing without re-syncing the entire engine. Sync ONLY these files from `kajabi-studio-max` (project ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`), in parallel:

- `public/base-theme/streamlined-home.zip` — Standard website base theme
- `public/base-theme/streamlined-home-pro.zip` — **Pro** website base theme (sliders, animations, extra blocks)
- `public/base-theme/encore-page.zip` — Standard landing page base theme
- `public/base-theme/encore-page-pro.zip` — **Pro** landing page base theme (full Kajabi feature set)
- `src/engines/baseThemeValidator.ts` — `BaseThemeName` union + URL map (now 4 themes)
- `src/lib/siteStore.ts` — `base_theme` field on `Site`, `resolveBaseTheme(site)` helper
- `src/pages/SitesDashboard.tsx` — Standard / Pro toggle in create modals
- `src/pages/SiteEditor.tsx` — passes `resolveBaseTheme(site)` to `exportFromTree`

**About the `base_theme` column:** the `sites` table has a nullable `base_theme TEXT` column with a check constraint allowing `streamlined-home`, `streamlined-home-pro`, `encore-page`, `encore-page-pro`. Legacy sites (NULL) fall back to the Standard theme matching their `kind` via `resolveBaseTheme(site)`. The choice is locked at site creation — there is **no editor-side dropdown** to change it later (would silently break sites that depend on Pro-only blocks/fields).

**About Pro-only blocks/fields:** the Pro themes ship additional snippets (`block_feature_icon`, `block_code_tabs`, `block_search_filter`, `column_*_slider`) and ~50 extra section-level fields (sliders, scroll animations, advanced borders). These are **additive only** — every existing Standard block/field renders identically in Pro. Sites built for Standard can be safely re-exported against Pro without changes. **See §9 below for the full Pro-only catalog** (verified field IDs, override sentinels, font/CSS-class behavior) — required reading before composing Pro-specific blocks. Master also keeps the same content at `mem://reference/pro-template-capabilities.md`.

After syncing, tell the operator: "Base themes synced — 8 files updated. Standard and Pro variants now available for both Websites and Landing pages, selected at site creation."

### 8.9 Targeted "sync shell from master" (visual app shell only)

Master ships ongoing visual/UX polish to the thin-client app shell — header, dashboard, editor chrome, preview chrome, fonts, design tokens, routing. When the operator wants every thin client to **look and feel identical** to the latest master without disturbing the engine, edge functions, or block library, they paste the literal phrase:

> **"sync shell from master"**

When you (the thin-client AI) see that phrase, sync ONLY these files from `kajabi-studio-max` (project ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`), in parallel:

**App shell + chrome:**
- `src/components/AppHeader.tsx` — top bar, brand mark, user menu, admin link
- `src/components/SitePreview.tsx` — preview iframe + scoped CSS isolation
- `src/pages/SitesDashboard.tsx` — unified workspace dashboard (tabs, cards, "New ▾")
- `src/pages/SiteEditor.tsx` — editor shell (page selector, slug field, export button)
- `src/pages/LandingPagesDashboard.tsx` — back-compat redirect target
- `src/App.tsx` — routes
- `src/main.tsx` — providers, mount

**Design tokens + global styles:**
- `src/index.css` — CSS variables, base styles, font-face declarations
- `tailwind.config.ts` — design system tokens (colors, fonts, spacing)
- `index.html` — `<title>`, font `<link>` tags, viewport meta

**Shared UI primitives the shell depends on (only if they exist on master):**
- `src/components/ui/**` — shadcn primitives if master has updated variants

**What this sync does NOT touch (use other targeted syncs or full §8.1 for these):**
- `src/blocks/**` — block components and serializer (use full sync)
- `src/engines/**` — export pipeline (use full sync)
- `src/lib/siteDesign/**` — render engine + types (use full sync)
- `src/lib/siteStore.ts`, `src/lib/imageStore.ts` — data layer (use full sync)
- `supabase/functions/**` — edge functions (never sync; deployed from master)
- `public/base-theme/*.zip` — base themes (use §8.8 instead)
- `src/integrations/supabase/**`, `.env`, `supabase/config.toml` — auto-generated, never sync

**How to do it:**
1. For each file in the lists above, `cross_project--read_project_file` from project `kajabi-studio-max` (ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`).
2. Overwrite the local file with `code--write` (or skip if master no longer has it — delete locally too).
3. Batch reads in parallel.
4. **Preserve thin-client-specific values where present:** if `AppHeader.tsx` on master references "Kajabi Studio Max" branding, leave the thin client's brand label intact (most thin clients have already been rebranded — e.g. "Studio Pro"). Diff the file before overwriting; if the only difference is the brand string, keep the thin-client string. The point of this sync is **visual parity**, not branding override.

**Reporting back:** "Shell synced — N files updated. Header, dashboard, editor, preview chrome, design tokens, and global styles now match master. Brand label preserved as `<thin client brand>`. Hard refresh to pick up the new styles."

If `tsc --noEmit` flags an error after the sync, the engine is also out of date — tell the operator to follow up with a full `"sync from master"`.


---

## 9. Pro template capabilities (inline reference for thin clients)

> This section mirrors `mem://reference/pro-template-capabilities.md` on master. It lives in `AGENTS.md` so every thin client gets it via "sync AGENTS.md from master" — thin clients cannot read master memory files. Keep the two in sync: when you update one, update the other.

### 9.0 When this applies

A site uses a Pro theme when `resolveBaseTheme(site)` returns `streamlined-home-pro` or `encore-page-pro`. Otherwise Pro-only blocks/fields are **silently dropped** by Kajabi. **NEVER use Pro blocks/fields on a Standard site.** Always check `site.base_theme` before composing Pro features.

Standard ↔ Pro is **additive only**: every Standard block/field renders identically in Pro. A Standard site can be safely re-exported against Pro without changes.

### 9.1 Pro header (Full-Time Hamburger / FTH)

Section-level toggle: `collapsed: true` (a.k.a. "Full-time hamburger menu") forces the mobile slide-in panel to also show on desktop. Identical behavior on both — slide-in from the right. Composes with overlay/sticky modes (still don't enable those unless explicitly asked, per §4.4). Knobs: `fth_menu_text_color`, `fth_menu_background_color`, `fth_close_button_color` (`dark`/`light`), `hamburger_icon_color`. Optional — leaving it off keeps the standard horizontal nav.

### 9.2 Pro footer (`footer_pro`)

A separate section type that exists alongside the standard footer for back-compat. **Mutual exclusion is author-managed** via per-section visibility toggles — both footers expose `Hide on Desktop` + `Hide on Mobile` fields under their Desktop/Mobile groups. **There is no theme-level "use_pro_footer" switch.** When emitting a Pro site that uses `footer_pro`, the serializer MUST also flip the standard footer's hide-on-desktop + hide-on-mobile to `true` (otherwise both render and the visitor sees two stacked footers).

`footer_pro` accepts ALL block types (not just the standard 5). Adds full section-level controls (padding, alignment, border, bg, 12-col grid) and a merged copyright + Powered-by-Kajabi mode.

### 9.3 Pro slider (any section, any blocks)

Section-level toggle: `enable_slider: true` turns the section's blocks into a Swiper carousel. Works with any block type. **Field IDs and defaults verified against `streamlined-home-pro/sections/section.liquid` + `snippets/column_one_slider.liquid` (also `_two`/`_three` — identical).**

**Schema fields (visible in Kajabi UI):**
- `blocks_per_slide` (range 1–12, default `3`) — desktop only. **Mobile is hardcoded to 1 in Liquid (`blocks_per_slide_mobile = 1`); there is NO `blocks_per_slide_mobile` setting.** Don't expose a mobile knob — it can't reach Kajabi.
- `hide_overflow` (checkbox, default `true`) — clips slides that would bleed past the section padding.
- `slider_preset` (select, default `"modern"`) — options: `"default"` (Classic: centered dots + arrows) and `"modern"` (dots bottom-left, arrows bottom-right, on one line below the slider). **This is the ONLY field controlling dot/arrow alignment** — there are no separate `dot_align` / `arrow_align` / `arrow_position` fields.
- `show_arrows` (default `true`), `arrow_color` (default `#333333`), `arrow_slider_margin` (range 0–50, default `0`).
- `show_dots` (default `true`), `dot_color` (default `#333333`).
- `transition_effect` (select, default `"slide"`) — **schema only exposes `slide` + `coverflow`**, but the runtime Swiper config whitelists `slide / fade / cube / coverflow / flip`. We support all 5 in serialization (Kajabi runtime accepts them even though the UI doesn't list them).
- `transition_speed` (range 100–3000, default `500`).
- `autoplay` (default `false`), `autoplay_delay` (range 500–10000, default `3000`).
- `loop` (default `false`).
- `block_offset` (range 0–20, default `0`) — N leading blocks kept OUTSIDE the slider but inside the section. **Field ID is `block_offset`, NOT `block_offset_before`.**
- `block_end_offset` (range 0–20, default `0`) — N trailing blocks. **Field ID is `block_end_offset`, NOT `block_offset_after`.** Canonical use: `block_offset: 1` to keep a heading text block above the carousel in the same section.

**Hidden settings referenced in CSS but NOT in the schema** (no Kajabi UI exposes them; they fall back to defaults via Liquid `| default:`):
- `arrow_size` (default `32px`) — font-size of the arrow button container.
- `dot_size` (default `10px`), `dot_margin_top` (default `20px`).
- `space_between_slide_blocks` (default `0`) — desktop gap between slides.
- `space_between_slide_blocks_mobile` (default `0`) — mobile gap.

We expose `spaceBetweenDesktop` / `spaceBetweenMobile` props in the React layer and serialize to these hidden fields — Kajabi reads them at runtime even though no UI sets them. The other hidden fields (`arrow_size`, `dot_size`, `dot_margin_top`) we don't expose — defaults are fine.

**Arrow markup (fixed, NOT customizable per-section):** Pro renders chevrons as inline SVG polylines, not Swiper's native font glyphs. The exact markup from `column_one_slider.liquid`:
```html
<div class="slider-arrows" aria-label="Slider navigation">
  <div class="swiper-button-prev swiper-button-prev-{{section.id}}">
    <span class="slider-arrow-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <polyline points="15 18 9 12 15 6" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </div>
  <div class="swiper-button-next swiper-button-next-{{section.id}}"> <!-- next polyline points: "9 18 15 12 9 6" --> </div>
</div>
```
Section CSS explicitly suppresses Swiper's default `::after` glyphs with `content: none !important;`. **Earlier guidance suggested arrows accept "custom SVG (paste icon SVG for prev/next)" — that was wrong, no such field exists.** Our preview in `src/blocks/sections.tsx` mirrors this exact markup.

**Runtime quirks:**
- The slider script re-initializes on `DOMContentLoaded`, the custom `section:load` event, and a debounced MutationObserver — necessary so sliders inside tabs (§9.5) rebuild when their tab becomes visible.
- The `data-effect` attribute is read fresh on each init; `fadeEffect.crossFade` is NOT set in Pro's runtime config (this is the bug `mem://reference/kajabi-fade-slider-bug.md` works around — the exporter auto-injects CSS when any section uses `transition_effect: "fade"`).

**Composition with Pro columns:** when a section has `columns: 2` or `columns: 3` (§9.4), an extra `slider_column` setting (`first` / `second` / `third`, default `first`) picks which column hosts the slider — only that column's blocks become slides; the other columns render normally.

**Mandatory authoring rules:**
- Use `block_offset: 1` to keep a heading text block grouped with the carousel — never put the heading in a separate section.
- Default `slider_preset` to `"modern"` to match Kajabi's UI default.
- Don't set per-section `arrow_color` / `dot_color` randomly — pull from `themeSettings.color_button` or `color_primary` so all sliders on a site match.

### 9.4 Pro columns (2 or 3 per section)

Section-level: `columns: 2` or `columns: 3`. Per-section — every section can have its own config. Per-column width via 12-col grid (e.g. 6/6, 9/3, 4/4/4) — must sum to 12. Per-block `column: 1 | 2 | 3` assignment (defaults to 1). **Block width inside a column** uses the block's own `width: "12"` to fill (block width is RELATIVE to the column, not the page). Multiple blocks in the same column stack vertically in array order. `column_gap` in px. Sliders work INSIDE a column. Mobile collapses 1 → 2 → 3 automatically.

#### 9.4a Vertical block stacking inside a column (THE Pro columns superpower)

The biggest reason to reach for Pro columns over the standard 12-col grid is **vertical stacking of multiple block types inside a single column**. The standard grid only places blocks side-by-side in one row; Pro columns let you stack heterogeneous blocks (text → stats → CTA → image → accordion → whatever) within a column, while still controlling each one independently.

**How it works:** every block in a section carries an optional `column: 1 | 2 | 3`. The serializer + preview group blocks by that value and render each group as its own vertical stack inside the corresponding column. Order within a column = order in the `blocks` array. There is no nesting — you do NOT wrap blocks in a "column container" block; you just tag each block with which column it belongs to.

**Canonical pattern — image left, stacked content right (intro + stats + CTA):**

```jsonc
{
  "kind": "content",
  "name": "Built for online business",
  "props": {
    "columns": 2,
    "columnWidths": [6, 6],
    "columnGap": 48,
    "vertical": "center"
  },
  "blocks": [
    // Column 1 — single image, fills its column
    { "type": "image", "props": { "column": 1, "colWidth": "12", "src": "https://...", "alt": "..." } },

    // Column 2 — three blocks stacked vertically
    { "type": "text", "props": { "column": 2, "width": "12", "align": "left",
        "text": "<p style='...eyebrow...'>Why Kajabi</p><h2>Built for the experts...</h2><p>...body copy...</p>" } },

    { "type": "text", "props": { "column": 2, "width": "12", "align": "left",
        "text": "<div style='border-top:1px solid #D8C9B0;padding-top:28px;margin-top:36px;display:flex;gap:40px;'>...stats...</div>" } },

    { "type": "cta", "props": { "column": 2, "width": "12", "align": "left",
        "buttonText": "Start Your Project", "buttonUrl": "/contact",
        "buttonStyle": "solid", "buttonBackgroundColor": "#2A211B", "buttonTextColor": "#FBF8F2", "buttonBorderRadius": "2",
        "padding": { "top": "32", "right": "0", "bottom": "0", "left": "0" } } }
  ]
}
```

**Authoring rules for stacked columns:**

1. **Use it instead of cramming everything into one giant text block.** If you find yourself writing one `text` block whose HTML contains a heading + body + a stats grid + a styled `<a>` button, split it into 2–4 blocks tagged to the same `column`. Stats become their own `text` block; the CTA becomes a real `cta` block (so it inherits the brand button system per §4.7 and §9.8a).
2. **`width: "12"` on every block in the same column.** Block width is RELATIVE to the column, not the page. `width: "6"` inside a column makes the block half-fill that column (rarely what you want when stacking).
3. **Vertical spacing between stacked blocks** comes from each block's own chrome `padding` (object form per §4.7's padding rule — `{ top, right, bottom, left }`, never scalar) or inline `margin-top` in the block's HTML. There is no built-in "row gap" between stacked blocks.
4. **Mix block types freely.** A column can hold `text + cta + image + accordion + feature` stacked in order. The grouping is purely by the `column` prop — type doesn't matter.
5. **Empty columns are valid.** A 3-column section can leave column 2 empty and put blocks only in 1 and 3 — Kajabi renders the empty column as whitespace. Useful for asymmetric reading layouts.
6. **Match the CTA to the rest of the site (§4.7).** When you split a baked-in `<a>` button out of HTML into a real `cta` block, audit existing CTAs and copy their `buttonBackgroundColor` / `buttonTextColor` / `buttonStyle` / `buttonBorderRadius` exactly. Don't introduce a new variant.
7. **Vertical alignment** is set on the SECTION (`vertical: "top" | "center" | "bottom"`) and applies to how the columns align relative to each other — not how stacked blocks align inside a column. Inside a column, blocks just flow top-to-bottom.

**When to reach for stacked columns vs other patterns:**

| Layout intent | Use this |
|---|---|
| Image left, headline+body+stats+CTA right (canonical hero/about split) | Pro columns 6/6, stack text+text+cta in column 2 |
| Three feature cards in a row, each with icon+title+body+button | Standard 12-col grid with `feature` blocks (no Pro needed) |
| Sidebar filter + product grid | Pro columns 3/9, search/filter blocks in column 1, products in column 2 |
| Hero with badge above headline above two CTAs | Single column, stack badge+text+cta+cta blocks |
| Pricing table with three tiers, each tier has heading+price+bullet list+CTA | Pro columns 4/4/4, stack text+text+text+cta in EACH column |

**Anti-pattern — DON'T do this:**

```jsonc
// ❌ One massive text block doing everything inline.
// Lose: brand CTA system, semantic structure, ability to A/B copy independently,
// Kajabi's per-block editor controls.
{ "type": "text", "props": { "column": 2, "text":
  "<h2>...</h2><p>...</p><div class='stats'>...</div><a class='button' href='/contact'>Start</a>" } }

// ✅ Three blocks in column 2 — text + text + cta.
```

**Pre-flight check when restructuring a section into Pro columns:** before saving, walk every block in the section and confirm (a) every block has an explicit `column` value (1, 2, or 3), (b) every block has `width: "12"` unless you specifically want fractional fill inside the column, (c) every `cta` block matches the site's brand button styling, (d) any inline `<a class="button">` previously baked into HTML has been extracted into a real `cta` block.

### 9.5 Pro tabs (sections-as-tabs)

> Verified against `streamlined-home-pro/snippets/block_code_tabs.liquid` + `sections/section.liquid` (tab pane wrapping). Engine support landed in `@k-studio-pro/engine@0.1.3`.

Pro tabs are **two cooperating pieces**: a `code_tabs` block that renders the tab strip, plus sibling `ContentSection`s flagged as tab panes. The tab block doesn't *contain* the panes — Kajabi (and our preview shim) match them up by slug.

#### Authoring shape (React / engine props)

```tsx
import { ContentSection, Tabs, PricingCard } from '@k-studio-pro/engine';

// 1. The tab strip — its own ContentSection ABOVE the panes.
<ContentSection name="Pricing tabs">
  <Tabs
    style="pills"           // "pills" (default) or "tabs"
    align="center"          // "left" | "center" | "right"
    accentColor="#1F2A44"   // active pill / underline color (preview + Kajabi via custom CSS)
    textColor="#475569"     // inactive tab label color
    tabs={[
      { name: 'Monthly', slug: 'monthly' },
      { name: 'Yearly',  slug: 'yearly'  },
    ]}
  />
</ContentSection>

// 2. One ContentSection per pane — siblings, NOT children of the tabs section.
<ContentSection name="Monthly pricing" useAsTab tabSlug="monthly" defaultTab>
  <PricingCard ... />
  <PricingCard ... />
  <PricingCard ... />
</ContentSection>

<ContentSection name="Yearly pricing" useAsTab tabSlug="yearly">
  <PricingCard ... />
  <PricingCard ... />
  <PricingCard ... />
</ContentSection>
```

In raw `design` JSON the same thing looks like:

```jsonc
{
  "kind": "content", "name": "Pricing tabs",
  "blocks": [{
    "type": "code_tabs",
    "props": {
      "style": "pills", "align": "center", "width": "12",
      "accentColor": "#1F2A44", "textColor": "#475569",
      "tabs": [
        { "name": "Monthly", "slug": "monthly" },
        { "name": "Yearly",  "slug": "yearly"  }
      ]
    }
  }]
},
{ "kind": "content", "name": "Monthly pricing",
  "props": { "useAsTab": true, "tabSlug": "monthly", "defaultTab": true },
  "blocks": [/* PricingCards */] },
{ "kind": "content", "name": "Yearly pricing",
  "props": { "useAsTab": true, "tabSlug": "yearly" },
  "blocks": [/* PricingCards */] }
```

#### Field mapping (engine prop → Kajabi `settings_data.json` field)

**On the `code_tabs` block:**

| React prop | Kajabi field | Values | Notes |
|---|---|---|---|
| `style` | `tabs_style` | `"pills"` \| `"tabs"` | default `"pills"` |
| `align` | `tabs_align` | `"left"` \| `"center"` \| `"right"` | default `"center"` |
| `tabs[N].name` | `first_tab_name` … `fifth_tab_name` | string | Up to 5 tabs |
| `tabs[N].slug` | `first_tab_slug` … `fifth_tab_slug` | lowercase string | MUST match a pane's `tab_slug` |
| `width` | `width` | `"1"`–`"12"` | default `"12"` |

> The Kajabi snippet uses **flat `first_*` / `second_*` / … / `fifth_*` fields**, NOT an array. The engine's serializer flattens `tabs[]` for you — just write the array.

**On each pane `ContentSection` (Pro section-level fields):**

| React prop | Kajabi field | Values |
|---|---|---|
| `useAsTab` | `use_as_tab` | `"true"` |
| `tabSlug` | `tab_slug` | lowercase string, unique among panes |
| `defaultTab` | `default_tab` | `"true"` on EXACTLY ONE pane |

#### Mandatory rules

1. **Exactly one pane** must set `defaultTab: true` — otherwise nothing shows on first load.
2. **Slugs are lowercase and must match exactly** between the `code_tabs` block and the pane sections. Typos silently hide panes (the section renders but with `display: none` and no tab button targets it).
3. **The tabs block lives in its own section ABOVE the panes.** Don't mix tab content into the same section as the strip.
4. **Up to 5 tabs.** The 6th `tabs[]` entry is silently dropped (Kajabi only has slots through `fifth_*`).
5. **Pane sections render normally** when not in tab mode — drop `useAsTab` and they become regular sections again.
6. **Pro-only.** On Standard sites the `code_tabs` block and `use_as_tab` field are silently dropped. Always check `resolveBaseTheme(site)` returns a `-pro` theme before composing tabs.
7. **CTA consistency still applies (§4.7).** When tabs hold `pricing_card` or `cta` blocks across panes, every CTA across every pane must share the same brand button styling. Audit before saving.

#### Runtime behavior

- **Kajabi runtime:** `block_code_tabs.liquid` emits real Bootstrap 5 markup (`nav-pills`, `data-bs-toggle="tab"`, `data-bs-target="#section-<id>-tab-pane"`). The Pro theme loads `bootstrap.bundle.min.js` so tab switching works without extra JS.
- **Editor preview:** the React `<Tabs>` component installs a click-delegator via `useEffect` that mimics Bootstrap's `tab` plugin (toggles `.show.active` + inline `display`) — Bootstrap isn't loaded in our preview iframe, but the DOM matches Kajabi's, so behavior is identical.
- **Pane wrapping:** when a section has `useAsTab: true`, the engine wraps its rendered output in `<div class="tab-content"><div class="tab-pane fade" id="section-<id>-tab-pane">…</div></div>` — same wrapper Kajabi's `section.liquid` produces. This is what lets the slider re-init logic (§9.3) find sliders inside tabs.

#### Worked example — Monthly / Yearly pricing toggle

This is the canonical use case (and the one this engine version was tested against on site `af814adc`):

```tsx
<ContentSection name="Plans" paddingDesktop={{ top: '120', bottom: '40' }}>
  <Text width="12" align="center"
    text="<p style='...eyebrow...'>Pricing</p><h2>Choose your plan</h2><p>...</p>" />
  <Tabs
    style="pills" align="center" width="12"
    accentColor="#1F2A44" textColor="#475569"
    tabs={[
      { name: 'Monthly',  slug: 'monthly' },
      { name: 'Yearly · save 20%', slug: 'yearly' },
    ]}
  />
</ContentSection>

<ContentSection name="Monthly tier grid" useAsTab tabSlug="monthly" defaultTab
  paddingDesktop={{ top: '0', bottom: '120' }}>
  <PricingCard width="4" title="Starter" price="$29" priceCadence="/ mo" .../>
  <PricingCard width="4" title="Pro"     price="$79" priceCadence="/ mo" .../>
  <PricingCard width="4" title="Studio"  price="$199" priceCadence="/ mo" .../>
</ContentSection>

<ContentSection name="Yearly tier grid" useAsTab tabSlug="yearly"
  paddingDesktop={{ top: '0', bottom: '120' }}>
  <PricingCard width="4" title="Starter" price="$279" priceCadence="/ yr" .../>
  <PricingCard width="4" title="Pro"     price="$759" priceCadence="/ yr" .../>
  <PricingCard width="4" title="Studio"  price="$1,910" priceCadence="/ yr" .../>
</ContentSection>
```

#### Pre-flight checklist

Before saving any page that uses tabs:
- [ ] Site `base_theme` is `streamlined-home-pro` or `encore-page-pro`.
- [ ] Tabs block's `tabs[].slug` values are all lowercase, unique, and ≤ 5 entries.
- [ ] Every slug in the tabs block has exactly one matching pane section with `tabSlug` set to the same value.
- [ ] Exactly one pane section has `defaultTab: true`.
- [ ] Pane sections are SIBLINGS of the tabs section in the page's `sections` array, not nested inside it.
- [ ] CTAs across all panes match the site's brand button styling (§4.7).

### 9.6 Search form + Search filter blocks

TWO Pro-only blocks that target sibling `feature` blocks in the SAME section (cannot reach other sections). Independent — keyword search and filters don't clear each other's data, but using one resets the other's UI state.

- **`block_search_form`** — keyword input, free-text match against features in the same section.
- **`block_search_filter`** — up to 5 filter groups (toggle each on/off). Per-filter: `filter_N_title` + comma-separated `filter_N_options`. Logic: within one group → OR; across groups → AND. Layouts: stacked checkboxes (default), `use_dropdown_filters: true`, `use_dropdowns_horizontally: true` (combine for horizontal dropdowns above the grid).

Canonical sidebar: Pro columns 3/9 with search+filter left, 3-up feature grid right. Set section `horizontal: left` so filtered cards collapse left.

### 9.6b Pro library / products section (custom filtering)

Pro upgrades the Kajabi `products` section with built-in filtering. **§4.10 still holds** — keep `library` as `{ kind: "raw", type: "products" }`. On Pro you can pass extra `settings`:

- **Static filter** (author-controlled): `static_filter_enabled: true`, `static_filter_mode: "include" | "exclude"`, `static_filter_keywords: "launch, business"` (CSV against product title keywords). Canonical: one section with `include` for "Featured", a second with `exclude` for "All products".
- **Dynamic filter** (visitor-controlled): `dynamic_filter_enabled: true`, `dynamic_filter_categories: "blogging, growth, launch"` (CSV; renders as dropdown). Static + dynamic compose.

Multiple `products` sections per library page is the supported pattern for category grouping. Still no hardcoded product cards.

### 9.7 26 pre-designed section presets

Layout starters (white-boxes, featured testimonial, team grid, gradient CTA, "as seen on" logos, splits, 3-feature grids, etc.). Inherit theme styles automatically. Optional — use as scaffolds, then customize.

### 9.8 Style guide / theme settings extras

#### 9.8a Pro button system (global + per-button overrides)

Pro replaces Kajabi's single-button styling with a **dark/light pair** model so the same site can ship buttons over both light and dark sections. Configure globally in **Page Settings → Style guide → Buttons**, override per-CTA. **Field IDs below are the literal Kajabi `settings_data.json` keys** — verified against `streamlined-home-pro/config/settings_schema.json`.

Global theme settings:
- `btn_background_color` (label "Button Color **Dark**") + `btn_text_color` (label "Button Color **Light**") — Pro repurposes these as the dark/light brand pair. **Counterintuitive:** `btn_text_color` does NOT mean text color — it's the LIGHT half of the pair. Authors pick ONE pair sitewide; each button picks which member via `btn_type`.
- `btn_type`: `"dark"` | `"light"` (default `"dark"`).
- `btn_style`: `"solid"` | `"outline"` | `"text"` (default `"solid"`). Pro adds `"text"` (no padding/border, just a styled link).
- `btn_size`, `btn_width`, `btn_border_radius` — same as Standard.
- **Advanced options gated behind `view_advanced_button_customizations: true`** (theme setting toggle). Until that's on, the fields below are hidden in the Kajabi UI but still emit/respect from JSON.
- `btn_override_shadow`: `"on"` | `"off"` (default `"on"`).
- `btn_inverse_on_hover`: `"normal"` | `"inverse"` (default `"normal"`) — `"inverse"` swaps fg/bg on hover (works on solid + outline; **no-op on `text`**).
- `btn_uppercase`: `"on"` | `"off"` (default `"off"`).
- `select_custom_btn_font`: `"inherit"` | `"primary"` | `"accent"` (default `"inherit"` = "Do Not Override").
- `btn_font_weight` — any of 9 weights (100–900) the loaded font supports.
- `custom_body_button_line-height`, `btn_letter-spacing` (note: **hyphens, not underscores**, in these keys).
- `custom_button_font_size_desktop` + `custom_button_font_size_mobile` (independent).
- `button_border_thickness` — px.
- `button_vertical_padding` + `button_horizontal_padding` (two separate fields, NOT a `padding` object).
- `custom_button_top_margin` + `custom_button_bottom_margin`.

Per-button overrides:
- Every global field above also exists as a per-block override on every `cta` block (and text blocks with inline buttons).
- **"Do Not Override" sentinel = the literal string `"inherit"` for EVERY override field** (verified in `snippets/block_cta.liquid` — every override field is checked with `{% if block.settings.X != 'inherit' %}`). Applies even to numerics (padding/margin/font-size) and colors. **Serializer rule:** to preserve global behavior, emit `"inherit"` — NOT `""`, NOT omit the key. Liquid's `default:` filter only triggers on `nil`; the override fields are explicitly compared to `'inherit'`, so empty string is treated as a real override and produces broken CSS like `font-size: ;`.

Style + hover behavior (verified in `snippets/block_cta.liquid`):
- `btn_style: "text"` **DOES respect the dark/light pair via `btn_type`** — there are dedicated `text + dark` and `text + light` branches. Text buttons use the pair color as the link color (no fallback to body text).
- `btn_inverse_on_hover: "inverse"` is implemented ONLY in the `solid` and `outline` branches — **no-op on `text`**.

Composition rule: still follow §4.7 — pick the dark/light pair ONCE per site, set globals, override only for genuine variant needs.

#### 9.8b Pro form input system (global + per-form overrides)

Mirrors the button system for opt-in / contact / search inputs. Configure globally in **Page Settings → Style guide → Form styles**. **Field IDs verified against `streamlined-home-pro/config/settings_schema.json`.**

Global theme settings:
- `form_input_color_dark` + `form_input_color_light` — input bg pair.
- `form_input_placeholder_color_dark` + `form_input_placeholder_color_light` — placeholder per pair member. (Plus the existing standard `color_placeholder` global.)
- `form_new_input_type`: `"dark"` | `"light"` (default `"light"`).
- `form_new_input_style`: `"solid"` | `"transparent"` (default `"solid"`) — `"transparent"` shows the section bg through (use on colored/dark sections for borderless fields).
- `form_input_border_radius` — px (Pro-only; Standard has no input rounding).
- **Advanced gated behind `use_pro_form_customizations: true`.**
- `form_input_border_thickness`.
- `form_input_font`: `"inherit"` | `"primary"` | `"accent"` (default `"inherit"`).
- `form_input_font_weight`, `form_input_line-height` (hyphen), `form_input_letter-spacing` (hyphen).
- `form_input_font_size_desktop` + `form_input_font_size_mobile`.
- `form_input_vertical_padding` + `form_input_horizontal_padding` (two separate fields).
- `form_input_top_margin` + `form_input_bottom_margin`.

Per-form overrides: every field above has a per-block override with the same `"inherit"` sentinel as buttons (literal string, every field, including numerics — never `""` or omitted).

#### 9.8c Custom font / size override system (any `<link>` tag — Google, Adobe, self-hosted)

> Verified against `streamlined-home-pro/config/settings_schema.json` ("Style Guide" tab) + `snippets/font_override_styles.liquid`. Master keeps the deep field reference at `mem://reference/pro-custom-fonts.md`; thin clients should treat this section as the canonical source.

**Why this exists.** Kajabi's default font picker is restricted to a small Google Fonts set, and its font-size selects skip values (e.g. 32px and 36px exist, 34px does not). Pro **keeps every default Kajabi font field intact** and layers a fully optional override system on top — leave overrides off → Kajabi defaults win exactly as on Standard. Touch one field → it wins for that scope. Don't reach for the override system unless the expert asks for a font Kajabi doesn't ship or a size Kajabi's picker can't produce.

**Cascade (lowest → highest priority):**
1. Kajabi defaults (`font_family_body`, `font_family_heading`, `font_size_h*_desktop`, etc.) — same fields as Standard.
2. Body overrides (`override_body_fonts: true`) and bold body overrides (`override_bold_body_fonts: true`) → apply to `body, p` / `body strong, p strong`.
3. **All headings** override (`override_heading_font_styles: true`) → applies to every `h1–h6` (and their `strong` variants).
4. **Per-element** override (e.g. `override_h3_font_styles: true`) — beats All headings for that element.
5. **Bold-per-element** override (e.g. `override_h3_bold_font_styles: true`) — beats per-element for the `strong` variant.
6. **Block-level** overrides on `cta` / form blocks — beat all template-level button/form settings.

**Standard Style Guide defaults must be honored as fallbacks (preview parity).** When the expert leaves Standard fields like `font_weight_heading`, `line_height_heading`, `font_size_h1_desktop`, `font_size_h1_mobile` (and h2–h6), `font_weight_body`, `line_height_body` empty, Kajabi falls back to **base-theme defaults** (headings 700, h1 48px desktop / 36px mobile, etc.) — NOT to browser UA defaults. The preview engine (`packages/engine/src/siteDesign/resolvePreviewFonts.ts → buildStandardThemeRules`) MUST therefore read each Standard field via `valWithDefault(ts, key)` which falls through to `TEMPLATE_SETTINGS_BY_ID[key].default` from `templateSettingsCatalog.ts`, and emit a CSS rule whenever the resolved value is non-empty. Without this, preview headings collapse to UA `h1 ≈ 32px` while the exported Kajabi site renders 48px — the expert reports "the headings look fine in Kajabi but tiny in the preview" (or vice-versa after they strip an inline `font-size`). Heading weight rules MUST also target `:is(h1..h6) strong` so inline `<strong>` inherits the heading weight instead of body weight. Per-heading desktop+mobile sizes go inside `@media (min-width: 768px)` / `@media (max-width: 767px)` blocks. This is preview-only plumbing; export is unaffected because Kajabi's runtime CSS already handles the fallbacks server-side.

**Visibility toggles (`hide_if`) — flip them when you emit overrides.** Most override fields have `hide_if: { <toggle_id>: false }`. The toggle controls **whether the field is visible in the Kajabi page builder**, not whether it's emitted. **Whenever you emit any field under a toggle, you MUST also flip the toggle to `true`** — otherwise the expert opens Kajabi and can't see/edit the values you wrote.

| Toggle ID (default `false`) | Unlocks |
|---|---|
| `view_advanced_button_customizations` | All advanced `btn_*` fields (button shadow/hover/uppercase/font/weight/lh/ls/size/border/padding/margin) |
| `use_custom_fonts` | `font_stylesheet_links` (paste `<link>` tags here) |
| `use_primary_custom_font` | `primary_custom_font_name`, `primary_custom_font_fallback` |
| `use_accent_custom_font` | `accent_custom_font_name`, `accent_custom_font_fallback` |
| `override_body_fonts` / `override_bold_body_fonts` | Body / bold body font + size/weight/lh/ls/margin |
| `override_heading_font_styles` | All-headings font + weight/lh/ls/bottom-margin (NO size — size goes per-element) |
| `override_h1_font_styles` … `override_h6_font_styles` | Per-element font + weight/lh/ls/size_desktop/size_mobile/bottom_margin |
| `override_h1_bold_font_styles` … `override_h6_bold_font_styles` | Per-element bold variant (same fields) |
| `use_pro_form_customizations` | All `form_input_*` fields (see §9.8b) |
| `use_font_css` | `font_css` raw CSS textarea |

**Wiring a custom font (Google / Adobe / self-hosted).** Two slots only — primary + accent. Pick them ONCE per site, then assign per-element.

1. `use_custom_fonts: true`
2. `font_stylesheet_links` ← paste the full `<link rel="stylesheet" href="...">` tag(s). Multi-line allowed (textarea). For Google Fonts: open the embed dialog → "Web" → "Link" → copy the `<link>` lines verbatim.
3. `use_primary_custom_font: true` (and/or `use_accent_custom_font: true`)
4. `primary_custom_font_name` ← the exact `font-family` name from the loaded stylesheet (e.g. `Roboto`, `Playfair Display`). **No quotes** — Liquid wraps it itself: `font-family: "{{ name }}", {{ fallback }};`
5. `primary_custom_font_fallback` ← generic family (`sans-serif`, `serif`, `monospace`, etc.). Goes in unquoted.

Then assign via any `select_custom_*_font` field: `"primary"` → primary slot, `"accent"` → accent slot, `"inherit"` → no custom font on this element.

**`"inherit"` semantics — verified from Liquid.** Every numeric/select override is checked against the literal string `"inherit"`:
```liquid
{% if settings.custom_h3_font_weight != 'inherit' %}font-weight: {{ settings.custom_h3_font_weight }};{% endif %}
```
**Empty string is NOT inherit** — it produces broken CSS like `font-weight: ;`. Serializer rule: emit `"inherit"`, never `""`, never omit the key. Same rule applies to button + form override fields.

For `select_custom_*_font` specifically: only `"primary"` / `"accent"` emit a `font-family` rule. `"inherit"` emits nothing → the element falls back to **Kajabi's normal heading/body font cascade**, NOT to the other slot. This is correct — it lets a site mix custom slots with Kajabi defaults (e.g. H1 = primary custom, H2/H3 = Kajabi default, body = accent custom).

**Per-element field shape (h1, identical for h2–h6 with the number swapped).** Note **hyphens, not underscores** in `*_line-height` and `*_letter-spacing` — they will silently fail if you serialize as snake_case.

| Field ID | Default |
|---|---|
| `override_h1_font_styles` | `false` |
| `select_custom_h1_font` | `inherit` |
| `custom_h1_font_weight` | `inherit` |
| `custom_h1_line-height` | `inherit` |
| `custom_h1_letter-spacing` | `inherit` |
| `custom_h1_font_size_desktop` | `inherit` |
| `custom_h1_font_size_mobile` | `inherit` |
| `custom_h1_bottom_margin` | `inherit` |

Bold variant: `override_h1_bold_font_styles` toggle, then `select_custom_bold_h1_font` + `custom_bold_h1_*` (same suffixes). All-headings override has the same shape minus the size fields.

**Body / bold body override fields:** same shape on `body, p` and `body strong, p strong, body b, p b`. Toggles `override_body_fonts` / `override_bold_body_fonts`. Field IDs: `select_custom_body_font`, `custom_body_font_weight`, `custom_body_font_line-height`, `custom_body_font_letter-spacing`, `custom_body_font_size_desktop`, `custom_body_font_size_mobile`, `custom_p_bottom_margin` (and the `_bold_` variants).

**Advanced button fields (gated by `view_advanced_button_customizations: true`).** Verified IDs from rows 22–35: `btn_override_shadow`, `btn_inverse_on_hover`, `btn_uppercase`, `select_custom_btn_font`, `btn_font_weight`, `custom_body_button_line-height` (hyphen!), `btn_letter-spacing` (hyphen!), `custom_button_font_size_desktop`, `custom_button_font_size_mobile`, `button_border_thickness`, `button_vertical_padding`, `button_horizontal_padding`, `custom_button_top_margin`, `custom_button_bottom_margin`. See §9.8a for the dark/light pair model that wraps these.

**Block-level overrides.** Every `cta` block carries its own copy of the advanced button fields, and form blocks carry their own copy of the form input fields. Per-block values **override the template-level settings** for that one block. Same `"inherit"` sentinel rule (literal string, every field, never `""`, never omit).

**Authoring rules (mandatory):**
1. **Default to Kajabi defaults.** Don't touch the override system unless the expert asked for a font Kajabi doesn't ship, or a specific size its picker can't produce (e.g. 34px).
2. **Whenever you emit any override field, also flip its visibility toggle to `true`.** Otherwise the expert can't see/edit it in Kajabi.
3. **Use `"inherit"` (literal string)** for every numeric/select override you don't want to change. Never `""`, never omit.
4. **Custom font name fields take the family name unquoted.** Liquid wraps it.
5. **Mind the hyphen-in-ID fields** (`*_line-height`, `*_letter-spacing`, `custom_body_button_line-height`) — they break if serialized as snake_case.
6. **One pair per site.** Pick primary + accent ONCE, then assign per-element. There are only two slots — don't try to use them as a per-heading font picker.

#### 9.8d Pro-only `custom_css_class` on every section

- Field key: **`custom_css_class`** (text input, default `""`) — added by Pro to `sections/section.liquid`. Standard themes do NOT have it.
- Liquid: `{% if section.settings.custom_css_class != blank %}{{ section.settings.custom_css_class }}{% endif %}` — rendered into the section's outer class list. Value is space-separated CSS class names (e.g. `"mm-dark-hero dark-hero-form"`), NOT a single class.
- Combined with the theme-wide `customCss` slot (`TemplateDef.customCss`), this is the **canonical way to target a single section** with bespoke CSS without touching base theme files. Workflow: assign `custom_css_class: "hero-gradient-cta"` on the section → write `.hero-gradient-cta { ... }` in `themeSettings.customCss`.
- Use cases: per-section gradients, scoped typography, hiding a single CTA on mobile, custom hover, animation triggers.
- **Pro-only — silently dropped on Standard sites.**

#### 9.8e Authoring workflow — prefer template controls over inline CSS

> This is the canonical "how to actually style a Pro site" workflow, distilled from real cleanup passes. **Read this before adding any inline `style="..."` for typography or buttons.** The single biggest mistake on Pro sites is duplicating typography/button rules as inline CSS in block HTML — it bypasses the template's global controls, fights the cascade, can't be edited from the Kajabi page builder, and silently breaks when the expert tweaks the style guide.

##### The hierarchy (use the highest level that solves the problem)

1. **Template `themeSettings`** (`TemplateDef.themeSettings`) — sitewide defaults via the §9.8a/b/c override system. **Always start here for fonts, headings, buttons, forms.**
2. **Block-level overrides** on `cta` / form blocks — only when ONE block legitimately needs a variant (e.g. a secondary outline next to a primary solid in the same section).
3. **`custom_css_class` + `themeSettings.customCss`** (§9.8d) — for genuinely bespoke per-section visual flourishes that the override system can't express (gradients, custom animations, layered backgrounds).
4. **Inline `style=""` in block HTML** — last resort. Only for content-specific inline decoration (a single `<span>` accent color in a headline, an inline divider) where lifting it to the template would pollute the global cascade.

##### Mandatory pre-flight before saving any styling change

When the expert asks "make the buttons match" / "fix the typography" / "the heading line-height feels off" / "tighten the form fields" — do this checklist:

1. **Audit existing inline CSS first.** `get-site-design` → walk every block → grep block HTML for `style="font-`, `style="line-height`, `style="letter-spacing`, `style="text-transform`, `padding:`, `font-size:`, `font-family:`. **Every match is a candidate for deletion** in favor of a `themeSettings` override.
2. **Lift recurring inline rules into `themeSettings`.** If you see the same `font-family: 'Playfair Display'` in 6 headings, that belongs in `themeSettings` (`use_custom_fonts: "true"`, `use_primary_custom_font: "true"`, `primary_custom_font_name: "Playfair Display"`, `select_custom_h1_font: "primary"` etc.) — not repeated inline.
3. **Lift recurring inline button styles into `themeSettings`.** If every CTA carries inline `padding: 16px 32px; text-transform: uppercase; letter-spacing: 2px`, that's the global button system speaking — set `view_advanced_button_customizations: "true"`, `btn_uppercase: "on"`, `btn_letter-spacing: "2px"`, `button_vertical_padding: "16px"`, `button_horizontal_padding: "32px"`. Then **delete the inline declarations**.
4. **Match the dark/light pair model (§9.8a).** Pick the brand pair ONCE (`btn_background_color` = dark member, `btn_text_color` = light member). Per-CTA, set `btn_type: "dark"` or `"light"` to choose which one renders. Don't set per-block `buttonBackgroundColor` / `buttonTextColor` unless the block genuinely uses an off-brand color.
5. **Use the value-formats memory.** Every `custom_*` / `btn_*` / `form_input_*` field is enum-validated. See `mem://reference/pro-custom-fonts-value-formats.md` (master) — bare numbers (`"42"`), `em` values (`"-0.02em"`), and gap values (`"13px"`, `"15px"`) are silently rejected. Always emit `"Npx"` strings on the documented px grid, unitless decimals on the 0.1 line-height grid, the 5px-grid for margins, and `"primary"`/`"accent"`/`"inherit"` (literal strings) for font slot pickers.
6. **Whenever you set any override field, flip its `hide_if` toggle to `"true"`** (§9.8c table) — otherwise the field is invisible in Kajabi's editor and the expert can't tweak it.
7. **Use `"inherit"` (literal string) for every override you DON'T want to change.** Never `""`, never omit. Empty string produces `font-weight: ;` — broken CSS that breaks the rendered page.
8. **Mind the hyphen-in-ID fields:** `custom_h*_line-height`, `custom_h*_letter-spacing`, `custom_body_font_line-height`, `custom_body_font_letter-spacing`, `custom_body_button_line-height`, `btn_letter-spacing`, `form_input_line-height`, `form_input_letter-spacing`. Snake_case versions (`custom_h1_line_height`) are silently dropped.
9. **Verify the preview matches.** The editor preview honors `themeSettings` overrides (see `mem://feature/preview-respects-pro-custom-fonts.md`). After changes, a refresh should show the new typography/buttons in the preview — if not, you likely emitted an invalid value or forgot the visibility toggle.

##### Anti-patterns (delete these on sight)

❌ **Inline font-family on every heading** instead of `select_custom_h*_font: "primary"`.
❌ **Inline `padding`, `text-transform`, `letter-spacing` on every `<a class="button">`** instead of the global `btn_*` system.
❌ **Inline `line-height: 1.05`** on h1s instead of `custom_h1_line-height: "1.0"` (snapped to the 0.1 grid).
❌ **Per-CTA `buttonBackgroundColor` set to the same brand value on every CTA** instead of one global `btn_background_color` + per-CTA `btn_type: "dark"`.
❌ **Setting numeric overrides as bare numbers** (`custom_h1_font_size_desktop: "42"`) — must be `"42px"`.
❌ **Setting overrides as `em`** (`btn_letter-spacing: "0.18em"`) — must be `"Npx"` clamped to `[-2px, 2px]`.
❌ **Setting overrides to `""`** (empty string) thinking it means "use default" — Kajabi treats it as a real override and emits broken CSS. Use `"inherit"`.
❌ **Emitting an override without flipping its `hide_if` toggle** — the value applies but the expert can't see/edit the field in Kajabi.
❌ **Using `select_custom_h1_font: "inherit"` and expecting it to route to the accent slot** — `"inherit"` means "no custom font, fall back to Kajabi's default heading font". Use `"accent"` to route to the accent slot.

##### Worked example — Bennett Studio cleanup pattern

Symptom: every heading carried inline `style="font-family: 'Playfair Display', serif; line-height: 1.05; letter-spacing: -0.02em;"` and every button carried inline `style="padding: 16px 32px; text-transform: uppercase; letter-spacing: 0.18em; font-size: 13px;"`. Sitewide style guide changes had no effect.

Fix:
1. **Set `themeSettings` once:**
   ```jsonc
   {
     "use_custom_fonts": "true",
     "font_stylesheet_links": "<link href=\"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap\" rel=\"stylesheet\">",
     "use_primary_custom_font": "true",
     "primary_custom_font_name": "Playfair Display",
     "primary_custom_font_fallback": "serif",
     "override_h1_font_styles": "true",
     "select_custom_h1_font": "primary",
     "custom_h1_line-height": "1.0",
     "custom_h1_letter-spacing": "-1.1px",
     "custom_h1_font_size_desktop": "56px",
     "custom_h1_font_size_mobile": "36px",
     "view_advanced_button_customizations": "true",
     "btn_uppercase": "on",
     "btn_letter-spacing": "2px",
     "custom_button_font_size_desktop": "14px",
     "custom_button_font_size_mobile": "12px",
     "button_vertical_padding": "16px",
     "button_horizontal_padding": "32px",
     "btn_background_color": "#2A211B",
     "btn_text_color": "#FBF8F2"
   }
   ```
2. **Delete every inline `style=` from heading and button HTML.** Headlines become plain `<h1>...</h1>`. Inline `<a class="button">` either stays as a styled `<a>` (if it must live inside HTML) or — preferred — gets lifted into a real `cta` block which inherits all global button styling for free.
3. **Refresh preview.** All headings and buttons render with the new template-level settings. Expert can now tweak any of these in the Kajabi style guide and the change propagates everywhere.

The key insight: **inline CSS is the symptom of a missed template-level control.** Almost every typography/button rule belongs in `themeSettings`. Reach for inline styles only for true one-off content decoration.

### 9.9 Pro-only block snippets

These exist as `snippets/block_*.liquid` in Pro themes only. They are NOT yet wired into the React block library — exposing one requires the 6-step procedure in §9.12.

| Snippet | Purpose | Key fields |
|---|---|---|
| `block_feature_icon` | Icon-led feature card | `feature_icon`, `feature_icon_color`, `feature_icon_size`, `image_width`, `image_border_radius`, `text` |
| `block_code_tabs` | Multi-tab code/HTML viewer (up to 4) | `code_tabs`, `tabs_style`, `tabs_align`, per-tab slug/name/content |
| `block_search_filter` | Faceted filter — see §9.6 | `use_dropdown_filters`, `use_dropdowns_horizontally`, `use_filter_1..5`, `filter_N_options`, `filter_N_title` |
| `block_search_form` | Standalone keyword search input | search input fields |
| `block_image_icon` | Image used as inline icon | image picker + sizing |
| `block_test` | Internal Kajabi placeholder — **do not use** | n/a |

### 9.10 Pro-only section snippets (column sliders)

Layout switches set via section settings (not new block types):
- `column_one_slider.liquid`, `column_two_slider.liquid`, `column_three_slider.liquid`

### 9.11 Pro-only sections

- `sections/footer_pro.liquid` — see §9.2.
- `sections/cta_popup.liquid`, `sections/exit_pop.liquid`, `sections/two_step.liquid` — sitewide overlays enabled via theme settings, not per-page blocks.

### 9.12 Pro-only section-level fields

`sections/section.liquid` in Pro adds ~50 new fields:
- **Animation**: `animation_type`, `animation_duration`, `animation_delay`, `animation_offset`.
- **Slider** (§9.3): `enable_slider`, `slider_autoplay`, `slider_speed`, `slider_dots`, `slider_arrows`, `slider_infinite`, `slides_to_show_*`, `block_offset_before`, `block_offset_after`, plus arrow/dot positioning.
- **Columns** (§9.4): `columns`, `column_widths`, `column_gap`, per-block `column`.
- **Tabs** (§9.5): `use_as_tab`, `tab_slug`, `default_tab`.
- **Advanced borders**: per-side `border_top_*`, `border_right_*`, `border_bottom_*`, `border_left_*`.
- **Per-breakpoint columns**: `columns_desktop`, `columns_tablet`, `columns_mobile`.
- **Background video**: `bg_video_loop`, `bg_video_muted`, `bg_video_autoplay`, `bg_video_overlay_color`, `bg_video_overlay_opacity`.
- **Spacing precision**: per-breakpoint padding/margin.

To add support: extend `kajabiFieldSchema.ts` SECTION schema (mark new fields `proOnly: true`), extend `Section`/`ContentSection` React props, gate in `serialize.ts` so they only emit when the export target is a `-pro` theme.

### 9.13 Roadmap for exposing Pro blocks

Add incrementally when an expert actually needs one:

1. Create `src/blocks/components/<BlockName>.tsx` matching the Liquid output.
2. Add `<block_type>` to `BlockType` union in `src/blocks/types.ts`.
3. Add field defaults to `src/blocks/blockDefaults.ts`.
4. Add serializer in `src/blocks/serialize.ts` mapping React props → Kajabi `block.settings.*`.
5. Add field schema entry in `src/engines/kajabiFieldSchema.ts` with `proOnly: true`.

6. Update `getTemplateCapabilities()` so Standard-themed sites reject the block.

Don't expose all Pro blocks speculatively.
