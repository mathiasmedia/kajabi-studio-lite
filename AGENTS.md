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

### 8.2 What NOT to sync

- `src/integrations/supabase/types.ts` — auto-generated per project, leave alone.
- `src/integrations/supabase/client.ts` — auto-generated per project, leave alone.
- `.env`, `supabase/config.toml`, `supabase/migrations/**` — managed by the platform.
- `supabase/functions/**` — edge functions are deployed from master and shared; thin clients should never touch them.
- `AGENTS.md` itself — re-sync this file separately and ONLY if the operator explicitly says "also sync AGENTS.md".
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
