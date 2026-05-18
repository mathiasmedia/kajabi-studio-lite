# Kajabi Studio Agent Guide

> **SCOPE — READ FIRST:**
> This file is the **single source of truth for both master AND thin clients**. Every authoring rule (every §4.x guardrail, every §9 Pro capability) applies identically in both contexts. The only thing that differs is **how you read/write site data** — see §0 below.
>
> - **Master** (project ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`, "Kajabi Studio Max"): you have full DB access (`supabase--read_query`, `psql`, migrations) AND full freedom to modify the app shell, engine, edge functions, dashboards, etc. Use direct DB writes for site `design` JSON. Edge functions are for **thin clients to call** — master rarely needs them.
> - **Thin client remix** (any other project): you do NOT have DB access. Edit sites via the `get-site-design` / `update-site-design` / `upload-site-image` edge functions over HTTPS with the `X-App-Token` header. Do NOT modify the app shell, engine, or backend — see §8.
>
> **Conflict-resolution hierarchy (when sources disagree, highest priority wins):**
> 1. `mem://~user` (cross-session user preferences) — always wins on style/communication
> 2. `mem://index.md` Core rules (always-in-context one-liners) — always wins on project rules
> 3. `AGENTS.md` (this file) + `PRO_CAPABILITIES.md` — canonical law
> 4. `mem://reference/*` / `mem://feature/*` / `mem://workflow/*` — case-law refining the law above. **When a memory file contradicts AGENTS.md, the more recently dated/edited source wins** — memories are usually the up-to-date verified-bug refinement of an older AGENTS rule.
> 5. `packages/engine/src/engines/kajabi_rendering_guide.md` — Liquid/CSS runtime reference (factual; never overridden, but only used when authoring against Kajabi internals)

---

## 0. How the app works (read this before doing anything site-related)

**Kajabi Studio is a multi-site builder.** Experts (end-users) sign in, see a dashboard of their sites + landing pages, click into one, and edit it block-by-block in a visual editor with a live Liquid-rendered preview. When they're happy, they export a `.zip` and upload it to Kajabi.

### 0.1 The data model — every site lives in the `sites` table

Schema (verified in `packages/engine/src/data/siteStore.ts`):

| Column | Meaning |
|---|---|
| `id` | UUID primary key — appears in editor route `/sites/<id>/editor` |
| `user_id` | Owner (`auth.uid()`); RLS enforces ownership |
| `name`, `brand_name` | Display name + sitewide brand string |
| `kind` | `'site'` (multi-page Kajabi website) OR `'landing_page'` (single page). Locked at creation |
| `base_theme` | One of `streamlined-home`, `streamlined-home-pro`, `encore-page`, `encore-page-pro`. Locked at creation |
| `slug` | Landing pages only — URL-friendly token |
| `design` | **The full site as JSON** — pages, sections, blocks, props, themeSettings, branding. Shape: `SiteDesign` in `packages/engine/src/siteDesign/types.ts` |
| `imported_zip_path` | If imported from a Kajabi `.zip`, the path in the private `site-zips` bucket (fallback asset source) |
| `latest_export_url`, `latest_export_at` | Most recent exported zip in `site-exports` bucket |

**The `design` JSON shape (essentials):**
```ts
{
  version: number,
  pageKeys: string[],           // ordered page list — MUST match keys of `pages`
  pages: { [key: string]: { sections: DesignSection[] } },
  fonts?: { heading?, body?, ... },
  themeSettings?: { ... },      // sitewide Kajabi style guide values
  branding?: { colorPrimary, colorAccent, fontFamilyHeading, fontFamilyBody },
  globalSections?: { exit_pop?, two_step? },   // sitewide overlays
  previewMenus?: { ... },        // editor preview-only nav data
}
```

Each `DesignSection` is one of: `kind: 'header' | 'content' | 'footer' | 'raw'` with `props` and `blocks`. Each block has a `type` (text/cta/feature/pricing_card/accordion/image/logo/menu/copyright/link_list/social_icons/...) and a `props` object. Full block field reference: `mem://reference/block-field-catalog.md`.

### 0.2 How to VIEW / FIND / LIST sites

- **Master** — query the DB directly:
  ```sql
  SELECT id, name, kind, base_theme, updated_at
  FROM sites
  WHERE user_id = '<expert uuid>'   -- omit for all sites
  ORDER BY updated_at DESC;
  ```
  Use `supabase--read_query` or `psql`. To inspect a specific site's design: `SELECT design FROM sites WHERE id = '<uuid>';`. To find an expert's user_id, join `auth.users` by email.

- **Thin client** — call `get-site-design` with a known `siteId` (the expert is on `/sites/<siteId>/editor` — pull it from the route or ask). There is NO list endpoint for thin clients; the iframe shows the dashboard and the expert picks one.

- **Both** — open the editor in the browser at `/sites/<siteId>/editor?page=<pageKey>` to see the live Liquid preview + sidebar. The sidebar's anatomy is documented in §4.35.

### 0.3 How to EDIT a site (the universal rule)

Always: **GET the current design → mutate IN PLACE → write the FULL design back.** Never POST a freshly-built design object — it wipes every page you didn't touch.

- **Master:** read with `supabase--read_query` (`SELECT design FROM sites WHERE id = '<uuid>'`), mutate in a script, write back with a migration or `supabase--insert`-style update. For one-off edits, prefer running a small Deno/Node script that uses the service-role key to update the row, OR use `update-site-design` exactly like a thin client would (also works on master).
- **Thin client:** §3 below — `get-site-design` → mutate → `update-site-design` over HTTPS with `X-App-Token`.

The mutation logic is identical in both cases. Every §4.x authoring rule (allowlists, chrome key hygiene, white-on-white, CTA consistency, dynamic page guards, etc.) applies regardless of which transport you used.

### 0.4 How to CREATE a new site or landing page

🚨 **There is NO `create-site` edge function and NO programmatic create API exposed to either master or thin clients.** Sites are always created from the **dashboard UI**:

- Multi-page website → **New → Website** on `/` (the SitesDashboard). Calls `createSite({ name, brandName?, baseTheme? })` in `packages/engine/src/data/siteStore.ts`. Defaults to `streamlined-home`; pass `streamlined-home-pro` for Pro.
- Single landing page → **New → Landing page** on `/landing` (the LandingPagesDashboard). Calls `createLandingPage({ name, brandName?, slug?, baseTheme? })`. Defaults to `encore-page`; pass `encore-page-pro` for Pro.
- From a Kajabi zip → **Import Kajabi site** on the dashboard. Calls `importSiteFromZip(blob)` → `createSiteFromImport(...)`. Detects `kind` + `base_theme` from the zip; populates `design`, `imported_zip_path`, both footer slots, and `globalSections` (`exit_pop` / `two_step`).

Both `createSite` and `createLandingPage` seed `design` from `buildBlankDesign(brand)` / `buildLandingPageBlankDesign(brand)` (in `packages/engine/src/siteDesign/`). The blank multi-page baseline ships **8 pages** (`index`, `about`, `page`, `contact`, `blog`, `blog_post`, `thank_you`, `404`) — each just header + simple hero + footer. The expert is expected to ask the AI to flesh them out.

**If the expert asks "create me a new site / landing page" in chat:**
- **Master:** you CAN insert directly via SQL using the same shape as `createSite()`. Prefer a migration so it's auditable. But usually the right answer is to tell them to click **New** on the dashboard — it auto-seeds menus, theme files, and base-theme bundles via background tasks (`initializeSiteThemeFromBundle`).
- **Thin client:** tell them to click **New** on the dashboard inside the iframe. There's no edge function to call.

After creation, you edit the resulting site exactly per §0.3.

### 0.5 How the PREVIEW works

The editor renders the site by feeding `design` JSON through `LiquidPagePreview` (`packages/engine/src/preview-liquid/`), which executes the **actual base-theme Liquid templates** in-browser via a wasm-backed engine. Preview ≡ live Kajabi by construction — same Liquid, same CSS, same fonts (per `themeSettings`/`fonts`). If something looks wrong in preview, it'll look exactly that wrong on Kajabi after export.

The dashboard thumbnails use the same pipeline at smaller scale. There is no React-side renderer to keep in sync (the historical SHADOW_MAP / scopeCss parity rules are obsolete — see §4.18).

### 0.6 How EXPORT works

Editor → **Export** button → `exportThemeZip(...)` (`packages/engine/src/engines/exportEngine.ts`). It:
1. Serializes `design` → Kajabi `settings_data.json` (validated against the base-theme schema registry, §4.27).
2. Merges with the original zip's `templates/`, `sections/`, `snippets/`, `assets/` (last-touched-keys-win via `mergeSettings`).
3. Bundles every external image URL into `assets/<hash>.<ext>` (default ON, §4.8 NOTES + `mem://feature/asset-bundling-export.md`).
4. Returns a `Blob`; the dashboard uploads it to `site-exports/<userId>/<siteId>/latest.zip` and offers a download.

Authors (you) almost never need to invoke export manually — the editor handles it. Just make sure the `design` you saved passes the §4.31 diagnostic order before telling the expert to export.

---

---

## 1. What this project is

This is a **per-expert remix** of Kajabi Studio. The expert opens it, picks a site, and asks you to build/refine it. You make the changes; they review the preview; you ship the export to Kajabi.

There are **no code-side templates anymore**. Every site's full visual identity (pages, sections, blocks, copy, fonts, colors, image references) lives as JSON in the `sites.design` column in the database. Editing a site means **editing that JSON and saving it**.

### 1.1 Literal operator trigger — `convert to iframe`

When the operator types **exactly** `convert to iframe` (or `migrate to iframe shell`), this is **NOT ambiguous**. It always means:

1. **Replace the current thin client app shell with the canonical iframe template** from `thin-client-templates/iframe-app/`.
2. Delete the old local app implementation first (`src`, old shell files, stale deps, stale base-theme copies if present).
3. Copy the iframe template files into the project root.
4. Run the knowledge sync script so this thin client has the latest rules.

Do **not** ask "what would you like converted to an iframe?" and do **not** ask the operator to explain further. The trigger already specifies the action.

**What gets replaced:** the thin client's local shell/UI code.
**What does NOT get lost:** the expert's actual sites/data, because they live in the master backend and remain tied to the expert's account.

If the operator used this trigger, execute the conversion immediately.

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

### 4.6a 🚨 OVERLAY / SECTION BG CHANGE → RE-AUDIT EVERY INLINE `color:` STYLE IN THE SECTION'S BLOCKS

🚨 **Verified failure mode (Carrie Variation hero, 2026-05-10).** The hero had `<p style="color:rgba(244,239,230,0.85)">...</p>` (light cream text) over a DARK overlay. Expert flipped the overlay to a LIGHT cream tint to brighten the section. Inline `color:` was NOT updated → light text on light bg → invisible. Save returned 200, expert reported "I cannot see the lede."

**The rule — whenever you change a section's `background` (or `bgType`/`backgroundImage` overlay), IMMEDIATELY audit every block in that section for inline `style="color:..."` / `style="...color:..."` declarations. Re-evaluate each one against the NEW effective background:**

- Dark text (`#2A2722`, dark hex, dark `rgba(...)`) on a now-DARK bg → flip to a light brand color.
- Light text (`#FBF7F0`, `rgba(244,239,230,0.85)`, white) on a now-LIGHT bg → flip to a dark brand color.
- Same logic for inline `<blockquote style="color:">`, `<cite style="color:">`, `<a style="color:">`, `<strong style="color:">`.

Inline editorial colors (per `mem://reference/inline-style-html-content.md`) are the right pattern — but they don't auto-adjust. A dark→light overlay swap silently leaves light text invisible; a light→dark swap silently leaves dark text invisible.

**Pre-flight on every section bg / overlay change:** `grep -i 'style="[^"]*color:' ` the section's blocks' `text`/`html` HTML. For each match, confirm contrast vs the new bg. Fix before saving. Same rule for editorial `<blockquote>`/`<cite>` typography blocks per `mem://reference/inline-style-html-content.md`.

**Companion rule to §4.35al** (button contrast vs section bg). §4.35al covers button-vs-section blend; §4.6a covers inline-text-vs-section blend. Both fire on every section bg change.

See `mem://reference/overlay-change-reaudit-inline-colors.md`.

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

When a card-style block (`feature`, `pricing_card`, etc.) needs an "Explore →", "Learn more", "Read story", or any other call-to-action link, **use the block's native button props — never bake an `<a>` tag into the HTML `text` field**. Same lift-recurring-styles-into-the-template rule from `PRO_CAPABILITIES.md` §9.8e (PRO STYLING), applied at the block level.

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

**Pre-flight check on every site/section edit:** scan every `feature` / `pricing_card` block's `text` HTML for trailing `<p>...<a>...</a></p>` patterns or `<a class="button"...>` / `<a style="...border:1px..."...>` — these are inline buttons hiding in HTML. Lift each one into `showButton: true` + the relevant `button*` props, and strip the `<a>` from the HTML. Same for "stacked content" columns (`PRO_CAPABILITIES.md` §9.4a): if the bottom block of a stacked column is a `text` block whose HTML is just a styled `<a>`, replace it with a sibling `cta` block.

**Composing matters too** — once buttons are native, §4.7's "every CTA on the site looks consistent" rule kicks in automatically: all `feature` buttons on the site should share `buttonStyle`, `buttonTextColor`, `buttonSize`. Don't mix `buttonStyle: "text"` on some cards and `buttonStyle: "solid"` on others unless the visual hierarchy genuinely calls for it.

---

### 4.16 TEXT BUTTONS (`buttonStyle: "text"`) — color comes from the dark/light pair, NOT from `buttonTextColor`

🚨 **Verified gotcha — `block_cta.liquid` text-button branch is counterintuitive.** When `btn_style: "text"`, Pro takes the visible link color from the **dark/light button pair** (`btn_background_color` / `btn_text_color`) according to `btn_type`, NOT from a "text color" field. This is confusing because the field NAMED `btn_text_color` is the LIGHT half of the pair (per `PRO_CAPABILITIES.md` §9.8a), not "the text color of this button".

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

`btn_type` defaults to `"dark"` per `PRO_CAPABILITIES.md` §9.8a, so **on a default text button the visible color comes from `buttonBackgroundColor`, NOT `buttonTextColor`**. Setting `buttonTextColor: "#A88251"` on a `buttonStyle: "text"` block is a silent no-op — the link renders in the body's default text color instead of your accent.

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

**Why this exists:** Pro's button system is designed around picking ONE brand pair sitewide (per `PRO_CAPABILITIES.md` §9.8a) and letting each button choose which pair member to show. For text buttons specifically, "which color shows" follows `btn_type` directly because there's no background/border to occupy the other slot — the entire button IS just the colored text. So the slot whose name matches the type is the one you see.

---

### 4.17 🚨 `feature` block — ALWAYS set a large explicit `imageWidth` for photos (the default is icon-sized)

🚨 **THE SINGLE RULE — memorize this:**

> **Unless you genuinely want the image rendered SMALLER than the card it lives in (i.e. it's an icon), you MUST set `imageWidth` explicitly to a large pixel value. Omitting it does NOT fill the card — it falls back to `80px`, the icon default. There is no "auto-fill" mode.**

**Verified default (in `packages/engine/src/blocks/components/Feature.tsx`):** when `imageWidth` is empty or absent, the image renders at **`width: 80px`**. That is the icon default and it has been the default forever. There is no "omit it and the image fills the card" branch — that was a previous (incorrect) version of this rule.

**The mental model — verified in `Feature.tsx`:** when `imageWidth` IS set, the image renders as `width: 100%` capped at `maxWidth: ${imageWidth}px`. When it's missing/empty, it falls back to a flat `width: 80px` (icon mode). Two critical implications:

1. **Big values are SAFE — they don't overflow.** Setting `imageWidth: "1200"` on a 322px-wide card grid produces a 322px image (the `width: 100%` clamp wins). The cap only kicks in if the actual card is wider than the cap. **You cannot make an image "too big" by overshooting the cap** — you can only make it too small by undershooting it.
2. **Therefore the safe play is always to set the cap HIGH.** When in doubt, set `imageWidth: "1200"`. It fills any card up to 1200px wide and never clips.

**What to set, every time:**

| What the image IS | `imageWidth` value | Notes |
|---|---|---|
| **Any service / program / card hero photo — when in doubt** | **`"1200"`** | ✅ DEFAULT. Fills any reasonable card; impossible to under-size. Use this unless you have a specific reason not to. |
| Service / program card photo (you want a tighter cap) | `"480"` – `"720"` | Only if you want the image visibly smaller than the card on wide viewports. |
| 2-up split feature with a big photo | `"800"` – `"1200"` | `"1200"` is fine. |
| Full-bleed image inside a 1-up feature | `"1400"` or higher | Effectively uncapped. |
| Inline icon above a short label | `"80"` – `"120"` | Default 80px is fine for icons. |
| Tiny bullet icon (checkmark, dot) | `"32"` – `"64"` | Explicit, smaller than default. |

**Forbidden values for any `feature` block carrying a real photo (NOT an icon):**
- ❌ `imageWidth` omitted / empty / `undefined` → renders 80px icon, expert reports "images are tiny."
- ❌ `imageWidth: "100"`, `"120"`, `"160"`, `"200"` → still way too small for a card photo.
- ❌ Anything `< 320` on a card photo. If it's a real photo, it needs at least `"320"`. **Default to `"1200"`** — overshooting is harmless, undershooting is the bug.

**Symptom → diagnosis (check `imageWidth` FIRST before anything else):**
- "the images are tiny / small / too small"
- "the photos look like postage stamps / thumbnails / icons"
- "make the images bigger" (especially after a previous "make them bigger" pass)
- "the images aren't filling the cards"
- "the service cards look broken — text is huge but the picture is a dot"

→ **Open the design JSON. Find every `feature` block with `image` set. Confirm `imageWidth` is at least `"480"` (or whatever's appropriate per the table). If it's missing or `< 320`, that's the bug.** Don't go looking at section padding, column widths, or chrome. It's `imageWidth`.

**Pre-flight check — MANDATORY on every site/template build, every redesign, every "make this section feel premium" pass:**

1. Walk every `feature` block in the design.
2. If `image` is set AND it's a real photo (not an icon): `imageWidth` MUST be set explicitly. **Default to `"1200"`** — it fills any card up to that width and never overflows (because the engine renders `width: 100%` capped at `maxWidth: ${imageWidth}px`). Lower caps (`"480"`/`"640"`) are only for cases where you DELIBERATELY want the image visibly smaller than the card.
3. If `image` is set AND it's an icon: `imageWidth` may be omitted (defaults to 80px) or set to a small explicit value.
4. If you're not sure whether it's a photo or an icon, treat it as a photo and set `"1200"`.

**Why this rule is so loud:** this is the #1 most repeated complaint in the project's history. Experts have asked "make the images bigger" 3, 4, 5 times in a row in the same session because the AI keeps bumping the value from `100` to `160` to `200` instead of jumping straight to `"1200"`. **There is no middle ground for card photos. Either it's an icon (≤120px) or it's a photo (default `"1200"`). Nothing in between.** And there is NO downside to `"1200"` on a smaller card — `width: 100%` clamps it to the card's actual width.

**Why this exists technically:** the `feature` block was originally designed as a "feature bullet" pattern (icon + text), and the 80px default reflects that. It's now overloaded as the canonical "card with photo" block too, but the default never moved. Verified in `node_modules/@k-studio-pro/engine/src/blocks/components/Feature.tsx`: when `imageWidth` is set, the image gets `style={{ width: '100%', maxWidth: '${imageWidth}px' }}`; when omitted, it gets a flat `style={{ width: '80px' }}`. Until we ship a separate `service_card` block or change the default, **the AI must override `imageWidth` to a large pixel value (default `"1200"`) on every photo-bearing card.**

---

### 4.18 (removed) — Preview ↔ Kajabi shadow parity is no longer a concern

As of engine 0.4.0, the editor preview and dashboard thumbnails render via the **Liquid pipeline** (the same Liquid templates Kajabi runs at runtime). Shadow values, font sizing, button rendering, and every other CSS detail are now identical between preview and live site by construction — there is no React-renderer to keep in sync. The historical `SHADOW_MAP` parity rule is obsolete; if a shadow looks wrong in preview, it'll look exactly the same wrong on Kajabi (because it IS Kajabi's CSS).



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

### 4.22 Pro templates — set EVERY font weight + size explicitly (never rely on defaults)

🚨 **Common parity bug: preview h1 looks heavier than Kajabi's h1**, even though family + size match. Cause: the template set ONE override (e.g. `custom_h2_font_weight: "500"`) and left h1/h3/etc. to fall back. The preview's `valWithDefault` resolves the catalog default (`font_weight_heading: "700"`), but Kajabi's actual default for the loaded font (especially serif/display fonts like Playfair Display, Lora, Cormorant) is often 500 or 600, NOT 700. So preview renders 700 and Kajabi renders 500 — same family, same size, different weight.

**The rule — every Pro template's `themeSettings` MUST explicitly set:**

**Standard fields (sitewide fallback for Kajabi system pages too):**
- `font_weight_heading`, `line_height_heading`
- `font_weight_body`, `line_height_body`

**Pro per-element overrides — for EVERY heading level the template renders on any page** (`use_custom_fonts: "true"` flow):
- `override_h<N>_font_styles: "true"` (visibility toggle)
- `select_custom_h<N>_font: "primary" | "accent" | "inherit"`
- `custom_h<N>_font_weight: "500"` (explicit number, NOT `"inherit"`)
- `custom_h<N>_line-height: "1.1"` (hyphen, not underscore)
- `custom_h<N>_font_size_desktop: "52px"`
- `custom_h<N>_font_size_mobile: "34px"`

**Body:**
- `override_body_fonts: "true"`
- `custom_body_font_weight: "400"`
- `custom_body_font_line-height: "1.6"`
- `custom_body_font_size_desktop: "17px"`
- `custom_body_font_size_mobile: "16px"`

**Buttons (when CTAs matter):**
- `view_advanced_button_customizations: "true"`
- `btn_font_weight: "500"`
- `custom_button_font_size_desktop: "14px"` + `custom_button_font_size_mobile: "13px"`

**Don't use `"inherit"` for typography the template designed.** `"inherit"` means "use the cascade" — and the cascade differs between preview (catalog defaults) and Kajabi (loaded font's actual defaults). Reserve `"inherit"` only for fields the template genuinely doesn't care about.

**Pre-flight checklist — every Pro template build (and every existing Pro template audit):**
1. Walk every page in the template; collect the set of heading levels actually rendered (h1, h2, h3, …).
2. For EACH level, confirm `override_h<N>_font_styles: "true"` + weight + line-height + desktop size + mobile size are all set explicitly.
3. Confirm Standard `font_weight_heading` + `font_weight_body` + line-heights are set.
4. Confirm body overrides are set (weight + lh + sizes).
5. Confirm button advanced overrides are set if any CTAs exist.
6. Refresh preview, compare to a Kajabi export side-by-side — every heading should match weight exactly.

**🚨 Common silent gap (verified 2026-04 on the Pro Functionality site):** the per-heading overrides (`custom_h1_font_weight`, etc.) can all be set correctly while the **Standard sitewide fallback fields** (`font_weight_heading`, `line_height_heading`, `font_weight_body`, `line_height_body`) are still `undefined`. Per-element overrides only target `h1/h2/h3...` rendered through composed sections; the Standard fields are what Kajabi system pages (login, store, checkout, blog) and the preview's Standard fallback path use. If they're undefined, those pages render with Kajabi's base-theme defaults (heading 700, body 400/1.6) which usually diverges from the brand. **The audit MUST check both layers** — per-element overrides AND Standard sitewide fields. Set the Standard fields to match the per-element values (e.g. heading 500/1.1, body 400/1.7) so system pages inherit the brand consistently.

See `mem://reference/template-explicit-font-weights.md` for full anti-pattern + worked example.

### 4.23 NEVER place white blocks on white sections — they vanish into the page

🚨 **Verified 2026-04 on the Pro Functionality landing page.** A `pricing_card` or `accordion` (or any chrome-bearing block) with `backgroundColor: "#FFFFFF"` placed inside a section whose `background` is also white renders on Kajabi as a **borderless rectangle that bleeds into the page** — the card's only edge is the small `box-shadow` (per §4.18, single soft shadow at 5–10% alpha), which is too subtle to define a boundary on a pure-white surround. The expert sees: "the cards have no edges", "everything looks like one flat white blob", "the accordions don't look like cards anymore." Outer pricing tiers in a 3-up grid are the most common offender (the dark middle "highlight" tier is fine — it has its own contrast).

**The rule — never ship a white-bg block on a white-bg section. THINK LIKE A DESIGNER, not a bug-fixer.** The fix is to make the **card itself** a deliberate object on the page — not to recolor the room around it. Tinting whole sections to "make the cards visible" is a reactive, blotchy move: it creates an inconsistent page palette where some sections are cream and others are white for no compositional reason, just because of which blocks happen to live inside them.

**Default fix — tint the BLOCK, not the section.** Pick a warm ivory / off-white that comes from the SAME brand family as the site's accent colors (e.g. if the site has a navy + gold palette, use a warm ivory like `#FBF6EC` that pairs with the gold; if it's a cool grey palette, use `#F7F8FA` that pairs with the slate). The card becomes a deliberate light-register object on a clean white page, and every section keeps its rhythm. Same pattern as the dark "highlight" tier in a 3-up pricing grid — that tier is its own object too; the light tiers should be too, just in the light register.

Order of preference (use the first one that fits the page composition):

1. **Tint the block background** to a warm/cool off-white from the brand family (e.g. `backgroundColor: "#FBF6EC"` on warm palettes, `#F7F8FA` on cool palettes). **DEFAULT CHOICE** — keeps section rhythm intact, treats the card as a designed object, harmonizes with dark highlight tiers in the same grid.
2. **Add a hairline border to the block** that harmonizes with the brand (e.g. `border: "1px solid #E8E2D4"` on warm, `1px solid rgba(0,0,0,0.08)` on cool). Use when the brand is so minimal/monochrome that even a subtle block tint would feel heavy. ⚠️ Engine caveat: the chrome serializer does NOT currently emit `border` to Kajabi (only `border_radius`/`background`/`shadow`/`padding`) — so a `border` value renders in the editor preview but is dropped on export. Until that's fixed in `blockChrome.ts`, treat the border option as preview-only and prefer option 1.
3. **Tint the section background** to a soft off-white. **LAST RESORT** — only when (a) the section is the ONLY content section on the page, OR (b) tinting it actually improves the page rhythm (e.g. an "alternating bands" layout where every other section is already tinted by design). NEVER tint a single isolated section just because it happens to contain a white card — that creates the blotchy palette this rule exists to prevent.

Never rely on shadow alone — Kajabi's stock card shadows are very gentle (5–10% alpha) and don't define an edge on a white surround.

**Anti-pattern (do NOT do this):** "I see three sections with white cards on white backgrounds — I'll tint those three sections cream and leave the others white." This produces a page with no compositional reason for which sections are cream vs white. The expert will (correctly) call it out as an afterthought. Tint the blocks instead — every section stays white, every card pops on its own merit.

**Same rule applies to:** `pricing_card`, `accordion`, `feature` cards, `card`, any block whose visual identity is "a contained tile". Does NOT apply to `text`, `cta`, `image`, `logo` etc. (no chrome to define).

**Pre-flight check before saving any page:** for every `content` section whose `background` is white (`#FFF`/`#FFFFFF`/`white`/`rgb(255,255,255)`), walk the section's blocks. If any chrome-bearing block (`pricing_card`, `accordion`, `feature`, `card`) has `backgroundColor` also white AND `border` is empty, **tint the BLOCK** to a brand-family off-white (option 1 above). Reach for section tinting (option 3) ONLY if you can articulate a compositional reason — "this is the only content section on the page" or "the page already alternates tinted/white bands by design". If the only reason is "the card was invisible", you're doing option 3 wrong; use option 1.

As of engine 0.4.0, the preview renders via Liquid (Kajabi's actual CSS), so this bug is now visible in preview — exactly as it appears on the live site. Tint the block per option 1 and the preview will reflect the fix immediately.

---

### 4.24 CLONING A REFERENCE SITE — map first, build second (mandatory workflow)

🚨 **The single biggest source of "this has been brutal" sessions.** When the expert points at a URL and says "clone this", "match this site", "build me a site like X", "make it look like [URL]", or pastes a URL of their old site and asks you to rebuild it on Kajabi — **DO NOT design from screenshots and vibes**. That path leads to 10+ correction passes (verified across multiple painful sessions: missing sections, invented colors, AI-generated images where the source had real photos, mismatched buttons, "the colors below the fold are still wrong"). The fix is a hard procedure.

**Trigger phrases (any of these = use this workflow):** "clone https://...", "match this site", "build me a site like X", "make it look like [URL]", "use this as inspiration" + URL, "this is my old site, rebuild it on Kajabi", "I want my Kajabi site to look like my Squarespace at [URL]", "clone this landing page".

#### Phase 0 — Decide kind: WEBSITE (multi-page) vs LANDING PAGE (single page)

Before you map anything, know which mode you're in. The site you're editing already has a `kind` (`'site'` or `'landing_page'`) — read it from `get-site-design`. **Match the existing site's kind:**

- **`kind: 'site'`** (multi-page Kajabi website) → clone EVERY page from the source. Use `index`, `about`, `contact`, `programs` etc. as page keys. Phase 1 maps the whole domain.
- **`kind: 'landing_page'`** (single-page export) → clone ONLY the source's homepage (or whichever single page the URL points at). Everything goes under the `index` page key. Even if the source has 8 pages, you collapse to one — pick the most relevant page (the URL the expert pasted) and ignore the rest unless they explicitly ask for an inner page.

If the expert asks "clone https://..." in chat without an existing site selected, ask exactly one question: **"Should this be a full multi-page website or a single landing page?"** Then have them create the site via the New menu (Website or Landing page) and resume from Phase 1 inside that site.

#### Phase 1 — MAP the source FIRST (no design work yet)

Use Firecrawl (already wired in every thin client). For the page(s) you're cloning:

1. **`map`** the domain → discover all inner pages (about, services, contact, programs, etc.). **For `kind: 'site'`:** confirm with the expert which pages to include in the clone. **For `kind: 'landing_page'`:** skip `map` entirely — go straight to `scrape` on the single source URL.
2. **`scrape`** each page with `formats: ['markdown', 'screenshot', 'links', 'branding']`:
   - `markdown` → verbatim copy (every headline, body paragraph, list item, CTA label, form label, footer copyright).
   - `screenshot` → visual reference, you'll consult it section-by-section while building.
   - `links` → all image URLs + outbound links.
   - `branding` → exact colors (primary/secondary/accent/bg/text), fonts (heading + body family), logo URL.
3. **Write a Match Brief** to `/tmp/clone-brief.md` with:
   - **Brand tokens at the top:** primary, secondary, accent, bg, text colors (hex from `branding`); heading font + body font (from `branding.fonts` or screenshot inspection); logo URL.
   - **Per page**, an ordered list of sections — for each section: layout (split? full-width? grid count? slider?), copy verbatim, image URL(s), background color (sampled from screenshot or `branding`), text color, CTA labels + URLs.
   - Example: "1. Sticky header (logo left, nav center, CTA right). 2. Hero: full-bleed image bg `https://.../hero.jpg` + h1 `Build Your Practice` + subhead + 2 CTAs. 3. Stats band — 3 numbers on cream `#F8F4EC`. 4. Services 3-up grid with photos. 5. Testimonial slider. 6. Footer."
4. **Show the Match Brief to the expert** and ask exactly one question: "Here's what I see — N pages, this section breakdown, these colors, these fonts. Anything to change before I build?" Do NOT ask implementation questions. Wait for approval.

#### Phase 2 — DOWNLOAD the real assets

For every image referenced in the Match Brief:

1. Download via `curl` (URLs are already in the Brief from Firecrawl's `links` array).
2. Upload to the site via the `upload-site-image` edge function (per §4.14) → get back a permanent `https://...supabase.co/.../site-images/...` URL.
3. Wire that URL directly into the relevant section/block prop (`backgroundImage`, `src`, `logoSrc`).

**🛑 NEVER call `generate-site-image` to invent a "similar" image when the source has a real one.** The expert's reference site has THEIR photos (or the photos they specifically chose) — use them. AI-generated stand-ins are immediately recognizable as wrong and the expert will (correctly) ask why their real headshot/team photo/venue isn't there. Only use `generate-site-image` for sections the source genuinely doesn't have an image for AND the expert explicitly asks for one.

#### Phase 3 — BUILD page-by-page, hero first, STOP for approval

1. Build the homepage: header + hero ONLY. Save via `update-site-design`.
2. **STOP.** Tell the expert: "Hero is built — refresh and confirm before I continue." Do NOT speculatively build the entire site before any approval gate.
3. After approval, build the rest of the homepage section-by-section, in source order, with verbatim copy and the real image URLs from Phase 2.
4. After homepage is approved, repeat for each inner page in the same order: section-by-section, verbatim copy, real images.

#### Phase 4 — Hard constraints during build

- **No invented sections.** If the source has 6 sections, the clone has 6 sections matching the source's layout. Do not add a "while we're here" CTA section, a "what about a stats band?" section, or any section the source doesn't have. The expert can ask for additions later.
- **No invented colors.** Every color comes from the Match Brief's brand tokens. If a section needs a tint, derive it from the brand palette (lighten/darken via opacity), don't introduce a new hue.
- **No invented fonts.** Use the heading + body font identified in `branding`. If unavailable on Google Fonts, pick the closest match and tell the expert.
- **Verbatim copy.** Use the source's exact copy unless the expert tells you to rewrite. It's their content (or their reference's content) — paraphrasing is rewriting their voice.
- **All other AGENTS rules still apply.** Especially §4.6 (no opaque bg over images), §4.7 (CTA consistency), §4.10 (don't hardcode dynamic content on blog/library/auth pages), §4.13 (footer copyright no leading ©/year), §4.12 (no `fullWidth: true` unless source is genuinely edge-to-edge).

#### Phase 5 — Pre-flight before declaring "done"

Walk every page and verify before telling the expert it's complete:
- [ ] Section count + order matches source for each page.
- [ ] Every CTA across the whole site shares button styling (§4.7).
- [ ] Every image-bearing section uses a real `https://` URL from `upload-site-image` (no `{slot}` refs without backing rows; no `user-uploads://`; no `blob:`/`data:`).
- [ ] No section has opaque hex/rgb over an image (§4.6).
- [ ] Footer copyright has no leading `©`/year (§4.13).
- [ ] No `fullWidth: true` on content sections unless the source is genuinely edge-to-edge (§4.12).
- [ ] `design.pages.page`, `login`, `register`, `forgot_password`, `reset_password` are header+footer only (§4.10, §4.11).
- [ ] `blog`, `blog_post`, `library` use raw sections, no hardcoded mock content from the source's blog/library page (§4.10).

#### Why this exists

Every brutal clone session in the project history followed the same anti-pattern: read the source → form a vibe → ship 8 sections → expert points out section X is missing / colors below the fold are wrong / images are AI-generated instead of real / button #3 doesn't match button #1 → 10+ correction passes. **Mapping first turns a 10-pass slog into a 2-pass build.** The Match Brief takes ~10 minutes; the corrections it prevents take hours.

---

### 4.25 🚨 BLOCK CHROME PROPS — `padding` is ALWAYS an object, keys are ALWAYS camelCase (silent-drop trap)

🚨 **Verified failure mode — both halves are silent.** When you author chrome props (`padding`, `borderRadius`, `backgroundColor`, `boxShadow`, etc.) on any block, two things will look fine in JSON but produce ZERO visual effect:

1. **Scalar `padding` is dropped.** Writing `padding: "32"` (string) or `padding: 32` (number) is a no-op. The engine's `paddingToCss` helper (in `packages/engine/src/blocks/blockChrome.ts`) calls `normalizePaddingObject`, which `JSON.parse`s strings — `"32"` parses to the number `32`, which isn't an object, so it returns `undefined` and emits NO `padding-top/right/bottom/left` rules at all.
2. **snake_case keys are ignored.** Writing `border_radius: "16"`, `background_color: "#FFF"`, `box_shadow: "small"`, `image_width: "480"` (copying Kajabi's Liquid field names) silently does nothing. The serializer ONLY reads camelCase keys: `borderRadius`, `backgroundColor`, `boxShadow`, `imageWidth`. The snake_case key sits in the JSON, valid and ignored.

**The combined symptom:** "I set padding 32 and border radius 16 and a cream background — the background shows up but the cards are flush to the edges and have square corners." Two of three props were silently dropped because both used the wrong shape/key.

**The rule — every chrome prop, every block, every time:**

| Prop | ✅ Correct | ❌ Silently dropped |
|---|---|---|
| Padding | `padding: { top: "32", right: "32", bottom: "32", left: "32" }` | `padding: "32"`, `padding: 32`, `padding: "32px"` |
| Border radius | `borderRadius: "16"` | `border_radius: "16"`, `borderRadius: "16px"` (the engine appends `px`) |
| Background | `backgroundColor: "#F3EAD6"` | `background_color: "#F3EAD6"`, `bg_color: "..."` |
| Shadow | `boxShadow: "small"` (or `"medium"`/`"large"`/`"none"`) | `box_shadow: "small"`, `shadow: "small"` |
| Image cap (feature/image) | `imageWidth: "480"` (per §4.17) | `image_width: "480"`, `img_width: "480"` |
| Border radius on image | `imageBorderRadius: "12"` | `image_border_radius: "12"` |
| Button background | `buttonBackgroundColor: "#1F2A44"` | `btn_background_color: "..."`, `button_bg_color: "..."` |
| Button text | `buttonTextColor: "#FFF"` | `btn_text_color: "..."` |
| Button radius | `buttonBorderRadius: "999"` | `btn_border_radius: "..."` |

**Why the camelCase-vs-snake_case confusion happens:** Kajabi's `settings_data.json` uses snake_case (`border_radius`, `bg_image`, `btn_background_color`) — and you SEE those keys when reading exports or the Kajabi rendering guide. The engine's React props use camelCase (`borderRadius`, `backgroundImage`, `buttonBackgroundColor`) and the serializer translates camelCase → snake_case at export time. **Always author camelCase in `design` JSON. The snake_case keys are output-only.**

**Why scalar padding is so easy to write:** it's the natural shorthand and every other CSS-adjacent system (Tailwind, inline styles, CSS vars) accepts `padding: "32px"`. The engine doesn't — it expects the 4-sided object, no exceptions. Even uniform 32-on-all-sides MUST be the explicit object.

**Pre-flight check on every block authored / every page saved:**

1. For every chrome-bearing block (`feature`, `pricing_card`, `accordion`, `card`, `text` with chrome, `image` with chrome): scan its `props` for any of the snake_case keys in the right column above. If found, **rename to the camelCase equivalent** before saving. Don't just add the camelCase key alongside — DELETE the snake_case one to keep the JSON clean.
2. For every block with a `padding` prop: confirm it's an object `{ top, right, bottom, left }`. If it's a string or number (`"32"`, `32`, `"32px"`), expand it to the 4-sided object.
3. For every block with a `borderRadius` prop: confirm the value has NO `px` suffix (the engine appends `px` itself). `"16"` is correct, `"16px"` produces `16pxpx`.

**Symptom mapping → check key shapes FIRST:**
- "I set padding 32 but the text is flush to the edge" → scalar padding, expand to object
- "I set rounded corners but they're still square" → likely `border_radius` instead of `borderRadius`
- "the background color isn't showing on the card" → likely `background_color` instead of `backgroundColor`
- "the shadow isn't applying" → likely `box_shadow` instead of `boxShadow`
- "feature image is still tiny even though I set image_width: 480" → `image_width` ignored, use `imageWidth` (and re-read §4.17)

**The mnemonic:** in `design` JSON, **every chrome prop is camelCase, padding is always 4-sided.** If you find yourself typing an underscore in a chrome prop key, stop — that key is going into the JSON valid and useless.

**Where this is verified in code:** `packages/engine/src/blocks/blockChrome.ts` exports `serializeChromeProps(p)` and `getBlockChromeStyle(p)` — both destructure `p.padding`, `p.borderRadius`, `p.backgroundColor`, `p.boxShadow` directly. There is no fallback to snake_case names, no automatic key normalization, no warning when an unknown key appears. Silent drop is the default behavior for any unrecognized prop.

---

### 4.25a 🚨 NEVER wrap a block's `text` HTML in `<div style="padding:...">` — use the block's chrome `padding` prop instead

🚨 **Verified failure mode (Aurelian House services overview, 2026-05-08).** When a `feature` (or `pricing_card`, `card`, `accordion`) needs internal padding around its copy, the wrong instinct is to wrap the entire `text` HTML in a `<div style="padding:36px 36px 0 36px">…</div>`. It "works" visually for the text — but the block's button (rendered from `showButton: true` + `buttonText`) is a **SIBLING of the text HTML inside the chrome**, NOT a child of your inner `<div>`. Result: text is nicely padded, button is flush to the card edges, the card looks broken and unbalanced. Same problem for any future hover/border/spacing change — your inline div doesn't cover the whole card surface.

**The rule — internal card padding ALWAYS goes on the block's chrome `padding` prop (4-sided object per §4.25), NEVER inline in HTML.**

```jsonc
// ❌ Wrong — text padded, button flush to card edges
{
  "type": "feature",
  "props": {
    "padding": { "top": "0", "right": "0", "bottom": "40", "left": "0" },
    "showButton": true, "buttonText": "Explore →",
    "text": "<div style=\"padding:36px 36px 0 36px;\"><h3>…</h3><p>…</p></div>"
  }
}

// ✅ Right — chrome padding wraps text + button uniformly
{
  "type": "feature",
  "props": {
    "padding": { "top": "36", "right": "36", "bottom": "36", "left": "36" },
    "showButton": true, "buttonText": "Explore →",
    "text": "<h3>…</h3><p>…</p>"
  }
}
```

**Why this trap is sticky:** the inline-div approach LOOKS right in preview when you only look at the text, and it's the natural CSS instinct. But it fundamentally misunderstands the block's render tree — `text` HTML and the button are independent children of the chrome wrapper. Anything you want applied "to the whole card" (padding, background tint, hover, border) belongs on chrome props, not inside the text field.

**Pre-flight check on every feature/pricing_card/card/accordion save:** scan the block's `text` HTML for any leading `<div style="padding:` (or any wrapper div whose only purpose is layout/spacing). If found, lift those values into the chrome `padding` object and strip the wrapper div. Same rule for inline `margin`, `background`, `border-radius` on a wrapper div around the whole text — those belong on chrome `margin`/`backgroundColor`/`borderRadius` props.

**Allowed inline styles inside `text` HTML:** typography of individual elements (`<h3 style="font-family:...">`, `<p style="color:...">`), small tactical spacing between paragraphs (`<p style="margin:0 0 12px 0">`), inline link colors. NOT card-level layout.

---

### 4.26 🚨 BLOCK CONTENT PROPS — verify EVERY prop name against the engine source before saving (silent-drop trap, applies to ALL blocks not just chrome)

🚨 **Verified failure mode — happens to every block, not just `pricing_card`.** §4.25 covers chrome props (padding, borderRadius, backgroundColor, etc.). This rule covers **content props** — the block's actual data fields like `name`, `text`, `heading`, `price`, `image`, `label`, `url`. The failure is identical and just as silent:

**The trap:** `update-site-design` accepts arbitrary JSON. It does NOT validate prop names against any block's `*Props` interface. So if you write `{ type: "pricing_card", props: { title: "Pro", description: "...", featured: true } }`, the save returns `200 OK`, the JSON sits in the database verbatim, a re-fetch shows your "edits" present — but the renderer ignores every unknown key and draws the card from the (still empty/default) real props. The expert sees no change after save. You see no error.

**Real-world example (verified 2026-04 on the Mastermind pricing section):** AI wrote `pricing_card` blocks using `title`, `description`, `priceSubtext`, `featured`. The actual `PricingCardProps` interface uses `name`, `text`, `heading`, `highlight`. Three full save cycles passed before anyone noticed the cards looked unchanged — every save was technically successful, every prop was silently dropped.

**Common wrong↔right renames (verified against engine source):**

| Block | ❌ Wrong (silently dropped) | ✅ Right (engine reads these) |
|---|---|---|
| `pricing_card` | `title` | `name` |
| `pricing_card` | `description` | `text` |
| `pricing_card` | `priceSubtext` / `caption` | `heading` |
| `pricing_card` | `featured` / `popular` / `recommended` | `highlight` (boolean) |
| `pricing_card` | `badge` / `tag` | `badgeText` |
| `pricing_card` | `accentColor` / `themeColor` | `brandColor` |
| `pricing_card` | inline-styled `<ul>` for features | plain `<ul><li>…</li></ul>` in `text` (engine's `decorateFeatureList` auto-wraps each `<li>` in a branded checkmark chip) |
| `pricing_card` | `align` (the generic block alignment prop) | `textAlign` + `mobileTextAlign` (`'left' \| 'center' \| 'right'`) — drives card content + bullet alignment AND button `alignSelf`. The generic `align` prop is silently ignored on pricing cards. To align bullets left on desktop AND mobile, set BOTH props. See `mem://reference/pricing-card-alignment-props.md`. |
| `feature` | `title` | write inline as `<h3>` inside the single `text` HTML field (per `mem://feature/feature-single-text-field.md`) |
| `feature` | `description` / `body` | `text` |
| `feature` | `imageUrl` / `src` | `image` |
| `feature` | `cta` / `link` | `buttonText` + `buttonUrl` + `showButton: true` |
| `cta` | `text` / `title` | `label` (or `buttonText` — both accepted, prefer `label`) |
| `cta` | `href` / `link` | `url` |
| `text` | `body` / `content` / `richText` | `html` (or `text` — both accepted on the text block) |
| `image` | `url` / `imageUrl` | `src` |
| `image` | `link` / `href` | `imageHref` |
| `accordion` | `title` / `header` | `heading` |
| `accordion` | `body` / `content` | `text` |
| `logo` | `image` / `src` | `logoSrc` (or `image` — check the block) |
| `link_list` | `header` / `heading` | `title` (and per §4.5, omit it on footer link_lists) |

**The rule — every time you author or edit a block:**

1. **Before writing the props object, READ THE BLOCK'S COMPONENT FILE** in the engine to confirm the exact `*Props` interface field names. Source of truth lives at `node_modules/@k-studio-pro/engine/src/blocks/components/<BlockName>.tsx` (thin clients) or `packages/engine/src/blocks/components/<BlockName>.tsx` (master). One `code--view` call per block type you're touching. **Do not guess prop names from "what would make sense"** — every block has a specific schema and the conventions vary (some use `name`, some use `title`, some use `label`, some use `heading`).
2. **Cross-check against `mem://reference/block-field-catalog.md`** for the canonical per-block field list. If the block isn't in the catalog yet, read the source and add it.
3. **Never assume a "natural" name works.** `title`/`description`/`featured` feel obvious — they're wrong on `pricing_card`. `text`/`url`/`label` feel obvious — they're right on `cta`. The only way to know is to check the source.

**Pre-flight check before EVERY `update-site-design` save:**

For every block you authored or edited in this save:
1. Open the block's source file in the engine package.
2. List the block's `*Props` interface fields.
3. Diff against the props object you're about to send. **Any key in your object that's NOT in the interface = silent-drop bug. Either rename it to the right field or remove it.**

**Symptom mapping → suspect wrong prop names FIRST:**
- "I saved the change and refreshed but the card/section looks identical"
- "The expert says nothing changed even though my save returned 200"
- "Re-fetching shows my edits in the JSON but the preview ignores them"
- "The card has my new background color (chrome prop) but my new title/body (content props) are missing"
- "The badge isn't showing even though I set `badge: 'POPULAR'`"

→ **Open the block source. Compare prop names to the interface. If any prop you set isn't in the interface, that's the bug.** Don't go looking at chrome, padding, the renderer, or the save endpoint. It's the prop name.

**Why save validation isn't the answer.** Adding strict prop validation to `update-site-design` would break legitimate use cases (forward-compat for new fields the master engine adds before thin-client engines update; experimental blocks; migration windows). The save endpoint is correctly permissive. **The discipline must live in the AI: read the block source before authoring, every time.**

**The mnemonic:** **two API responses look identical after a save: "wrote your fields" and "wrote your fields and threw most of them away." 200 OK does NOT mean your change took effect — only the render does.** Always verify in the live preview after save, and if nothing changed, suspect prop names before anything else.

**Engine maintainer rule — same class of bug, different layer.** §4.25/§4.26 cover the AUTHORING side (don't write wrong prop names in `design` JSON). The mirror failure on the ENGINE side is **drift between a block's `.serialize` function and the registry-derived allowlist in `schemaRegistry.ts`** (generated from each base theme's `{% schema %}`) — the serializer emits a snake_case field, the registry validator strips it because it isn't in the parsed schema, the field never reaches `settings_data.json`, the live Kajabi site renders without it. Same symptom ("I set this prop, the live site ignores it"), different root cause. **After editing any block component's `.serialize` or after regenerating the schema registry, run the audit:**

```bash
deno run -A scripts/audit-block-schema-drift.ts
# or: bun run audit:schema
```

It prints every field a serializer emits that isn't in the matching allowlist. For each row, decide: (a) add to schema (most common — silent-drop bug), (b) remove from `.serialize` (not a real Kajabi field), or (c) ignore (intentionally local-only — document why). Re-run until clean before bumping the engine version.

**Known editor-only props that don't (yet) export — document, don't paper over.** Some block props render correctly in the Lovable preview but have NO matching Kajabi schema field, so the audit will flag them. Don't blindly add them to the schema (Kajabi will reject the upload or silently drop them). Either (a) ship a real Kajabi-side feature (Liquid + schema + settings) before whitelisting, OR (b) leave the prop preview-only and document it as such in the block's memory file. Current verified preview-only props:

- `pricing_card.highlight` — adds translateY lift + accent stripe + colored shadow in preview; doesn't export. Workaround: page-level `customCss` (see `mem://reference/pricing-card-kajabi-structure.md`).
- `pricing_card.badgeText` — preview pill; on export it silently REPLACES the `name` field (lossy). Workaround: same as above, plus keep a real `name` value separately.
- `pricing_card.priceFontFamily` — would override the price font; not in `PRICING_BLOCK_FIELDS`.
- Any `*FontFamily` / `*FontWeight` per-block prop — Kajabi font control lives in `themeSettings` (per §4.22), not per-block. Lift these to `themeSettings` instead of trying to emit them as block fields.

When a thin client reports "the highlighted tier is flat on Kajabi but lifted in preview" or "the MOST CHOSEN badge is missing on the live site, and the card is named MOST CHOSEN instead of Pro", the cause is one of these props. Send them the customCss workaround from the pricing-card memory file; do NOT promise the prop will work after the next engine bump unless you've actually shipped the schema + Liquid + serializer changes.

---

### 4.26a 🚨 NEVER INVENT SCHEMA FIELD IDS — same rule as §4.26 but for themeSettings & section fields

🚨 **Verified failure mode (Ascend site Style Guide, 2026-05-08).** Authored Pro custom-font setup with `primary_font_link`, `primary_font_family`, `accent_font_link`, `accent_font_family` — NONE exist in `streamlined-home-pro`'s `config/settings_schema.json`. `update-site-design` returned 200, the JSON contained the keys, but the Style Guide UI showed blank because the REAL fields (`use_custom_fonts`, `font_stylesheet_links`, `use_primary_custom_font`, `primary_custom_font_name`, `primary_custom_font_fallback`, `use_accent_custom_font`, `accent_custom_font_name`, `accent_custom_font_fallback`) were never written.

§4.26 covers block content props. THIS rule covers `themeSettings`, section-level settings, and any other field IDs you write into `design`. The bug shape is identical: `update-site-design` accepts arbitrary JSON without validating against any schema, so invented field IDs sit valid and useless. The Style Guide / editor UI / Liquid renderer all read from the REAL field IDs only.

**The rule — for EVERY themeSettings / section-settings / block-field write:**

1. **Verify the field ID exists in the base theme's parsed schema BEFORE saving.** Sources of truth, in order:
   - `packages/engine/src/engines/schemaRegistry.ts` / `schemas.generated.json` (the parsed `{% schema %}` from each base theme — covers section settings + block fields)
   - `mem://reference/pro-custom-fonts.md` + `mem://reference/pro-custom-fonts-value-formats.md` (Pro themeSettings: fonts, buttons, forms)
   - `mem://reference/block-field-catalog.md` (per-block fields)
   - The base theme zip's `config/settings_schema.json` directly — extract it (`unzip base-theme.zip config/settings_schema.json -d /tmp/`) when the registry doesn't have what you need
2. **Never guess by analogy.** "primary_font_link sounds right because it's a font link" → wrong. Read the schema. Pro's actual field is `font_stylesheet_links` (a textarea holding raw `<link>` HTML for ALL fonts, primary + accent together) — nothing like the made-up name.
3. **200 OK is NOT validation.** The save succeeded means "we wrote your JSON to the row." It does NOT mean "the fields you wrote are real." Only the rendered editor UI / live Kajabi proves the fields took effect.

**Pre-flight on every themeSettings or styling write:** list every field ID you're about to set. For each one, confirm it appears in `schemas.generated.json` (or the relevant memory file). If any field can't be found, it's invented — find the real name before saving.

**Symptom → suspect invented field IDs FIRST:**
- "Saved themeSettings, refreshed the editor, Style Guide is still blank"
- "Set use_custom_fonts: 'true' and the font names but Kajabi shows the default font"
- "Re-fetching shows my themeSettings keys present in the JSON but the UI ignores them"

→ Open `schemas.generated.json` and grep for each key you wrote. Any miss = the bug.

See `mem://reference/never-invent-schema-field-ids.md`.

---

### 4.27 🚨 HEADER + FOOTER BLOCK ALLOWLIST — registry-driven, not a hand-coded shortlist

🚨 **The truth comes from the imported base-theme zip, not a frozen list.** Each base theme's `sections/{header,footer,footer_pro}.liquid {% schema %}` declares which block types that section accepts. Engine 0.4.x+ serializes against that registry (`packages/engine/src/engines/schemaRegistry.ts`, generated from the four base-theme zips) — anything not allowed for the *current `baseTheme`* is silently dropped on export. The hard-coded React allowlist in `sections.tsx` is now just a fast-path fallback for callers that don't pass `baseTheme`.

**Verified per-theme allowlists (extracted from `schemas.generated.json`, 2026-05-04):**

| Theme | Header blocks | Footer (`footer`) blocks | Pro footer (`footer_pro`) extra blocks |
|---|---|---|---|
| `streamlined-home` | `logo`, `menu`, `dropdown`, `user`, `cta`, `hello_bar`, `social_icons` | `logo`, `link_list`, `copyright`, `social_icons` | — |
| `streamlined-home-pro` | same as Standard | same as Standard | adds `accordion`, `audio`, `assessment`, `blog`, `cta`, `countdown`, `code`, `card`, `event`, `event_video`, `feature`, `form`, `image`, `multi_video`, `offer`, `pricing`, `text`, `video`, `video_embed`, `external_widget` (plus `link_list`/`copyright`/`social_icons`) |
| `encore-page` | same | same | — |
| `encore-page-pro` | same | same | same Pro footer set as `streamlined-home-pro` |

**Reading the table:**
- **Header** is identical across all 4 themes. `dropdown`/`user`/`hello_bar` are valid Kajabi blocks but currently render as opaque/raw in our editor (no first-class React component yet — they round-trip through opaque passthrough; see `mem://feature/opaque-block-passthrough.md`).
- **Standard footer** is the small 4-block set on every theme.
- **Pro footer (`footer_pro`)** unlocks ~20 extra block types — newsletter forms (`form`), CTAs, feature/card grids, blog teasers, countdowns, multi-column rich content. This is what makes a Pro footer "richer" than Standard.
- The exporter chooses `footer` vs `footer_pro` automatically based on the theme: Pro themes serialize the footer slot as `footer_pro` (see `exportEngine.ts` + `schemaRegistry.ts`).
- **`<ContentSection>`** is also registry-driven; the catalog of section/block types it accepts is wider than any hard-coded list and grows as themes ship new block types.

**Authoring guidance still applies even though the registry is permissive:**
1. **Prefer the canonical block.** `logo` for wordmarks (not `text`), `link_list` for footer columns (not `menu`), `copyright` for the legal line. The registry is wide but the editor's React renderer is still narrower — unknown blocks render as opaque placeholders in the preview.
2. **Pro footer blocks only work on Pro themes.** Putting `feature`/`form`/`card` in a footer on a Standard site → silently dropped on export. Confirm `base_theme` is `*-pro` before reaching for the extended set.
3. **Without a `baseTheme` argument**, `serializeTree` falls back to the hard-coded set in `sections.tsx` and the historical silent-drop bug returns. Always pass `baseTheme`.

**Critical:** `text`, `image`, `feature`, `card`, `pricing`, `accordion`, `code`, `cta`, `form`, `menu` (in footer), `link_list` (in header), etc. are ALL silently dropped if placed outside the matching allowlist. No save error, no export error, just a missing block on the live site.

**The most common authoring mistakes (verified across 12 sites in the fleet, 2026-05 audit, 165 disallowed blocks total):**

| Wrong (silently dropped) | Right |
|---|---|
| `text` block in header used as a "wordmark" (`<p>BRAND</p>`) | `logo` block with `logoType: "text"`, `logoText: "BRAND"`, plus `logoTextFontFamily`/`logoTextFontSize`/`logoTextFontWeight`/`logoTextLetterSpacing`/`logoTextColor` |
| `image` block in header for a logo image | `logo` block with `logoType: "image"`, `logo: "<https url>"`, `logoWidth: "..."` |
| `text` block in footer for a tagline / brand line / address | `logo` block (`logoType: "text"`) for the brand line; `copyright` block for the legal line; or move tagline copy into a content section ABOVE the footer |
| `text` block in footer for the `© 2026 Acme` line | `copyright` block with `text: "Acme"` (per §4.13 — Kajabi auto-prepends `© <year> `) |
| `image` block in footer for a logo image | `logo` block with `logoType: "image"` |
| `menu` block in footer (Kajabi rejects `menu` from footer schema) | `link_list` block (footer's canonical "navigation column" block) |
| `feature` / `card` / `pricing` / `accordion` in header or footer | Move to a `content` section between header and footer |

**The rule — every header/footer authoring decision:**

1. **Brand wordmark or logo image in the header?** → `logo` block (`logoType: "text"` or `"image"`). Never `text`, never `image`.
2. **Navigation links in the header?** → `menu` block.
3. **CTA button in the header?** → `cta` block.
4. **Social icon row in header or footer?** → `social_icons` block.
5. **Link columns in the footer?** → `link_list` blocks (per §4.5, omit titles by default). Never `menu`.
6. **Brand wordmark/logo in the footer?** → `logo` block.
7. **Legal/copyright line in the footer?** → `copyright` block (per §4.13, no leading `©`/year).
8. **Anything else** (tagline paragraphs, "stay in touch" prose, mission statement, "made with care" lines, address blurbs, testimonials) → these belong in a CONTENT section above the footer, NOT in the footer itself.

**Symptom mapping → check allowlist FIRST:**
- "the live site has no logo / no header brand mark" → text or image block in header (should be `logo`)
- "the footer is missing the brand line / tagline / 'made by ___' line" → text block in footer (should be `logo`/`copyright` or moved above the footer)
- "the footer column links don't show up" → likely `menu` in footer (should be `link_list`)
- "I see the block in the editor preview but not on the exported site" → 99% chance it's an allowlist violation

**Engine 0.3.10+ surfaces this as a console warning the moment the renderer encounters a disallowed block:**
```
[siteDesign] Block type "text" is not allowed in <headerSection> (section "Header"). It will be DROPPED on Kajabi export. For wordmark/brand text, use a <Logo> block (logoType: "text" or "image") instead.
```
The block is also visually dropped from the preview (matching export behavior) so the bug is immediately visible.

**Pre-flight check before saving any header or footer:**
1. Look up the site's `base_theme`. If unknown, treat as Standard.
2. For every block in a `header` section, confirm its `type` is in the header column above for that theme.
3. For every block in a `footer` section, confirm its `type` is in the footer column above for that theme — and remember Pro themes unlock the `footer_pro` extended set, Standard themes do NOT.
4. If any block fails the check, REWRITE it to the canonical block per the table above before calling `update-site-design`. Don't save and "fix it later" — the expert may export in the meantime and ship a broken site.

**Canonical text wordmark (the fix for the most common case — `text` in header):**
```ts
{
  type: "logo",
  props: {
    logoType: "text",
    logoText: "VANGUARD",
    logoTextFontFamily: "Playfair Display",
    logoTextFontSize: "22",
    logoTextFontWeight: "500",
    logoTextLetterSpacing: "3",
    logoTextColor: "#F8F4EC",
    logoUrl: "/",
    width: "3",
    align: "left",
  }
}
```

**Canonical footer copyright (paired with §4.13):**
```ts
{
  type: "copyright",
  props: { text: "Acme Coaching · All rights reserved" }   // NO leading © or year
}
```

---

### 4.28 🚨 NEVER use section-level `maxWidth` (or any renderer-only CSS) to constrain block layout — use the 12-column grid

🚨 **Verified silent-drop on Kajabi export.** Setting `maxWidth: 920` (or any pixel/`%` value) on a `ContentSection`'s props constrains the inner column in the Lovable preview — the section looks ~3/4 width and nicely centered. **Kajabi's `settings_data.json` section schema has no `max_width` field**, so the serializer silently drops the prop on export. Kajabi then renders the section at full container width, and any block inside with `width: "12"` stretches edge-to-edge. Same JSON, two completely different layouts: tidy in preview, full-bleed on the live site. Same class of bug as inline-CSS-instead-of-platform-primitives (see §9.8e PRO STYLING and §4.15 native block buttons).

**The rule — constrain layout with the 12-column block grid, not section CSS.** Kajabi's section row centers any sub-12 block inside the 12-column container automatically, and the preview renders the same way (per `mem://feature/preview-grid-parity.md`). Both renderers honor the grid identically; both ignore section-level `maxWidth`.

**Width recipes (apply to every block in the section, including the section heading text block):**

| Visual goal | Block `width` | Block `align` | Approx. on-page width |
|---|---|---|---|
| Tight reading column (long-form copy, FAQ) | `"6"` | `"center"` | ~50% |
| Standard centered column (accordion, agenda, narrow CTA stack) | `"8"` | `"center"` | ~67% |
| Loose centered column (wider feature list, testimonial column) | `"10"` | `"center"` | ~83% |
| Full bleed (hero copy, full-row grids, splits) | `"12"` | `"center"` / `"left"` | 100% of container |

**Forbidden on `ContentSection` props (all renderer-only, all silently dropped on export):**
- ❌ `maxWidth` (any value)
- ❌ `width` on the section itself (sections don't have a width prop in Kajabi's schema)
- ❌ Inline `<style>`/CSS in custom HTML to clamp container width
- ❌ Wrapping every block in a `<div style="max-width:920px;margin:0 auto">` inside `text` HTML

**Symptom mapping → check section-level `maxWidth` FIRST:**
- "this section looks centered and narrow in the preview but stretches edge-to-edge on Kajabi"
- "the FAQ accordions are full-bleed on the live site but ~3/4 width in preview"
- "the agenda is centered nicely on Lovable but huge on Kajabi"
- "the section reads fine here but is way too wide after export"

→ Open the section's props. If `maxWidth` is set, **remove it** and re-author every block inside with `width: "8"` (or `"6"`/`"10"` per the recipe) + `align: "center"`. Don't leave `maxWidth` "for the preview" — it lies.

**Pre-flight check on every site/section save:** scan every `ContentSection` props object for any `maxWidth` key. If found, delete it AND audit the section's blocks: if any block has `width: "12"` and the section was visually narrow in your editor, change those blocks to `width: "8"` + `align: "center"` so the constraint survives export.

**Why this exists:** §4.12 already forbids `fullWidth: true` (the inverse mistake — breaking blocks OUT of the 1170px container). This rule covers the symmetric mistake — using a non-existent section field to clamp INWARD. Both bugs share the same root cause: trying to control layout with section-level props instead of the block grid that Kajabi actually serializes. **The 12-column block grid is the only width primitive that survives export.**

---

### 4.29 🚨 SCHEMA-DRIVEN EDITOR + DUAL-SHAPE PROPS — the editor writes snake_case for unaliased schema fields, blocks must tolerate both

🚨 **System change you need to know about (engine 0.4.x–0.6.10).** The block field editor (`BlockFieldForm`, `EditorSidebar`) is now **registry-driven** — it reads each block's allowed fields from `schemaRegistry.ts` (parsed from each base-theme `{% schema %}`) and renders inputs for EVERY field the schema declares. Three consequences you must understand:

1. **Author-wins export (Phase B3).** Whatever the editor writes reaches Kajabi. The serializer consults the registry as a 2nd-opinion allowlist — registry-only blocks (e.g. `dropdown`/`user`/`hello_bar` in headers, every Pro `footer_pro` block) survive to `settings_data.json` instead of silent-drop. The hard-coded React allowlist in `sections.tsx` is now a fast-path fallback only. See `mem://feature/registry-aware-export-passthrough.md` and §4.27.

2. **Dual-shape storage is intentional.** First-class blocks (`text`, `cta`, `feature`, `pricing_card`, `image`, `logo`) have BOTH camelCase and snake_case keys coexisting in saved JSON. The editor writes snake_case (Kajabi schema names) for any field without a `.deserialize()` alias on the block; the block's React component reads camelCase. This is NOT a bug — do NOT "normalize" or rewrite block JSON to one shape. Both shapes save, export, and round-trip correctly.

3. **The render-time gap is closed by `readField`.** When a block component needs to read a prop that has a snake_case schema sibling, use the `readField` helper from the engine barrel:
   ```ts
   import { readField } from '@k-studio-pro/engine';
   const bg = readField<string>(props, 'buttonBackgroundColor', 'btn_background_color');
   const label = readField<string>(props, 'label', 'buttonText', 'btn_text');
   ```
   Apply on demand per-block — don't pre-emptively retrofit every component. If an expert reports "I changed this field in the editor, save succeeded, but preview ignores it," the fix is one `readField()` call swapping the bare `props.X` read for the dual-shape read. See `mem://feature/readfield-dual-shape-reader.md`.

**Authoring implication for site edits via `update-site-design`:** §4.26's rule still applies — verify prop names against the block's `*Props` interface before saving. The editor handles dual-shape automatically; AI-authored JSON should still prefer the camelCase canonical names the block component reads natively (avoids needing a `readField` retrofit later).

**Pre-flight on every engine bump:** if a block component is reported as "ignoring an editor change," check whether the field has a snake_case schema name distinct from the block's prop name. Add a `readField` call rather than renaming the schema field or forcing the editor to write the camelCase alias.

---

### 4.30 🚀 ANATOMY OF A NEW SITE BUILD — branding first, then structure, then content

The single most common failure mode when building a fresh site is going block-first and discovering halfway through that every CTA needs to be re-coloured, every heading re-weighted, and every section re-padded because `themeSettings` was never set. Branding must come BEFORE composition — §4.7 (CTA consistency), §4.22 (explicit font weights), and §4.23 (white-on-white) all assume the brand tokens already exist.

**The ordered procedure — every new `kind: 'site'` build:**

1. **Confirm `kind` and `base_theme`.** `get-site-design` reveals both. Pro themes (`*-pro`) unlock §4.27's footer_pro blocks and PRO_CAPABILITIES.md's slider/columns/font overrides; Standard themes silently drop them. Don't author Pro-only blocks on a Standard site.
2. **Set sitewide branding via the 🎨 panel OR direct `design.branding` write.** 3 colors + 2 fonts (`colorPrimary`, `colorAccent`, `fontFamilyHeading`, `fontFamilyBody`) — fills empty `themeSettings`/`fonts` slots at export so Kajabi system pages (login/store/checkout) inherit the brand. See §4.33.
3. **Set explicit `themeSettings` typography.** Per §4.22: every heading level rendered + body + buttons. Standard fields (`font_weight_heading`/`line_height_heading`/etc.) AND per-element overrides (`override_h<N>_font_styles:"true"` + weight + lh + sizes). Skipping this = preview/Kajabi font weight mismatch.
3a. **Set sitewide CSS resets in `customCss` BEFORE composing.** Three Kajabi defaults silently leak through brand styling and cause "why does this look off" bugs later. Emit ALL of them on every new site:
    ```css
    /* Button shadow — Kajabi base .btn ships with shadow; brand buttons are flat */
    .btn, a.btn, button.btn { box-shadow: none !important; }
    .header .btn, .header__inner .btn,
    .header .btn:hover, .header .btn:focus { box-shadow: none !important; }

    /* Feature text-button padding leak — base .btn padding (9.5px 30px) bleeds into
       buttonStyle:"text" because Pro's zero-padding override is #block-{id} scoped */
    .feature .btn--text, .feature .btn.btn--text {
      padding: 0 !important;
      margin: 12px 0 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }

    /* Footer link_list title alignment — Pro footer_pro centers .link_list__title by
       default; restyling font/color without resetting text-align leaves titles centered
       while ul/li are left-aligned */
    .footer_pro .link_list__title,
    .footer_pro .link_list h3,
    .footer_pro .link_list h4,
    .footer_pro .link_list ul,
    .footer_pro .link_list li { text-align: left !important; }
    ```
    See `mem://reference/button-shadow-reset.md`, `mem://reference/feature-text-button-padding-leak.md`, `mem://reference/footer-pro-link-list-title-centered-default.md`.
4. **Build header ONCE, build footer ONCE.** Both are SHARED site-wide — define them as `SharedHeader`/`SharedFooter` constants and reuse on every page. Last definition wins on export. Header allowlist: §4.27. Footer copyright: §4.13 (no leading ©/year).
5. **Build pages one at a time, hero first.** Save after each page. For clones: §4.24's map-first procedure is mandatory. **Editorial copy** (testimonials, pull quotes, signatures, magazine-style hero callouts) MUST use inline-styled `<blockquote>`/`<cite>`/`<p style="...">` per `mem://reference/inline-style-html-content.md` — themeSettings only covers semantic tags, not editorial one-offs.
6. **Audit dynamic pages BEFORE first export.** `blog`/`blog_post`/`library` MUST use raw sections (§4.10). `page`/`login`/`register`/`forgot_password`/`reset_password` MUST be header+footer only (§4.10, §4.11).

**Why branding-first matters:** if you compose 5 pages with hardcoded `buttonBackgroundColor: "#000"` on every CTA and THEN realize the brand is navy, you have to walk every page and rewrite every CTA. With `themeSettings.color_button` set first, individual CTAs can omit the per-block override and inherit. Same for fonts — explicit weights before composition means every heading lands right on the first save.

---

### 4.31 🔧 EDITING AN EXISTING SITE — diagnostic order when something looks wrong

When the expert reports "this looks broken" / "X isn't working" / "the live site doesn't match preview," walk this order BEFORE making any edit:

1. **`get-site-design`** — load the current JSON. Never edit blind.
2. **Check the block's prop names against the engine source** (§4.26). 80% of "I saved and nothing changed" reports are silent prop-name drops.
3. **Check chrome key shape** (§4.25). camelCase + 4-sided padding object + no `px` on borderRadius.
4. **Check allowlist** (§4.27). Header/footer blocks outside their schema are silently dropped on export.
5. **Check section-level layout traps** — `fullWidth: true` (§4.12), `maxWidth` (§4.28), opaque bg over image (§4.6).
6. **Check dynamic-page hardcoding** (§4.10) — blog/library/auth pages with composed mock content.
7. **Check feature `imageWidth`** (§4.17) — default 80px icon when omitted.
8. **Check brand consistency** (§4.7) — audit every CTA on the site before changing one.
9. **Only then edit, mutate in place, save the FULL design back.** Never POST a fresh design — wipes other pages.
10. **🚨 SCREENSHOT BEFORE DECLARING DONE.** After any meaningful section change — and ALWAYS before telling the expert "done" — open `browser--navigate_to_sandbox` to `/sites/<id>/editor?page=<key>` and `browser--screenshot` the Liquid preview. Look at it. Critique against §4.7 (CTA consistency), §4.17 (image sizing), §4.23 (white-on-white), §4.12 (full-width), §4.28 (maxWidth), and plain taste (composition rhythm, palette balance, type pairing). Iterate until it looks killer, THEN declare done. Cost: ~5–10s per screenshot — cheap insurance against shipping a "looks off but I can't say why" page. **Skip this only for trivial copy edits** (one headline, one paragraph) where the change is invisible to layout review.
11. **Pattern-match against the exemplar library when stuck.** Call `getExemplarSites()` (or `getExemplarSites(['wellness', 'luxury'])`) to load admin-flagged "killer" reference sites with their full `design` JSON. Use them for composition rhythm, palette, type pairing, block choices — pattern-match, do NOT copy verbatim. Especially valuable for vague briefs ("make me a coaching site") and "this looks off but I can't say why" recoveries.

**Symptom → first suspect (memorize this table):**

| Symptom | First place to look |
|---|---|
| "Saved 200 OK but preview unchanged" | Prop names (§4.26) → editor `readField` gap (§4.29) |
| "Padding/radius/bg color not applying" | camelCase + padding-as-object (§4.25) |
| "Block visible in preview, missing on Kajabi" | Header/footer allowlist (§4.27) |
| "Centered narrow in preview, full-bleed on Kajabi" | Section `maxWidth` (§4.28) |
| "Hero image not showing, just a colored box" | Opaque bg over image (§4.6) or broken slot ref (§4.9) |
| "Images are tiny/postage-stamp" | `feature.imageWidth` (§4.17) — default `"1200"` |
| "Cards have no edges on white section" | White-on-white (§4.23) — tint the BLOCK |
| "Headline weight differs preview vs Kajabi" | Explicit font weights missing (§4.22) |
| "Buttons look mismatched across the site" | CTA consistency audit (§4.7) |
| "Header button looks different / has weird elevation vs hero button" | `.btn` shadow not reset in customCss (`mem://reference/button-shadow-reset.md`) |
| "Testimonial / pull quote looks like plain body copy on Kajabi" | Editorial copy needs inline-styled `<blockquote>`/`<cite>` (`mem://reference/inline-style-html-content.md`) |
| "Footer titles centered but lists left-aligned" | Pro `.link_list__title` default not reset (`mem://reference/footer-pro-link-list-title-centered-default.md`) |
| "Editor alignment toggle did nothing on a footer block" | Block needs all 3 shape props: `align` + `text_align` + `textAlign` (§4.29) |
| "Feature card 'Explore →' button indented from card edge" | `.btn` base padding leaks into text-style buttons (`mem://reference/feature-text-button-padding-leak.md`) |
| "Partial CSS override worked for color but not alignment/padding/shadow" | Override resets ONE property, Kajabi default still wins on the others — reset every property the default touches |
| "Fake login form rendering on top of real form" | Auth pages composed (§4.10) — strip to header+footer |

---

### 4.32 📄 LANDING PAGE (`kind: 'landing_page'`) vs SITE (`kind: 'site'`)

`sites.kind` is set at creation and locked. The two kinds share the engine but differ in scope:

| Aspect | `kind: 'site'` | `kind: 'landing_page'` |
|---|---|---|
| Page count | Many (index/about/contact/blog/library/etc.) | One (`index` only) |
| Page keys | Multiple, must include Kajabi system pages | Just `index` |
| Dynamic pages | Required (`blog`/`library`/auth — §4.10) | N/A — single page only |
| Header/footer | Shared across all pages | Single page, single header/footer |
| Cloning a URL | Clone all pages (§4.24 Phase 1 maps domain) | Clone the single source URL only |
| Export | Full site zip | Single landing page zip |
| Adding pages | Routine (`page_keys` + `templates/<name>.liquid`) | NEVER — collapses to one page |

**When the expert says "clone https://..." on a landing-page site:** scrape only the single URL (skip Firecrawl `map`), build only `index`, ignore the source's about/blog/etc. unless they explicitly ask for an inner page. See §4.24 Phase 0.

**When in doubt which kind a fresh chat is:** `get-site-design` returns `kind` in the response. Always check before assuming.

---

### 4.33 🎨 BRANDING PANEL AWARENESS — `design.branding`

The 🎨 toolbar in the editor writes `design.branding` (3 colors + 2 fonts: `colorPrimary`, `colorAccent`, `fontFamilyHeading`, `fontFamilyBody`). At export, `applyBrandingForExport()` (in `packages/engine/src/siteDesign/branding.ts`) merges these INTO `themeSettings`/`fonts` — but ONLY fills empty slots. Explicit `themeSettings` ALWAYS win.

**Cascade order (highest priority first):**
1. Explicit `themeSettings.color_button` / `font_family_heading` / etc. on the design
2. `design.branding.colorAccent` → fills `themeSettings.color_button` + `color_accent` if empty
3. `DEFAULT_BRANDING` (orange `#ff3e14` + Fira Sans/Open Sans) — last-resort fallback

**When to use which:**
- **Set `design.branding`** for the sitewide brand (Kajabi system pages — login/store/checkout — pick this up via the merged `themeSettings`).
- **Set `design.themeSettings`** directly for fine-grained control (per-heading-level font weights, button radius, custom CSS targets — anything not in the branding panel's 5 fields).
- **Set per-block props** (e.g. `buttonBackgroundColor`) ONLY when one CTA needs to differ from the sitewide button — and even then audit §4.7 first.

**Round-trips through `config/export_report.json`** so re-importing a zip reconstructs `design.branding` (not just the merged `themeSettings`). Never strip it.

---

### 4.34 🚨 NEVER ship a site/landing page as a static HTML file or downloadable artifact

🚨 **Verified failure mode (Kboges sales page, 2026-05-05).** When the expert pastes a long "build me a sales page" / "design me a landing page" / "create a site for X" prompt, the wrong response is to write `sales-page.html` + `styles.css` to `/mnt/documents/` and emit a `<presentation-artifact>`. The right response is to **GET → mutate → POST the real site's `design` JSON via `update-site-design`**. The expert's site lives in master's database; an HTML file is useless to them — they can't import it into Kajabi, can't preview it in the editor, can't iterate on it section-by-section.

**The rule:** every "build / design / create / make me a [page|site|landing page]" request resolves to an `update-site-design` call against a real `siteId`. No exceptions.

**If the request arrives without a `siteId`:** ask the expert for one (route in the editor iframe is `/sites/<siteId>`). Also ask whether to replace an existing page key (e.g. `index`) or add a new page (for `kind: 'site'` only — landing pages collapse to `index`). Do NOT invent an HTML mockup as a substitute "while we wait."

**Forbidden workarounds — every one of these is wrong for a site/landing page request:**
- ❌ Writing `*.html` / `*.css` to `/mnt/documents/`
- ❌ Emitting `<presentation-artifact>` for any site content
- ❌ Generating hero images via `imagegen` for a static HTML mockup (use `upload-site-image` against a real `siteId` instead)
- ❌ "Let me draft the structure as HTML and we can convert it later"
- ❌ Building a React component in the thin client to render the page locally

**The single allowed flow** (from §3 of this file, and `knowledge/AGENTS.md` §3 for thin clients):
1. Confirm/ask for `siteId` and target page key.
2. `get-site-design` → load current `design`.
3. Mutate the target page in place using existing block types (text/cta/feature/pricing_card/accordion/image/etc.) per all §4.x guardrails.
4. For expert-provided images, upload via `upload-site-image` and wire the returned URL.
5. `update-site-design` → save the FULL design back.
6. Tell the expert to refresh the editor preview.

**Symptom of the bug in chat history:** the prior AI turn ends with `<presentation-artifact path="*.html" ...>`, mentions writing files to `/mnt/documents/`, or opens with "Here's your sales page as HTML." If you see any of those patterns, the work is wrong — restart with the §3 flow against a real `siteId`. Do not mechanically "convert the HTML to JSON"; treat it as a fresh build with copy already drafted.

---

### 4.35 🪟 EDITOR SIDEBAR ANATOMY — what shows where (and what to expect after import)

The editor sidebar (`packages/engine/src/shell/components/EditorSidebar.tsx`) renders three layers of sections, in order:

1. **Header** (fixed, top) — the page's `kind: 'header'` section. One per site, shared across all pages.
2. **Page sections** (reorderable) — the per-page `content`/`raw` sections in `design.pages.<currentPage>.sections`. These are the only sections that change when the expert switches pages in the page picker.
3. **Footer(s)** (fixed, bottom) — Pro themes show BOTH `footer_pro` AND the standard `footer` as separate fixed rows. Standard themes show only `footer`. Per §9.2 (PRO_CAPABILITIES), mutual exclusion is author-managed via per-section `hide_on_desktop`/`hide_on_mobile` toggles — the sidebar always lists every footer instance present in the page, regardless of visibility.
4. **Sitewide global sections** (fixed, under footers) — entries in `design.globalSections` for `exit_pop` and `two_step`. These are NOT per-page; they live at the design root and ship to every page on export. They render with a 🌐 globe icon to signal "site-wide overlay, not part of any one page".

**Sitewide slots (header / footer / footer_pro / exit_pop / two_step) AUTO-SEED on every load.** The base-theme `layouts/theme.liquid` declares all of these unconditionally via `{% section "X" %}`. Whatever the layout declares, the sidebar must show — period. The data layer enforces this via two helpers in `packages/engine/src/siteDesign/sharedSlots.ts`, both wired into `mapRowToSite()` in `data/siteStore.ts`:

- `embedSharedSections(design, baseTheme)` — re-injects `sharedHeader` / `sharedFooter` / `sharedFooterPro` into every page; on Pro themes auto-seeds blank entries for any missing footer slot so BOTH `footer` and `footer_pro` rows appear in the sidebar.
- `ensureGlobalSections(design)` — auto-seeds blank `kind: 'raw'` entries for `exit_pop` + `two_step` in `design.globalSections` if missing. The list lives in `GLOBAL_SECTION_TYPES` — if Kajabi adds another sitewide slot to `theme.liquid` (e.g. `cookie_banner`), add it there.

**Result:** an expert's site ALWAYS shows every layout-declared slot in the sidebar, regardless of whether the original import populated them. There is no "re-import the zip" recovery dance anymore. Storage stays minimal (only edited slots persist explicit content; auto-seeded blanks are filled in on read), and the live Kajabi site is unaffected either way — `mergeSettings()` in `exportEngine.ts` preserves untouched original zip keys byte-for-byte.

**Don't manually inject these sections into the saved JSON.** If the sidebar is somehow missing a slot, the bug is in the auto-seed helper or its wiring — fix it there, not by writing empty entries into individual sites' `design` rows.

**Adding a new sitewide slot to the layout:** if Kajabi (or we) add another `{% section "X" %}` to `layouts/theme.liquid`, append `{ type: 'X', name: '<label>' }` to `GLOBAL_SECTION_TYPES` in `sharedSlots.ts`. Every site picks it up on next load.

---

### 4.35aa 🚨 PRO SITE WITH BOTH FOOTERS — pick ONE, hide the other on BOTH breakpoints

🚨 **Verified rule (2026-05-08).** On Pro themes the editor sidebar always shows BOTH a `footer` (Standard) row AND a `footer_pro` row, because `layouts/theme.liquid` declares both `{% section "footer" %}` and `{% section "footer_pro" %}` and the auto-seed (§4.35) injects whichever one isn't already populated. **If both footers contain real content, Kajabi renders BOTH stacked on every page** — the expert sees two footers, one above the other.

**The rule — every Pro site (`base_theme` ending in `-pro`) MUST hide the Standard `footer` by default.** `footer_pro` is the canonical footer on Pro themes (it unlocks the rich block set per §4.27 and §4.35e); the Standard `footer` slot only exists because Kajabi's `layouts/theme.liquid` declares both. **ALWAYS** set `hide_on_desktop: "true"` + `hide_on_mobile: "true"` on the Standard `footer` section — no exceptions, no "decide which one to keep" judgment call. The only time you'd hide `footer_pro` instead is if the expert explicitly asks for the Standard footer (extremely rare; ask first).

```jsonc
{
  "kind": "footer",
  "slotId": "footer",          // the Standard footer (the one you're hiding)
  "props": {
    "hide_on_desktop": "true",
    "hide_on_mobile": "true"
  },
  "blocks": [ /* keep blank or untouched — visibility is what matters */ ]
}
```

**Never leave both footers visible** (live Kajabi stacks them). Both flags MUST be the literal string `"true"` (Kajabi schema enum), not boolean `true`. This is automatic — apply on every new Pro site build AND audit existing Pro sites; if the Standard `footer` lacks both flags, add them before declaring the site clean (add to §4.35ae checklist).

🚨 **NEVER mutate the section `name` to indicate hidden state.** Do NOT rename a footer to `"Footer (hidden)"`, `"Footer — hidden"`, `"[hidden] Footer"`, or any other annotated label. The `name` is the editor sidebar label the expert sees; visibility is communicated by the `hide_on_desktop` / `hide_on_mobile` flags, full stop. The editor's sidebar already grays out / labels hidden rows from those flags — adding `(hidden)` to the name is duplicate, ugly, and pollutes the saved data permanently. Same rule applies to ANY section, not just footers: never encode state into `name`.

**Pre-flight check on every Pro site save:** if the design contains both a `sharedFooter` (slotId `footer`) and a `sharedFooterPro` (slotId `footer_pro`), confirm exactly one has `hide_on_desktop` + `hide_on_mobile` set to `"true"`. If neither is hidden → live site shows two stacked footers. If both are hidden → live site shows no footer. Also confirm NEITHER footer's `name` contains `(hidden)` or any state annotation — if it does, strip the annotation.

🚨 **Stale `__rawSettings` / `__importedSnapshot` will silently override your hide flags.** Verified failure mode (site `96d624db`, 2026-05-09): set `props.hideOnDesktop: true` + `props.hideOnMobile: true` (camelCase) on `sharedFooter`, save returns 200, refetch shows the new flags present — but the standard footer KEEPS rendering. Cause: imported sites carry `props.__rawSettings` (raw Kajabi snake_case settings from the original zip) and `props.__importedSnapshot` (the full original section JSON). Both objects had `hide_on_desktop: false` / `hide_on_mobile: false` from the original import, and the serializer's last-write-wins merge layered the stale `false` values BACK ON TOP of your new `true` values on the way to `settings_data.json`. Live Liquid then rendered the footer because the snake_case raw settings won.

**The fix — when hiding a footer (or any section) on an imported site, write to ALL FOUR shapes simultaneously:**

```jsonc
{
  "kind": "footer",
  "slotId": "footer",
  "props": {
    "hideOnDesktop": true,
    "hideOnMobile": true,
    "hide_on_desktop": "true",        // snake_case Liquid sibling
    "hide_on_mobile": "true",
    "__rawSettings": {                 // ← MUST overwrite, not just camelCase
      "hide_on_desktop": "true",
      "hide_on_mobile": "true"
      /* keep every other key from the original __rawSettings */
    },
    "__importedSnapshot": "...JSON.stringify of the snapshot with the two flags flipped to \"true\"..."
  }
}
```

`__importedSnapshot` is a JSON STRING (not an object) — `JSON.parse` it, mutate, `JSON.stringify` back. Don't just delete `__rawSettings` / `__importedSnapshot` — they carry every non-hide field from the import (block defaults, padding, colors) and dropping them resets the section to base-theme defaults.

**Symptom → suspect this FIRST on imported sites:** "set hideOnDesktop, save 200, refetch shows it, footer still renders." Check `props.__rawSettings.hide_on_desktop` and the parsed `__importedSnapshot.settings.hide_on_desktop`. If either is `false`/`"false"`, that's what's winning. Same class of bug as §4.29 (snake_case vs camelCase storage drift) but at the import-snapshot layer instead of the editor-write layer.

Standard themes (no `-pro` suffix) only have `footer`, so this rule does not apply.

---

### 4.35ab 🪟 ALWAYS seed `exit_pop` + `two_step` with the BASE THEME's default content blocks (never blank)

🚨 **Rule for engine maintainers AND for any flow that creates/resets a sitewide popup slot.** The two sitewide popup sections (`exit_pop`, `two_step`) auto-seed via `ensureGlobalSections()` in `packages/engine/src/siteDesign/sharedSlots.ts` (§4.35). Today they seed **blank** — `{ kind: 'raw', type, name, settings: {}, blocks: {}, blockOrder: [] }`. That's wrong: the expert opens the popup row in the sidebar, sees nothing, and has no starting point. Kajabi's base themes ship REAL default content for both popups (a headline + body + email form + CTA in `exit_pop`; a click-to-open trigger + form in `two_step`) inside `sections/exit_pop.liquid` + `sections/two_step.liquid` `{% schema %}` `presets` / `default` block arrays.

**The rule:**

1. **Brand-new sites** (`createSite` / `createLandingPage` → `buildBlankDesign` / `buildLandingPageBlankDesign`): `design.globalSections` MUST include `exit_pop` AND `two_step` pre-populated with the matching base theme's default `settings` + `blocks` + `blockOrder` (parsed from the schema registry's `presets[0]` or `default_blocks` for that section type on that `base_theme`).
2. **Imported sites** (`importSiteFromZip`): keep whatever the zip carried verbatim (already correct — don't touch).
3. **Auto-seed on load** (`ensureGlobalSections`): when a slot is missing on an EXISTING site, seed it with the base theme defaults too — not blank. Read `base_theme` from the design and pull defaults from the schema registry the same way `buildBlankDesign` does.
4. **Author-side (this AGENTS file consumers):** if you ever programmatically reset a popup (e.g. `delete design.globalSections[i]` then re-add), re-seed with base defaults — never with `{}`.

**Why:** the expert should never see an empty popup editor row. The base theme's defaults are tasteful, on-brand-system, and immediately editable — they give the expert something concrete to mutate instead of a blank slate they don't know how to fill.

**Where to source the defaults:** each base theme zip's `sections/exit_pop.liquid` and `sections/two_step.liquid` end with `{% schema %}` containing `presets` (Kajabi's "starter" content). The schema registry already parses these — extend `sharedSlots.ts` to read them via a helper like `defaultGlobalSectionContent(baseTheme, type)` and pass through `mapRowToSite()` / blank builders.

**Pre-flight check for any future popup-related engine work:** scan for `blocks: {}` / `blockOrder: []` on any `exit_pop`/`two_step` seed path — that's the bug. Replace with the base theme defaults pulled from the registry.

---

### 4.35b 🖼️ IMAGE-TO-LABEL SEMANTIC MATCH (every card photo must depict its label)

🚨 **Verified failure mode (Aurelian House Project Types, 2026-05-07).** When generating a grid of card images (services, project types, programs, tiers), each image MUST visually depict the thing its card label says. The trap: AI generates a batch of "luxury interior" photos and assigns them to labels in arbitrary order — so a foyer + staircase shot ends up labeled "New Construction," a bedroom labeled "Furnishing Projects" looks fine but a kitchen labeled "Major Renovations" is ambiguous, etc. The expert sees mislabeled cards and asks "did you mean to use this image for X?" — the answer is always no, you weren't paying attention to the label.

**The rule — for every card with both an image and a heading/label:** before assigning an image, write down what the label promises and what visual evidence would prove it. Then either (a) generate an image that matches that promise specifically, or (b) pick an existing asset that does. Do NOT batch-generate "premium [industry]" photos and assign them by index.

**Worked examples — what each label demands visually:**

| Card label | What the photo MUST show | What it must NOT show |
|---|---|---|
| New Construction (interior design) | Custom home **exterior** mid-build or freshly completed; architectural shell | Furnished interior styling shot |
| Major Renovations | Before/after pair, or a clearly-renovated kitchen/bath with construction context | Generic styled room |
| Furnishing Projects | Fully styled finished room (bedroom, living, dining) with textiles + art in place | Empty room or exterior |
| Branding / Logo Design | Logo mockup, brand collateral flat-lay, color palette card | Generic "creative workspace" photo |
| Web Design | Screen showing actual site UI, device mockup with design work | Person typing on a laptop |
| 1:1 Coaching | Two people in conversation, intimate setting | Group/seminar room |
| Group Program | Cohort/community setting, multiple people engaged | Single person at a desk |
| Strategy Session | Whiteboard, notes, planning artifacts | Stock "handshake" |

**Pre-flight check on every image-bearing card grid:**
1. List every card label in the section.
2. For each label, name in one sentence what visual proof the image must carry.
3. Check the assigned image (open the URL, look at it). Does it show that proof? If no → regenerate or reassign.
4. Pay special attention to **labels that imply a specific phase or state** ("New Construction" = pre-furnishing, "Renovation" = mid-transformation, "Finished/Completed" = fully styled). Generic interior shots fail all three.

**Why this exists:** it's tempting to generate a batch of "luxury interior design photography" and call it done — they all look beautiful and on-brand. But the expert is selling a **service catalog**, and a mismatched image undermines the credibility of the entire grid. One mislabeled card makes the expert wonder whether the AI understood the brief at all.

**Pair this with §4.17:** image semantic match comes FIRST (does this picture prove this label?), then image SIZE (`imageWidth: "1200"`). Both must be right.

---

### 4.35a 📐 SECTION HEADINGS GO ON THEIR OWN ROW (width: "12")

🚨 **Common silent layout bug.** When a section starts with a heading text block (eyebrow + `<h1>`/`<h2>`/`<h3>` + optional lede) followed by a content grid (3-up cards, 2-up split, etc.), the heading block MUST have `width: "12"` so it occupies its own full-width row. If the heading is authored at `width: "8"` or `"6"` and the next block is also sub-12 (e.g. a card at `width: "4"`), Kajabi's 12-column grid packs them into the **same row** — the heading sits next to the first card instead of above it. Preview shows it. Live site shows it. Looks broken.

**The rule — every section's heading block(s) get `width: "12"` + `align: "center"` (or `"left"`):**

```jsonc
// ❌ Wrong — heading shares a row with the first card
{ "type": "text", "props": { "width": "8", "text": "<h2>Selected Work</h2>" } },
{ "type": "feature", "props": { "width": "4", ... } },
{ "type": "feature", "props": { "width": "4", ... } },
{ "type": "feature", "props": { "width": "4", ... } }

// ✅ Right — heading occupies its own row, cards form a clean 3-up below
{ "type": "text", "props": { "width": "12", "align": "center", "text": "<h2>Selected Work</h2>" } },
{ "type": "feature", "props": { "width": "4", ... } },
{ "type": "feature", "props": { "width": "4", ... } },
{ "type": "feature", "props": { "width": "4", ... } }
```

**To narrow the heading's visual width** (per §4.28 — `maxWidth` is silently dropped), DON'T shrink the block's `width`. Instead either (a) keep `width: "12"` and let `align: "center"` + the heading's natural type size do the work, or (b) wrap the heading copy in a centered `<div style="max-width:720px;margin:0 auto">` inside the text HTML. Block grid stays at 12; visual width is controlled inside the block.

**Pre-flight check on every section save:** if the section has any `text` block whose HTML contains `<h1`/`<h2`/`<h3` AND any subsequent block has `width < 12`, the heading block MUST be `width: "12"`. No exceptions. This pairs with §4.28 (use the 12-col grid for layout) and §4.12 (don't `fullWidth: true` the section).

---

### 4.35c 🚨 CTA ON DARK SECTION — emit BOTH camelCase AND snake_case button props (Liquid reads snake_case)

🚨 **Verified failure mode (Aurelian House CTA section, 2026-05-07).** A `cta` block with `buttonBackgroundColor: "#F5EFE3"` + `buttonTextColor: "#3A2E22"` placed on a dark section (`background: "#3A2E22"`) renders **invisible / transparent on the live Liquid preview** — only the text "Inquire" shows in the dark cream color, no button fill. Cause: Pro's `block_cta.liquid` reads `btn_background_color` / `btn_text_color` / `btn_type` (snake_case schema names), NOT the camelCase prop names. When only camelCase is set on a `cta` block, the `readField` dual-shape fallback (§4.29) covers preview rendering for SOME blocks but NOT the Liquid pipeline reading from `settings_data.json` directly — there the snake_case keys must literally exist on the block.

Compounding factor: Pro's `btn_type` defaults to `"dark"`, which uses `btn_background_color` as the bg. On a dark section you want `btn_type: "light"` (or you want the dark variant's bg slot to carry the cream color). Either way, you MUST emit the snake_case siblings.

**The rule — for every `cta` block placed on a dark section (or any time the button needs to invert from sitewide), emit BOTH shapes:**

```jsonc
{
  "type": "cta",
  "props": {
    "align": "center", "width": "12",
    "buttonText": "Inquire", "buttonUrl": "/contact",
    "buttonStyle": "solid", "buttonSize": "large",
    "buttonBackgroundColor": "#F5EFE3", "buttonTextColor": "#3A2E22", "buttonBorderRadius": "0",
    // 🚨 REQUIRED snake_case siblings for Liquid to render correctly:
    "btn_type": "light",
    "btn_style": "solid",
    "btn_size": "large",
    "btn_background_color": "#F5EFE3",
    "btn_text_color": "#3A2E22",
    "btn_border_radius": "0"
  }
}
```

**Pre-flight check on every CTA save:** if a `cta` block sits in a section whose `background` is dark (any color with luminance < 0.5), or if the button colors deliberately invert from the sitewide button (per §4.7's brand button), the block's props MUST contain the snake_case siblings (`btn_background_color`, `btn_text_color`, `btn_type`, `btn_style`, `btn_size`, `btn_border_radius`). On light sections where the sitewide button colors match, snake_case siblings are optional (the editor's `readField` covers the gap).

**Symptom:** "the CTA button isn't showing — only the text is visible" / "the button background is missing on the dark section" / "Inquire shows as just text on the espresso CTA band." → check for missing snake_case siblings FIRST, before anything else.

**Why this is its own rule (not §4.7 or §4.29):** §4.7 covers cross-site CTA consistency (which colors). §4.29 covers the editor `readField` dual-shape pattern for first-class blocks. THIS rule covers the specific cta-on-dark Liquid render gap that neither catches.

---

### 4.35d 📐 EQUAL-HEIGHT BLOCKS on multi-card grids (set the section toggle, don't eyeball it)

🚨 **Verified 2026-05-07.** When a section contains a horizontal grid of card blocks (`feature`, `pricing_card`, `card`) where each card holds variable-length copy — different headline lengths, different bullet counts, different paragraph sizes — the cards render at **different heights** by default. The grid looks ragged: card 1 ends at 600px, card 2 at 720px, card 3 at 540px. CTAs at the bottom of each card sit at different vertical positions. The page reads as unfinished/amateur.

**The rule — every multi-card grid in a single section gets `equalHeight: true` on the section's props.** Emit BOTH shapes per §4.29 (camelCase for the renderer, snake_case for any Liquid path that reads schema names directly):

```jsonc
{
  "kind": "content",
  "name": "Services Overview",
  "props": {
    "background": "#FBF8F2",
    "paddingDesktop": { "top": "120", "bottom": "120" },
    "equalHeight": true,
    "equal_height": "true"
  },
  "blocks": [
    { "type": "text", "props": { "width": "12", ... } },         // heading row
    { "type": "feature", "props": { "width": "4", ... } },        // card 1
    { "type": "feature", "props": { "width": "4", ... } },        // card 2
    { "type": "feature", "props": { "width": "4", ... } }         // card 3
  ]
}
```

**When to set it:**
- Any section with 2+ horizontal sibling cards (`width: "4"` × 3, `width: "6"` × 2, `width: "3"` × 4) where the cards carry independent body copy.
- Pricing tier grids (3-up `pricing_card`).
- Service/program/feature grids (`feature` blocks with photos + descriptions + CTAs).
- Stat/metric rows where each cell has a label + number + caption of varying length.

**When NOT to set it:**
- Single-card sections (no siblings to align to).
- Sections where the visual intent is staggered/asymmetric heights (rare — confirm with expert).
- Heading-only or copy-only sections (no cards).

**Pre-flight check on every multi-card section:** if the section has 2+ blocks at the same sub-12 width AND those blocks carry text/cta content, set `equalHeight: true` + `equal_height: "true"`. Don't wait for the expert to point out the ragged grid.

---

### 4.35e 🚨 `footer_pro` HAS NO `logo` BLOCK — use `text` (wordmark) or `image` (logo image) instead

🚨 **Verified silent-drop on Pro themes (2026-05-07).** Standard `footer` accepts `logo`. **Pro `footer_pro` does NOT** — its allowlist (verified in `schemas.generated.json`) is `accordion, audio, assessment, blog, cta, countdown, code, card, event, event_video, feature, form, image, multi_video, offer, pricing, text, video, video_embed, external_widget, link_list, copyright, social_icons`. Notice: no `logo`. A `logo` block placed in a Pro footer is silently dropped on export — preview shows the brand wordmark, live Kajabi shows nothing where the logo used to be.

**The rule — when authoring a Pro footer (any site whose `base_theme` ends in `-pro`):**
- **Text wordmark** → use a `text` block with the brand name wrapped in styled inline HTML (`<p style="font-family:...;font-size:...;letter-spacing:...;color:..."><a href="/" style="color:inherit;text-decoration:none;">BRAND</a></p>`).
- **Image logo** → use an `image` block (`src` = logo URL, `imageWidth` = pixel cap, `imageHref` = `/`).
- NEVER use `logo` in `footer_pro`. NEVER.

**Standard footer (themes WITHOUT `-pro` suffix) is unaffected** — `logo` works there as documented in §4.27.

**How to know which footer you're authoring:** the section's `kind` is always `'footer'` in the design tree, but on export the serializer emits `footer_pro` for Pro themes. Check `design.baseTheme` (or the site's `base_theme` column) — if it ends in `-pro`, the footer schema is `footer_pro` and `logo` is forbidden.

**Pre-flight check on every footer save:** if the site is Pro AND any block in a `footer` section has `type: 'logo'`, convert it before saving:
- `logoType: 'text'` → `text` block with styled `<p>`
- `logoType: 'image'` → `image` block with `src` + `imageWidth` + `imageHref: '/'`

This is automatic knowledge — every AI session must check `base_theme` before authoring a Pro footer and pick the right block type without being told. Verified per-theme allowlists live in §4.27's table.

**Treat `footer_pro` like a regular content section.** Pro footers are a 12-column block grid — use the blocks AS grid items. The wordmark `text` block, link-list columns, social row, newsletter form, etc. are placed side-by-side via `width: "3"`/`"4"`/`"6"` and stack vertically when their widths sum past 12. Default brand-line + 2 link columns layout = `text width:"4"` + `link_list width:"4"` + `link_list width:"4"` (sums to 12, single row). Three columns + a newsletter `form` = `width:"3"` × 4. The `copyright` block typically gets `width:"12"` so it lands on its own row at the bottom. NEVER leave block widths at defaults that don't sum to 12 — the result is whitespace gaps or unbalanced columns. Apply §4.35d (`equalHeight: true` + `equal_height: "true"` on the footer's props) when columns hold uneven copy.

---

### 4.35f 🚨 HEADER `logo` BLOCK — typography fields are SILENTLY IGNORED; use `customCss` to match the footer wordmark

🚨 **Verified 2026-05-08.** The header `logo` block accepts `logoTextFontFamily` / `logoTextFontSize` / `logoTextFontWeight` / `logoTextLetterSpacing` props in our editor, but Pro's `snippets/shared_block_logo.liquid` only emits `color` and `width` — every other typography field is dropped. So a header wordmark authored with the same font/size/weight/letter-spacing as the footer's inline-styled `text` wordmark renders as plain default `<p class="logo__text">` (browser default font, default weight, no tracking) on the live site. Footer looks gorgeous; header looks generic.

**The asymmetry to internalize:**
- **Footer wordmark** uses a `text` block with inline-styled HTML → all typography survives (per §4.35e).
- **Header wordmark** MUST use a `logo` block (per §4.27 — `text` is silently dropped from header) → typography props go nowhere → MUST be styled via `design.customCss`.

**The rule — every site with a text-wordmark header MUST emit matching `customCss` targeting `.logo__text`:**

```css
.logo .logo__text, a.logo .logo__text {
  font-family: 'Cormorant Garamond', serif !important;
  font-size: 22px !important;
  font-weight: 500 !important;
  letter-spacing: 4px !important;
  margin: 0 !important;
}
```

Use the SAME font/size/weight/letter-spacing values as the footer wordmark's inline styles so the brand reads identically top and bottom. `!important` is required — Pro's stylesheet sets a default `.logo__text` weight that wins otherwise.

**The mental model — "if you can style the text in the footer, you can style the logo in the header."** The expert sees one brand wordmark in two places; you must make both render the same way despite the underlying schema mismatch.

**Pre-flight check on every header save where `logo` block has `logoType: "text"`:** the site's `design.customCss` MUST contain a `.logo__text` rule with the same typography as the footer wordmark. If not, add it before saving.

---

### 4.35ac 🌱 NEW WEBSITES ALWAYS SEED EVERY KAJABI SYSTEM PAGE FROM THE BASE THEME (never minimal blank)

🚨 **Engine-side rule (engine 0.7.57+).** When `createSite` runs (`kind: 'site'`), the seed design MUST come from importing the chosen base theme's own `config/settings_data.json` — not from a hand-authored minimal `buildBlankDesign` baseline. The base theme zip already ships full default content for EVERY Kajabi system page (`index`, `about`, `page`, `contact`, `blog`, `blog_post`, `library`, `store`, `thank_you`, `404`, `member_directory`, `announcements`, `blog_search`, `newsletter_*`) plus `exit_pop` + `two_step`. Importing it gives the expert the same starting point they'd get downloading the raw Kajabi theme — every system page populated, none missing.

Implemented in `seedDesignFromBaseTheme()` (`packages/engine/src/data/siteStore.ts`): fetches `BASE_THEME_URLS[baseTheme]` → runs `importSiteFromZip(blob)` → uses the resulting `design` as the row's seed. Falls back to `buildBlankDesign(brand)` only if the fetch/import errors. `buildBlankDesign` is no longer the primary seed path for websites — it's a last-resort safety net.

**Landing pages (`kind: 'landing_page'`) are NOT affected** — they intentionally collapse to a single `index` page; `createLandingPage` still uses `buildLandingPageBlankDesign`.

**Pre-flight on any future seeding/blank-builder change:** the rule is "every Kajabi system page must exist on a fresh site, populated with the base theme's own defaults." If you add a new system page to Kajabi's lineup or a new sitewide slot, the right fix is to update the base theme zip — `seedDesignFromBaseTheme` picks it up automatically. Don't hand-author system page seeds in `blank.ts`.

---

### 4.35ad 🚨 STYLE GUIDE FIRST, BLOCK OVERRIDES SECOND, CUSTOM CSS LAST RESORT (cascade discipline — read before authoring ANY styling)

🚨 **The single most repeated styling mistake.** When the AI builds a new site, the wrong instinct is to reach straight for `customCss` (or inline `style="..."` in HTML, or per-block overrides) to set fonts, button colors, heading sizes, spacing, etc. That's backwards. Kajabi's style guide (`themeSettings`) is **template-wide** and is the ONLY layer where typography/colors/buttons can be edited from Kajabi's own UI by the expert later. Anything you put in `customCss` is invisible to the style guide editor, can't be tweaked from Kajabi, and silently overrides whatever the expert sets in the UI — leaving them confused why their style-guide changes have no effect.

**The cascade — apply in this exact order, every time:**

1. **`themeSettings` (style guide) FIRST.** This is the default for **every** styling decision: heading font, body font, font weights, line heights, font sizes per heading level, body color, primary/accent colors, button colors (dark+light pair), button border radius, button font weight, form input styles. Standard themes use the Standard fields (`font_family_heading`, `font_weight_heading`, `color_button`, etc.); Pro themes use BOTH the Standard fields AND the Pro custom-font/button/form overrides (`use_custom_fonts: "true"` + `override_h<N>_font_styles` + `select_custom_h<N>_font` + value enums per `mem://reference/pro-custom-fonts-value-formats.md`). **Build the entire style guide BEFORE composing a single page** — per §4.30 (anatomy of a new site build).

2. **Per-block overrides SECOND** — only when ONE block needs to differ from the sitewide style. Example: a single accent CTA on a hero that uses the LIGHT button pair instead of the dark default → set `btn_type: "light"` on that one CTA. Or one pricing card highlighted in a different brand color than the others → set `backgroundColor` + `buttonBackgroundColor` on that one card. **Never use per-block overrides as a substitute for setting the sitewide style** — if every CTA on the site uses the same custom color, that color belongs in `themeSettings.color_button`, not on every CTA's `buttonBackgroundColor`.

3. **`customCss` LAST RESORT** — only when (a) the style guide genuinely cannot express the style (e.g. targeting a Kajabi-rendered element with no schema field, like §4.35f's `.logo__text` header wordmark typography that Pro's `shared_block_logo.liquid` drops), OR (b) you need a sitewide CSS rule that has no themeSettings equivalent (rare). **Custom CSS is invisible to the style guide editor** — every rule you add is a rule the expert cannot tweak from Kajabi's UI, and silently overrides whatever they set there.

4. **Inline `style="..."` in block HTML is NOT part of the normal styling workflow.** Treat it as effectively forbidden for sitewide or repeated styling. **Never** use inline HTML styles for recurring typography or button styling once the Style Guide exists — that includes `h1–h6`, ledes, eyebrow/kicker text, paragraph/body copy, pull-quote systems, repeated link treatments, or CTA/button styling. If the expert wants a **specific button** customized, do it on the relevant **`cta` block's custom settings / block props**, not in `customCss` and never in inline HTML. The only acceptable inline styling is truly content-specific decoration that cannot live anywhere else (e.g. one accented word in a heading, one inline divider, one one-off emphasized phrase). If you ever must choose an inline text color for that kind of one-off accent, determine dark vs light from the section's **hex background color only** — never from opacity, overlays, or the presence of a background image.

**For fonts specifically — the canonical procedure:**

- **Pro themes (base_theme ends in `-pro`):** use the Pro custom font system. Set `themeSettings.use_custom_fonts: "true"`, link the Google/Adobe/self-hosted font via `font_link_*` fields, then set `font_family_primary_name` (+ optional `font_family_accent_name`). Apply sitewide via `override_heading_font_styles: "true"` + `select_custom_all_headings_font: "primary"` (per `mem://reference/pro-all-headings-font-field-id.md` — singular toggle, plural child fields). For per-element control add `override_h<N>_font_styles: "true"` + `select_custom_h<N>_font` + weight + line-height + sizes per §4.22.
- **Standard themes:** use `themeSettings.font_family_heading` + `font_family_body` (Google Font name) + `font_weight_heading` + `font_weight_body` + `line_height_heading` + `line_height_body`.
- **Only fall back to `customCss` when:** (a) the font isn't on Google Fonts AND can't be linked via Pro's `font_link_*`, OR (b) you need to style a Kajabi-rendered element with no schema field (e.g. `.logo__text` per §4.35f, `.pricing__heading`, `.btn--text` text-link variants beyond what Pro exposes).

**For colors specifically:**
- Sitewide brand colors → `design.branding` (3 colors, fills empty `themeSettings` slots) per §4.33, AND/OR explicit `themeSettings.color_primary` / `color_accent` / `color_button` / `color_button_text`.
- Section background → section's `background` prop.
- One-off block tints → block's `backgroundColor` chrome prop.
- NEVER hand-write `:root { --pathx-color-* }` or `body { color: ... }` into `customCss` — it bypasses the style guide.

**For buttons specifically:**
- Sitewide button look → `themeSettings.color_button` + `color_button_text` + `btn_border_radius` (Standard) OR Pro's button overrides (`view_advanced_button_customizations: "true"` + `btn_font_weight` + sizes per §4.22).
- Per-CTA variation → block-level button props per §4.7's CTA consistency rule (still picks up sitewide via inheritance; only override what differs).
- NEVER hand-write `.btn { background: #... }` into `customCss` — it bypasses every per-block override.

**Symptom mapping → this rule was violated:**
- "I changed the heading font in the style guide but nothing happened" → `customCss` has a `body h1 { font-family: ... }` rule with higher specificity (see `mem://feature/font-controls-before-css.md`).
- "The expert can't change colors from Kajabi" → colors were hardcoded in `customCss` instead of `themeSettings.color_*`.
- "Every page uses the same custom font but the style guide font picker shows Inter" → font was set via `customCss` `@import` + `body { font-family }` instead of `themeSettings.font_family_*`.
- "I tweaked one CTA's color but now ALL CTAs changed" → color was put in `customCss .btn` instead of the one block's `buttonBackgroundColor`.

**Pre-flight check on every new site build AND every existing-site styling edit:**
1. Open `design.themeSettings`. Are the fonts set there? Heading + body weights + line-heights? Button colors + radius? If NO → set them via `themeSettings` FIRST. Don't touch `customCss` until step 4.
2. Open `design.customCss`. Does it contain typography rules (`font-family`, `font-weight`, `line-height` on body/h1/h2/etc.) that DUPLICATE what `themeSettings` should be expressing? If YES → migrate them into `themeSettings` (Standard fields + Pro overrides as appropriate) and delete from `customCss`.
3. Does `customCss` contain color rules (`color`, `background-color`) on body/sections/buttons that DUPLICATE `themeSettings.color_*`? If YES → migrate.
4. Walk every block HTML field (`text`, `html`, rich text) and strip any inline `style="..."` that is carrying recurring typography/button system duties. If the same treatment appears more than once, it belongs in `themeSettings`, a block prop, or the smallest possible `customCss` exception — not inline.
5. ONLY rules that survive in `customCss` are ones genuinely impossible to express in the style guide (e.g. `.logo__text` per §4.35f, complex selectors targeting Kajabi-rendered DOM, animations, `@media` queries beyond Pro's mobile font sizes).

**Repair workflow when a site was styled the wrong way:**
1. Remove all inline HTML typography/button styling first.
2. Strip duplicated sitewide button/color/font rules out of `customCss`.
3. Strip repeated per-block button overrides that are just standing in for the global button system.
4. Rebuild the Style Guide (`themeSettings`) completely.
5. Add back only the minimal justified block-level exceptions (usually a specific `cta` block variant).
6. Add back only the minimal justified `customCss` exceptions.

**Why this exists:** the expert paid for Kajabi's style guide system. Every styling decision the AI hardcodes in `customCss` is a decision the expert can't change later without editing code. The style guide is the contract between the AI build and the expert's ongoing customization — honor it.

See `mem://reference/style-guide-cascade-discipline.md` for the full reference and worked examples.

---

### 4.35ae ✅ NEW SITE / SITE-CLEANUP CHECKLIST — the four things that MUST be true on every `kind: 'site'`

🚨 **The single consolidated checklist for "build me a new site" AND "audit/clean this existing site".** Every one of these is already enforced by an upstream rule (cross-referenced below), but experts repeatedly find sites in the wild that violate one or more of them. Walk this list explicitly on every new build AND whenever an expert asks you to "clean up", "polish", "fix", or "make this site right".

**The four invariants:**

1. **Both popups (`exit_pop` + `two_step`) contain the base theme's default content blocks** — never blank. (§4.35ab + `mem://reference/popup-slots-seed-with-base-defaults.md`.) For new sites this is automatic via `seedDesignFromBaseTheme()` importing the base theme zip on `createSite`. For existing sites missing popup content, re-seed from the base theme's `sections/exit_pop.liquid` + `sections/two_step.liquid` `{% schema %}` `presets[0]` (or extract from the base theme zip's `config/settings_data.json` `current.sections.exit_pop` / `two_step`). The expert should see the SAME starter content they'd get downloading the raw Kajabi theme.

2. **Every Kajabi system page is populated with base theme defaults** — never missing, never empty. (§4.35ac + `mem://reference/new-websites-seed-from-base-theme.md`.) Required pages on `kind: 'site'`: `index`, `about`, `page`, `contact`, `blog`, `blog_post`, `library`, `store`, `thank_you`, `404`, `member_directory`, `announcements`, `blog_search`, `newsletter` + `newsletter_post` + `newsletter_subscribe`, `login`, `forgot_password`, `reset_password`. New sites get this automatically. For existing sites missing any of these pages, import the base theme zip via `importSiteFromZip(BASE_THEME_URLS[base_theme])` and merge the missing `pages` + `pageKeys` entries into the design. (Reminder: `page`, `login`, `register`, `forgot_password`, `reset_password` MUST stay header+footer only per §4.10/§4.11 — base theme defaults already comply.)

3. **All sitewide typography lives in `themeSettings`, NOT in `customCss`.** (§4.35ad + `mem://reference/style-guide-cascade-discipline.md`.) Pro themes: `use_custom_fonts: "true"` + `font_link_*` + `select_custom_all_headings_font: "primary"` + per-element overrides per §4.22. Standard themes: `font_family_heading` / `font_family_body` + `font_weight_*` + `line_height_*`. **Audit every existing site:** if `design.customCss` contains `@import url(fonts.googleapis...)`, `body { font-family: ... }`, `:root { --pathx-font-* }`, or any selector setting `font-family`/`font-weight`/`line-height`/`font-size` on `body`/`h1`–`h6`/`p` → MIGRATE those rules into `themeSettings` and DELETE them from `customCss`. The only typography rules allowed to remain in `customCss` are ones targeting Kajabi-rendered DOM with no schema field (e.g. `.logo__text` per §4.35f, `.pricing__heading`).

4. **All sitewide colors and button styling live in `themeSettings`, NOT in per-block overrides or `customCss`.** (§4.7 + §4.35ad.) Sitewide button look = `themeSettings.color_button` + `color_button_text` + `btn_border_radius` + Pro `btn_font_weight` + sizes (per §4.22). Sitewide brand colors = `design.branding` + explicit `themeSettings.color_primary` / `color_accent` / `color_button*`. **Audit every CTA on the site:** if every `cta` block is hardcoding the SAME `buttonBackgroundColor` / `buttonTextColor` / `btn_*` siblings, those colors belong in `themeSettings.color_button` / `color_button_text` — strip the per-block overrides and let inheritance work. Per-block overrides are reserved for the ONE CTA that genuinely differs (e.g. light pair on a dark hero). Same for `customCss`: any `:root { --pathx-color-* }`, `body { color: ... }`, `.btn { background: ... }` rule → migrate to `themeSettings`, delete from `customCss`.

**Pre-flight script for an existing-site audit pass** (run mentally before declaring "this site is clean"):

```
[ ] design.globalSections has BOTH exit_pop AND two_step, each with non-empty blocks/blockOrder
[ ] design.pageKeys includes every Kajabi system page listed above
[ ] design.customCss contains ZERO font-family / font-weight / line-height / font-size rules on
    body/h1-h6/p (except .logo__text and other Kajabi-rendered DOM elements with no schema field)
[ ] design.customCss contains ZERO color rules on body/sections/.btn that duplicate themeSettings
[ ] design.themeSettings.font_family_heading + font_family_body (Standard) OR Pro custom fonts
    (use_custom_fonts:"true" + font_link_* + select_custom_all_headings_font:"primary") are set
[ ] design.themeSettings has explicit font_weight_heading / font_weight_body / line_height_*
    (per §4.22 — never rely on Kajabi defaults)
[ ] design.themeSettings.color_button + color_button_text + btn_border_radius are set sitewide
[ ] Every cta block's button props either match themeSettings (and can be stripped) OR
    deliberately differ (and the difference is documented by visual intent — e.g. dark hero CTA)
[ ] sharedHeader is BRANDED (custom logo/wordmark, real nav menu, CTA button matching site
    palette) — NOT the base-theme default "Encore"/placeholder header (per §4.35an)
[ ] sharedFooter / sharedFooterPro is BRANDED (brand wordmark/logo, real link columns,
    on-brand colors/typography, copyright) — NOT base-theme placeholder rows (per §4.35an)
[ ] Every generated person/figure image has been visually inspected for anatomy defects
    (limbs, hands, faces) BEFORE wiring into the site (per §4.35ao)
```

**For new site builds:** the engine handles invariants #1 and #2 automatically (base theme seed). YOU are responsible for #3 and #4 — set the style guide BEFORE composing pages, per §4.30 (anatomy of a new site build).

**For existing-site cleanup:** all four are your responsibility. Don't tell the expert "the site looks good" until every checklist item is true.

**Why this consolidated rule exists:** experts repeatedly discover their AI-built site has hardcoded fonts in customCss (so changing the heading font in Kajabi's style guide does nothing), or empty popups (so the editor row is blank), or missing system pages (so the live site 404s on /library). All four causes share the same fix shape ("apply at the right layer of the cascade") and all four can be checked in one pass — so make it one pass.

---

### 4.35af 🎨 SYSTEM PAGES MUST MATCH THE REST OF THE SITE (hero on `library` + `store` especially)

🚨 **Verified gap.** New websites seed every Kajabi system page from the base theme defaults (§4.35ac), which is great for STRUCTURE but the seeded content is generic base-theme copy/imagery — generic stock photos, "Welcome to your library" placeholder headlines, default brand-neutral colors. After branding the homepage + about + services, the expert clicks into `/library` or `/store` and sees a page that looks like a different site: stock hero photo, generic copy, mismatched type, no brand voice. They (correctly) report "the library page doesn't match my site."

**The rule — when building or branding a new website, EVERY Kajabi system page that has an authored intro/hero section above its dynamic content (`library`, `store`, `blog`, `blog_post`, `thank_you`, `404`, `member_directory`, `announcements`, `newsletter*`, `blog_search`) MUST have its hero/intro updated to match the rest of the site:**

1. **Imagery** — replace base-theme stock photos with on-brand images. Either reuse a hero image already on the site (homepage hero, about hero) or generate/upload a new one matching the established art direction. NEVER leave the seeded base-theme stock photo.
2. **Copy** — rewrite the seeded headline + lede in the brand's voice (same tone, vocabulary, length-rhythm as the homepage hero). Generic "Welcome to your library" / "Browse our store" placeholders are never acceptable on a branded site.
3. **Styling** — confirm the hero section's `background`, text colors, button styling, padding rhythm, and section `name` match the rest of the site's content sections. Inherit `themeSettings` for typography (per §4.35ad) — don't hardcode different fonts/colors here.
4. **Composition** — the hero structure should mirror other intro sections on the site (same eyebrow + h1 + lede + optional CTA pattern, same width primitives per §4.28, same `equalHeight` discipline if it has cards, etc.).

**MOST IMPORTANT — `library` and `store` heroes.** These are the two pages every paying Kajabi customer hits regularly (members log in → land on library; visitors browse → land on store). A mismatched hero here is more visible than anywhere else on the site. **Never ship a new website without explicitly branding both.**

**The rest of the page stays dynamic** per §4.10 — `library` body MUST be `{ kind: "raw", type: "products" }`, `blog` MUST be `{ kind: "raw", type: "blog_listings" }`, `blog_post` MUST be `{ kind: "raw", type: "blog_post_body" }`. ONLY the hero/intro `content` section above the raw section is yours to brand. Always pass branded `settings` to the raw section too (`background_color`, `text_color`, `btn_*`) so dynamic content matches.

**Auth pages (`login`, `register`, `forgot_password`, `reset_password`) and `page` are EXEMPT** — they MUST stay header+footer only per §4.10 / §4.11. Branding flows to them through `themeSettings` (button colors, fonts, form input styles), not through composed hero sections.

**Pre-flight check on every new site build AND every branding pass:** walk every system page in `design.pages`. For each page that's allowed to have a hero (`library`, `store`, `blog`, `blog_post`, `thank_you`, `404`, `member_directory`, `announcements`, `newsletter*`, `blog_search`), confirm the intro `content` section above the raw/body section uses on-brand imagery, on-brand copy, on-brand colors, and inherits typography from `themeSettings`. If it still has base-theme defaults, brand it before declaring the site done.

**Add this to §4.35ae's checklist as item #5** for site cleanup audits: "Every system page hero (especially library + store) matches the rest of the site's brand — no leftover base-theme stock imagery or placeholder copy."

---

### 4.35ag 🚨 FEATURE BLOCK IMAGES MUST BE SQUARE — always set `imageBorderRadius: "0"` + `image_border_radius: "0"` (every theme, every time)

🚨 **Verified failure mode (Pro Functionality test site, 2026-05-08; previously seen on Encore themes — `mem://reference/encore-feature-image-circle-default.md`).** Every Kajabi base theme (Streamlined, Streamlined Pro, Encore, Encore Pro) ships theme CSS that auto-rounds `feature` block images into circles when `image_border_radius` is unset. Result: every service/program/team card photo renders as a tiny round portrait — looks terrible on premium/editorial sites and is invisibly wrong on every theme by default.

**The rule — EVERY `feature` block with an `image` set MUST emit BOTH:**

```jsonc
{
  "type": "feature",
  "props": {
    "image": "https://...",
    "imageWidth": "1200",            // per §4.17
    "imageBorderRadius": "0",         // camelCase for engine
    "image_border_radius": "0"        // snake_case for Liquid (per §4.29 dual-shape)
  }
}
```

No exceptions. If the expert genuinely wants rounded/circular feature images, they will explicitly ask — until then, square is the only correct default.

**Sitewide reset in `customCss`** (belt + suspenders — emit on every new site per §4.30 step 3a, alongside the button-shadow / text-button-padding / footer-link-list-title resets):

```css
/* Force square feature images (every Kajabi theme auto-rounds them by default) */
.feature .feature__image, .feature__image img { border-radius: 0 !important; }
```

**Pre-flight check on every site build AND every site edit:** walk every `feature` block in the design. If `image` is set AND `imageBorderRadius` is missing/empty/non-zero, set BOTH props to `"0"`. Confirm `customCss` contains the `.feature__image` reset rule. Symptom of skipping this: "the service card photos are tiny circles" / "why are my team photos round" / "the project images look like profile pics."

---

### 4.35ah 🚨 ANY GRID OF SIBLING IMAGES (feature, image, card, pricing_card) MUST SHARE THE SAME ASPECT RATIO — NO EXCEPTIONS

🚨 **THIS RULE APPLIES TO `image` BLOCKS TOO, NOT JUST `feature`.** Verified repeat offender — the expert has flagged this multiple times across multiple sites. The trap: AI generates 3 images for a "Moments" / "Gallery" / "Process" / "Services" row, each at a different prompt that returns a different ratio (one portrait 3:4, one square 1:1, one landscape 4:3). When laid out as siblings at `width: "4"` × 3 (or `"6"` × 2, `"3"` × 4), every image renders at a different height. The row looks ragged and unprofessional. `equalHeight: true` does NOT save you — it equalizes CARD height, not IMAGE height.

**THE ABSOLUTE RULE — applies to every block type that renders an image:**

> **Before generating ANY set of 2+ sibling images that will sit in the same horizontal row, decide ONE aspect ratio (4:3, 3:2, 1:1, 16:9 — pick one) and generate EVERY image in the set at that exact ratio.** Pass the same `aspect_ratio` parameter to `imagegen` for every image. Never mix ratios within a row.

This applies to: `feature` grids, `image` grids/galleries (← THE ONE PEOPLE FORGET), `pricing_card` rows with header images, `card` grids, any `<ContentSection>` containing 2+ sibling image-bearing blocks at matching `width`.

**Pre-generation checklist (MANDATORY — run BEFORE calling `imagegen`):**

1. Count the sibling image blocks in the section.
2. Pick ONE aspect ratio for the whole set (default to `4:3` for editorial grids; `1:1` for portraits; `16:9` for cinematic).
3. Generate every image with that exact ratio. NEVER let the model "pick what fits the prompt" — the prompt picks the subject; YOU pick the ratio.
4. After upload, also enforce in CSS as belt-and-suspenders (see below).

**Always-emit CSS guardrail (add to `customCss` on EVERY new site, scoped to the section via `customCssClass`):**

```css
/* Generic enforcement for any tagged image grid */
.uniform-grid .image, .uniform-grid .image__image, .uniform-grid .image img,
.uniform-grid .feature .feature__image, .uniform-grid .feature__image img {
  aspect-ratio: 4 / 3 !important;
  width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
  max-width: none !important;
}
.uniform-grid .image { overflow: hidden !important; }
```

Then set `customCssClass: "uniform-grid"` (+ `custom_css_class: "uniform-grid"` per §4.29 dual-shape) on every section that holds a multi-image grid. This guarantees uniform heights even when the source images differ — `object-fit: cover` will crop, but a uniform crop is infinitely better than a ragged row.

**Pre-flight check on EVERY save that touches a multi-image section:** open every image URL in the row and check the ACTUAL pixel dimensions (for example via `identify`, PIL, or by inspecting the downloaded files) — do **not** assume the prompts or filenames match. If the row contains mixed ratios → do **not** ship it. Either (a) regenerate/re-crop the odd images to the chosen ratio, or (b) add a section-specific clamp class (`customCssClass: "work-grid-square"`, `"moments-grid-4x3"`, etc. — not one generic sitewide class reused blindly) and force ONE ratio with `aspect-ratio` + `object-fit: cover`. Both is best.

**Symptom mapping (any of these = check this rule FIRST, before anything else):**
- "the images in this row are different sizes / heights"
- "the photos aren't aligned"
- "this row/grid looks ragged / off / broken"
- "I told you to make the images the same ratio" (← the expert has now said this multiple times — do not let it happen a third time)
- "the cards aren't aligned even though I set equalHeight"
- "the CTAs sit at different heights across the row"

**Current failure pattern to prevent:** one image in the row is 16:9 and the other two are 1:1, but the section was never tagged with a ratio-enforcing class, so the cards render at different heights even though `equalHeight` is on. If you see mixed source ratios, assume the row is broken until you have either regenerated the assets OR verified a section-level `aspect-ratio` clamp is present.

**Pair with:** §4.17 (`imageWidth: "1200"`), §4.35ag (`imageBorderRadius: "0"` + `image_border_radius: "0"` on every feature image), §4.35d (`equalHeight: true` + `equal_height: "true"` on the section), §4.35b (image-to-label semantic match).

---

### 4.35ai 🚨 PRO SLIDERS DEFAULT TO `transitionEffect: "slide"` — never `"fade"` unless explicitly asked

🚨 **The default for every Pro slider is `transitionEffect: "slide"` (and the matching snake_case `transition_effect: "slide"` per §4.29 dual-shape).** Never use `"fade"` unless the expert explicitly asks for "fade", "crossfade", "fade between slides", or describes a fullscreen 1-up testimonial crossfade pattern.

**Why:** `fade` silently forces `blocksPerSlide` to 1 (per §4.20 + `mem://reference/slider-fade-stacks-slides.md`) — a 3-up grid carousel authored with `fade` renders ONE card at a time and looks broken next to a sibling section using `slide`. `fade` also requires an injected `fadeEffect.crossFade` CSS workaround because Pro's `section.liquid` forgets to set it. `slide` is the safe, expected default for any multi-up grid carousel (services, testimonials in a 2/3-up grid, logos, pricing tiers, blog posts).

**The rule — every `enableSlider: true` section:**

```jsonc
{
  "props": {
    "enableSlider": true,
    "transitionEffect": "slide",       // ← DEFAULT, every time
    "transition_effect": "slide",      // dual-shape per §4.29
    "blocksPerSlide": 3,                // or 2/4 — only "slide" honors this
    "block_offset": 1                   // skip leading intro block(s) per §9.3a
  }
}
```

**`fade` is allowed ONLY when the expert explicitly asks AND `blocksPerSlide: 1`** (fullscreen testimonial crossfade is the canonical use case). Never mix `fade` with `blocksPerSlide > 1`.

**Pre-flight on every slider section:** if `transitionEffect` is missing, set it to `"slide"`. If it's `"fade"` and the expert never asked for fade, change to `"slide"`. Pair with §4.20, `mem://reference/slider-fade-stacks-slides.md`, and Pro slider minimum-blocks rule (`mem://reference/pro-slider-minimum-blocks.md`).

---

### 4.35aj 🚨 PRO FOOTER — ALWAYS set `merge_powered_by_with_copyright: "true"` (moves copyright + Powered By to a clean footer-bottom band)

🚨 **Default for every Pro site (`base_theme` ending in `-pro`).** The `footer_pro` section schema exposes `merge_powered_by_with_copyright` (checkbox, default `"false"`). When `"true"`, Kajabi pulls the `copyright` block AND the "Powered by Kajabi" line OUT of the footer's main 12-column grid and renders them together in a dedicated **footer-bottom** div below the rest of the footer. This is the clean, modern look — copyright sits on its own row at the very bottom, visually separated from the link columns / brand wordmark / newsletter form above it.

**The rule — every Pro site sets `merge_powered_by_with_copyright: "true"` on the `footer_pro` section's props by default**, unless the expert explicitly asks for the merged-into-grid layout. Emit as the literal string `"true"` (Kajabi schema enum), not boolean `true`.

**Companion alignment fields — ALWAYS set when `merge_powered_by_with_copyright: "true"`:**
- `merged_alignment_desktop` — `"left"` / `"center"` / `"right"` (default `"center"`)
- `merged_alignment_mobile` — same (default `"center"`)

Pick alignment to match the rest of the site's footer rhythm (centered for symmetric footers; left for editorial / left-aligned layouts).

**Optional fields to use when the brand calls for it:**
- `merged_text_color` — hex; defaults to footer text color. Set when the merged band needs a different tint (e.g. muted grey on a dark footer).
- `merged_font_size_desktop` / `merged_font_size_mobile` — defaults `"18px"` / `"16px"`. Tighten to `"14px"` / `"13px"` for a subtler legal-line feel.
- `merged_top_border` — `"true"` adds a hairline divider above the merged band. Use on busy footers to visually separate the legal row from the columns above.
- `merged_top_border_color` — hex (default `"#333"`). Match to a brand-family muted line color.
- `footer_bottom_padding_desktop` / `footer_bottom_padding_mobile` — 4-sided spacer objects (`{ top, right, bottom, left }`). Defaults `30/0/30/0` desktop, `0/0/20/0` mobile.

**Canonical Pro footer props:**
```jsonc
{
  "kind": "footer",
  "slotId": "footer_pro",
  "props": {
    "merge_powered_by_with_copyright": "true",
    "merged_alignment_desktop": "center",
    "merged_alignment_mobile": "center"
    // optional: merged_text_color, merged_font_size_*, merged_top_border, merged_top_border_color, footer_bottom_padding_*
  },
  "blocks": [ /* link_list, social_icons, copyright, etc. */ ]
}
```

**Pre-flight check on every Pro site save:** confirm `footer_pro` props contain `merge_powered_by_with_copyright: "true"` + both `merged_alignment_*` fields. If missing, add them. Pair with §4.35aa (Standard `footer` hidden via `hide_on_desktop`/`hide_on_mobile`) — `footer_pro` is the canonical Pro footer and the merged-bottom band is its canonical layout.

Standard themes (no `-pro` suffix) don't expose this field — rule does not apply.

---

### 4.35ak 🚨 `code_tabs` PANE SECTIONS — same background color as the tab container, tight padding between tabs and panes

🚨 **Verified Pro Functionality site, 2026-05-09.** A Pro `code_tabs` block emits tab buttons; sibling `<ContentSection>`s with `useAsTab: true` + matching `tabSlug` values become the tab panes that swap content. The pattern only feels right when the tab container section AND every pane section are styled as **one continuous surface**.

**Two rules — apply on EVERY `code_tabs` setup:**

1. **Same `background` color on the tab container AND every pane section.** Mismatched colors (e.g. white container, cream pane) make tabs look disconnected from the content they control.
2. **Tight padding between tabs and pane content.** Default full padding on both sides creates a huge dead-air gap. Compose:
   - **Tab container:** normal top, **`bottom: "0"`** (e.g. `120/0` desktop, `80/0` mobile).
   - **Each pane:** **tiny top** (`24` desktop / `16` mobile), normal bottom (e.g. `24/120` desktop, `16/80` mobile).

```jsonc
// Tab container
{ "props": { "background": "#FFFFFF",
    "paddingDesktop": { "top": "120", "right": "0", "bottom": "0", "left": "0" },
    "paddingMobile":  { "top": "80",  "right": "0", "bottom": "0", "left": "0" } },
  "blocks": [ { "type": "code_tabs", "props": { "tabs": [...] } } ] }
// Pane (one per tab; exactly ONE has defaultTab:true)
{ "props": { "useAsTab": true, "tabSlug": "standard", "defaultTab": true,
    "background": "#FFFFFF",
    "paddingDesktop": { "top": "24", "right": "0", "bottom": "120", "left": "0" },
    "paddingMobile":  { "top": "16", "right": "0", "bottom": "80",  "left": "0" } },
  "blocks": [ /* pane content */ ] }
```

**Pre-flight on every `code_tabs` save:** container + every `useAsTab` sibling share `background`; container has `bottom: "0"` padding; panes have small `top`; exactly one pane has `defaultTab: true`; every `tabSlug` matches a tab `slug`. See `mem://reference/code-tabs-pane-sections.md`.

---

### 4.35al 🚨 BUTTON CONTRAST — every button MUST visually pop against its section background (NEVER blend in)

🚨 **REPEAT OFFENDER — the expert has flagged this multiple times across multiple sites. Do NOT let it happen again.** The trap: AI sets `buttonBackgroundColor` (or `btn_background_color`, or relies on sitewide `themeSettings.color_button`) to a value that equals — or is visually indistinguishable from — the section's `background`. Result: the button silhouette disappears into the section, only the label text floats in mid-air, and the CTA looks broken/unfinished. Common failure shapes:

1. **Section bg `#082023` (dark) + button bg `#082023` or unset (form blocks fall back to themeSettings dark)** → button vanishes, only label visible.
2. **Section bg `#FFFFFF` (white) + button bg `#FFFFFF` or `transparent`** → same problem on light sections.
3. **Section bg `#F4EFE6` (cream) + button bg `#F1EAD9` (sand)** → too-close neighbors (ΔL < 8) read as a single tone — fails contrast even though the hex values differ.
4. **Form blocks specifically** — Pro/Standard form Liquid renders the submit button via the **sitewide form-button themeSettings**, NOT the per-block `btn_background_color`. So setting `buttonBackgroundColor: "#C9A96A"` on a `form` block on a dark section can STILL render dark-on-dark if `themeSettings.form_input_button_*` (or the cascading `color_button`) is dark and the section bg matches. Always verify form button contrast against the LIVE rendered preview, not the per-block prop.
5. **Old-palette-leftover sections** — when a site is restyled (dark → light, or vice versa), one section's `background` gets missed in the bulk update and keeps its old color. The buttons inside still target the new palette. Result: button bg matches what the section USED to be, blends into what it IS now.

**The rule — every button-bearing block (`cta`, `feature`/`pricing_card`/`card` with `showButton:true`, `form` submit), every time:**

1. **Compute the contrast.** Compare the BUTTON's effective background (per-block `buttonBackgroundColor` → falls back to sitewide `themeSettings.color_button` / `form_input_button_background_color`) against the SECTION's `background` (or, if the block has its own `backgroundColor`, against THAT). The two must be visually distinct — different hue OR substantially different luminance (rule of thumb: difference in HSL lightness ≥ 25, or one is dark + one is light).
2. **`buttonStyle: "solid"`** → button bg MUST contrast with section bg. If they match, change one (usually swap to a brand accent that stands apart from the section).
3. **`buttonStyle: "outline"` / `"text"`** → the BORDER color (outline) or TEXT color (text-style, per §4.16) MUST contrast with section bg. A gold outline button on a cream section is just as broken as a gold solid button on a gold section.
4. **Form blocks** — set BOTH per-block AND sitewide. Per-block via `buttonBackgroundColor` + `btn_background_color` (dual-shape per §4.29). Sitewide via `themeSettings.form_input_button_background_color` (Pro) / `themeSettings.color_button` (Standard fallback). On dark form sections, ALSO set `themeSettings.form_input_button_text_color` to a light value. NEVER assume per-block button props on a `form` will win — they often don't.
5. **Cross-check on EVERY section restyle.** When you change a section's `background` color (palette swap, dark→light pass, "make this section pop"), IMMEDIATELY audit every button in that section for the new contrast. The button you didn't touch is now the bug.

**Pre-flight check on EVERY save that touches a button OR a section background:**

```
For every section S in the design:
  sec_bg = S.props.background (or fallback to themeSettings.background)
  For every block B in S.blocks:
    if B is cta OR (feature/pricing_card/card with showButton) OR form:
      btn_bg = B.props.buttonBackgroundColor || themeSettings.color_button (or form_*)
      btn_text = B.props.buttonTextColor || themeSettings.color_button_text
      effective_bg = B.props.backgroundColor || sec_bg

      if normalize(btn_bg) == normalize(effective_bg):
        🚨 BLEND — button vanishes. Fix.
      if hsl_lightness_delta(btn_bg, effective_bg) < 25 AND same_hue_family(btn_bg, effective_bg):
        🚨 LOW CONTRAST — button reads as a tonal smear. Fix.
      if buttonStyle == "outline":
        check border color (= btn_bg by default) vs effective_bg → same checks
      if buttonStyle == "text":
        check text color (= btn_bg if dark per §4.16, btn_text if light) vs effective_bg
```

**Symptom mapping → check button contrast FIRST:**
- "the button blends into the section" / "I can only see the text, not the button" / "where did the button go?"
- "the form submit looks broken — just floating words"
- "the CTA disappeared after we changed the section color"
- "this section's button looks invisible vs the rest of the site"

**Companion to:** §4.7 (sitewide CTA brand consistency — solves "every button matches each other"), §4.16 (text-button color quirk — solves "color comes from the wrong slot"), §4.23 (white-on-white BLOCK contrast — solves the chrome-bearing-block version of this same blend bug). This rule (§4.35al) covers the BUTTON-vs-SECTION axis specifically.

**The mnemonic:** **a button you can't see isn't a button.** Every time you author or edit a button, OR change a section's background, run the contrast check. No exceptions. If the expert has to point this out, you've already failed the pre-flight.

See `mem://reference/button-contrast-vs-section.md`.

---

### 4.35am 🚨 PRO THEMES USE DIFFERENT STYLE-GUIDE FIELD IDS THAN STANDARD — `color_button` ≠ `btn_background_color` (silent-drop trap, Pro-specific)

🚨 **Verified failure mode (Carrie Variation site, 2026-05-10).** On Pro themes (`base_theme` ending in `-pro`), the **Standard** Kajabi field IDs `color_button` / `color_button_text` (and a few others) **DO NOT EXIST in the Pro template settings schema**. Pro uses different field IDs for the same UI controls. Authoring `color_button: "#B5826B"` on a Pro site sits valid in JSON, save returns 200, the live site picks it up via inheritance for SOME elements — but the **Pro Style Guide UI** reads `btn_background_color`, sees nothing, and renders the engine's brand-orange fallback (`#ff3e14`) in the swatch. The expert opens the Style Guide and says "why are my button colors orange?" — because the field name they're looking at was never written.

**Special case of §4.26a (never invent schema field IDs), inverted.** §4.26a covers fields that don't exist anywhere. THIS rule covers fields that ARE real on Standard but DON'T EXIST on Pro (or vice versa). Both bug-shapes are silent-drops; both are caught by reading `schemas.generated.json` for the actual `base_theme` BEFORE writing.

**Verified Pro vs Standard field mapping (streamlined-home-pro / encore-page-pro):**

| What it controls | Standard field ID (themes WITHOUT `-pro`) | Pro field ID (themes WITH `-pro`) |
|---|---|---|
| Sitewide button bg (dark slot) | `color_button` | `btn_background_color` |
| Sitewide button text (light slot) | `color_button_text` | `btn_text_color` |
| Page bg | `color_background` | `background_color` |
| Body copy color | `color_text` | `color_body` |
| Heading color | (no dedicated field) | `color_heading` |
| Secondary body color | — | `color_body_secondary` |

The Standard fields ALSO get read by some Pro Liquid paths via inheritance (so the live site mostly looks right) — but the **Pro Style Guide editor UI is bound to the Pro field IDs only**. Setting only the Standard names = right rendering, broken Style Guide = expert confusion.

**The rule — every Pro site themeSettings write MUST set BOTH the Pro field AND, for safety, the Standard sibling:**

```jsonc
{
  "themeSettings": {
    // Pro field IDs (REQUIRED for the Style Guide UI)
    "btn_background_color": "#B5826B",
    "btn_text_color": "#FBF7F0",
    "background_color": "#FBF7F0",
    "color_heading": "#2A2722",
    "color_body": "#2A2722",
    "color_body_secondary": "#5C534A",

    // Standard siblings (kept for inheritance / Liquid fallbacks)
    "color_button": "#B5826B",
    "color_button_text": "#FBF7F0",
    "color_background": "#FBF7F0",
    "color_text": "#2A2722"
  }
}
```

**Pre-flight on every Pro site themeSettings save:**
1. Confirm `base_theme` ends in `-pro`. If yes, the Pro field IDs above are MANDATORY.
2. For every Pro field ID, verify it appears in `packages/engine/src/engines/schemas.generated.json` under `themes['<base_theme>'].templateSettings` — never trust this rule's table without re-checking when authoring a NEW field.
3. Open the Style Guide UI in the editor preview after save. If any color swatch shows the orange brand fallback (`#ff3e14`) when you set the value, the field ID you wrote was wrong — find the right Pro ID in the schema.

**Symptom mapping → check Pro vs Standard field IDs FIRST:**
- "Style Guide shows orange/red brand colors but I set themeSettings to brand"
- "Saved color_button to navy, the Style Guide swatch is still red"
- "Live site looks right but the editor Style Guide doesn't reflect my brand"
- "Per-block button colors work but the global button color in Style Guide is empty"

**Same rule applies to fonts.** §4.35ad already mandates Pro custom fonts via `use_custom_fonts:"true"` + `font_stylesheet_links` + `select_custom_all_headings_font:"primary"` (Pro field IDs). NEVER reach for `customCss` `@import url(fonts.googleapis...)` + `body{font-family:...}` to set fonts on a Pro site — Pro custom fonts give you the actual Style Guide experience the expert paid for. If themeSettings already configures Pro fonts, **do not duplicate the same fonts in customCss** — duplicated rules are a no-op at best and silently override Style Guide tweaks at worst.

**The mnemonic:** **Pro themes have their own Style Guide schema. The Standard field IDs are NOT a superset of Pro's — they're a different set with overlapping behavior.** Always grep `schemas.generated.json` for the actual `base_theme` before writing themeSettings, especially color/button/background fields.

---

### 4.35an 🚨 SHARED HEADER AND SHARED FOOTER MUST BE BRANDED BEFORE DECLARING A SITE DONE (the #1 missed step on new builds)

🚨 **Verified failure mode (Verdant Carrie variation, 2026-05-11).** AI built 12 fully-branded pages — homepage hero, programs, testimonials, about, footer pages — set typography in `themeSettings`, generated all imagery, wired every CTA. THEN told the expert it was done. The expert opened the site and immediately spotted the bug: **the header still said "Encore" (base-theme placeholder) and the footer was still default rows.** The shared header/footer were NEVER touched during the build.

**Why this happens:** §4.35ac auto-seeds every Kajabi system page from the base theme zip on `createSite`. That seed includes `sharedHeader` and `sharedFooter` (or `sharedFooterPro` on Pro themes) populated with the BASE THEME's defaults — generic "Encore" / "Streamlined" wordmark, placeholder nav, default link columns. Those slots persist across every page on the site. The AI then walks each page composing content sections, mentally treats "the site" as just the pages, and forgets that header + footer are first-class authoring surfaces too.

**The rule — `sharedHeader` AND `sharedFooter` (or `sharedFooterPro` on Pro themes) MUST be branded as part of every new site build, BEFORE declaring done.** Not a nice-to-have, not a polish pass — it is part of the core composition work. Same priority as composing the homepage hero.

**What "branded" means concretely:**

**`sharedHeader` (every site):**
1. Real brand wordmark or logo — `logo` block (`logoType: "text"` with brand name + `logoTextFontFamily`/`logoTextFontWeight`/`logoTextLetterSpacing`/`logoTextColor` matching the site's brand AND a matching `.logo__text` rule in `customCss` per §4.35f; OR `logoType: "image"` pointing at a real uploaded logo URL).
2. Real navigation `menu` block — actual page links matching the site's `pageKeys`, not "Home / Features / Pricing" placeholders.
3. CTA button (`cta` block) if the site has a primary conversion action — matching sitewide button styling per §4.7.
4. Header `background` color matches the brand (cream, dark, white — whatever the design language calls for, NOT base-theme default).
5. NEVER leaves a `text` block in the header for a wordmark (silently dropped per §4.27).

**`sharedFooter` / `sharedFooterPro` (every site):**
1. Brand wordmark/logo line — for Pro themes, use a `text` block with inline-styled wordmark HTML (per §4.35e — `footer_pro` has NO `logo` block); for Standard themes, use a `logo` block.
2. Real `link_list` columns — actual page links + resources, NOT base-theme "Quick Links / Support / Legal" placeholders. Per §4.5, omit `title` on each `link_list` unless brand explicitly asks for column headings.
3. `social_icons` block IF the site has social presence — real URLs only (`mem://index.md`: only platforms with URLs set will render).
4. `copyright` block — text starts with the brand name only, NO leading `©`/year per §4.13.
5. Footer `background` matches brand (often inverts the site palette — dark footer on a light-mode site, or cream on a dark-mode site).
6. On Pro sites: `merge_powered_by_with_copyright: "true"` + alignment fields per §4.35aj.
7. On Pro sites: the Standard `sharedFooter` slot is hidden via `hide_on_desktop:"true"` + `hide_on_mobile:"true"` per §4.35aa.

**Pre-flight check on EVERY new site build, EVERY major redesign, BEFORE telling the expert "done":**

1. Open `design.sharedHeader` (or the header section on `design.pages.index.sections[0]`). Walk the blocks. Is there a `logo` block? Is its `logoText`/`logo` the actual brand name/asset, NOT "Encore" / "Streamlined" / "Your Brand"? Is the `menu` populated with real page links? Is the header `background` matching the brand?
2. Open `design.sharedFooter` and (on Pro) `design.sharedFooterPro`. Walk the blocks. Is the brand wordmark present? Are the link_list columns real? Is the `copyright` block branded?
3. If ANY answer is no → STOP. Brand the header/footer BEFORE declaring done. This is not a "save and the expert will let me know" situation — it is a guaranteed bug report.

**Symptom mapping (any of these = §4.35an was violated):**
- "the header still says Encore / Streamlined / base theme name"
- "the footer is just default rows / placeholder links"
- "header and footer are just the default... not customized"
- "the header doesn't match the rest of the site"
- "did you forget to brand the header?"

**The mnemonic:** **a site isn't done when the pages are branded — it's done when the SHARED CHROME (header + footer) is branded too.** Header and footer are not "later"; they are part of every site build by default. Add to §4.35ae checklist items #6 and #7.

See `mem://reference/shared-header-footer-must-be-branded.md`.

---

### 4.35ao 🚨 GENERATED PERSON/FIGURE IMAGES MUST BE VISUALLY INSPECTED FOR ANATOMY DEFECTS BEFORE WIRING

🚨 **Verified failure mode (Verdant Carrie variation, 2026-05-11).** AI generated 12 figure/person images via `imagegen` (hero, lifestyle, intro, offer, optin, closing, bio, etc.), uploaded them all in one batch, wired them into the site, declared done. The expert opened the site and immediately spotted **broken anatomy in 3 of the 12** — deformed chest/arms in the hero, warped hands in `offer1`, distorted posture in `lifestyle1`. None of these were caught during the build because the AI never LOOKED at the images after generating them.

**Why this happens:** image generation models (gpt-image-2, gemini, etc.) are statistically reliable but unreliable on figures/limbs/hands — verified failure rate roughly 1 in 4 person images has at least one visible anatomy defect (extra finger, fused limb, twisted torso, asymmetric face, distorted hand). Treating image generation as "fire and forget" guarantees ~25% of person images on a finished site are broken.

**The rule — every generated image depicting a HUMAN FIGURE must be visually inspected BEFORE being wired into the site (before the `upload-site-image` call OR immediately after, before referencing in `design`).**

**What to inspect (the failure surfaces):**
1. **Hands** — count fingers, check that wrists connect naturally to arms. Hands are the #1 source of obvious defects.
2. **Limbs** — arms and legs symmetric, joints in correct places, no fusion between body parts, no third arm/leg.
3. **Torso** — chest, shoulders, hips proportioned naturally; no warped/elongated/compressed sections.
4. **Faces** — eyes symmetric, ears matching, no doubled features. Faces in profile are less risky than 3/4 angles.
5. **Posture** — pose makes physical sense; no impossible joint bends or "leaning into nothing."

**How to inspect — TWO ALLOWED METHODS, NOT BOTH:**

**Method A (preferred for batches of 5+):** After generating images to `.tmp-images/`, run a quick visual scan by listing each via `code--view` (which renders images inline). One pass through the batch — flag any image with anatomy concerns.

**Method B (single hero/portrait image, max scrutiny):** Use `code--view` on the single image and explicitly reason about each anatomy checkpoint above before approval.

**If a defect is found:**
1. Regenerate the offending image with a sharpened prompt (add "natural anatomy, correct number of fingers, symmetric posture" if vague; or reframe the shot to crop out the problematic limb — e.g. portrait-only crop, hands-out-of-frame, profile angle).
2. Re-inspect the new version.
3. Only upload + wire after inspection passes.

**When this rule does NOT apply:** images with no people (landscapes, architecture, product shots, abstract textures, food, plants). Anatomy QA is specifically for figure imagery.

**Pre-flight check at end of every site build that generated person images:** before declaring done, confirm every wired person image has been visually inspected. If any image was generated and wired without inspection, do the inspection NOW and regenerate any defective ones before telling the expert it's done. **Letting the expert be the first set of human eyes on a generated person image is a process bug, not a content bug.**

**Why this isn't just "be more careful":** the model failure rate is genuinely ~25% on figures; no amount of prompt engineering eliminates it. The ONLY reliable mitigation is human (AI) review of every figure image before shipping. Skipping inspection means ~1 in 4 person images on the finished site has a visible defect — that's a guaranteed expert complaint, every time.

See `mem://reference/person-image-anatomy-qa.md`.

---

### 4.36 ➕➖ ADDING and REMOVING pages on a multi-page site (`kind: 'site'`)

This is a routine operation and a frequent expert ask. Two arrays in `design` MUST stay in sync:

- `design.pageKeys: string[]` — the ordered list (drives the editor's page picker order)
- `design.pages: { [key]: { sections: [...] } }` — the actual page contents

**Page-key naming rules:**
- snake_case only: `[a-z0-9_]+` (hyphens are auto-sanitized to underscores at export time but author them in snake_case from the start — see `mem://reference/template-name-handle-snake-case.md`).
- Must NOT collide with Kajabi system page keys unless you intend to override them: `index`, `about`, `page`, `contact`, `blog`, `blog_post`, `thank_you`, `404`, `library`, `store`, `login`, `register`, `forgot_password`, `reset_password`, `newsletter*`, `member_directory`, `announcements`, `blog_search`.
- Custom pages (e.g. `services`, `level_1_foundation`, `mastermind`) become Kajabi templates `templates/<key>.liquid` at export.

**Adding a page** (e.g. `services`):
1. GET the design.
2. `design.pages.services = { sections: [headerSection, ...contentSections, footerSection] }` — reuse the SAME header/footer references as other pages (they're shared site-wide; last-defined wins on export).
3. `design.pageKeys.push('services')` (or splice in at a specific index for ordering).
4. POST the full design back.
5. Tell the expert the page is now live at `/sites/<id>/editor?page=services` in the editor; on export it lands at `templates/services.liquid` with the matching `content_for_services` block in `settings_data.json`.

**Removing a page** (e.g. `about`):
1. **Refuse to delete Kajabi system pages.** Per project memory: NEVER delete `index`, `blog`, `blog_post`, `library`, `login`, `register`, `forgot_password`, `reset_password`, `thank_you`, `404`, `newsletter*`, `member_directory`, `announcements`, `blog_search`, `store`. These are required by Kajabi's runtime — removing them breaks the export. Only non-system pages (`about`, `contact`, custom-added) and pages the expert explicitly added are safe to remove.
2. GET the design.
3. `delete design.pages.about`
4. `design.pageKeys = design.pageKeys.filter(k => k !== 'about')`
5. POST the full design back.

**Reordering pages:** mutate `design.pageKeys` to the new order; leave `design.pages` untouched.

**Renaming a page key:** copy `design.pages[oldKey]` to `design.pages[newKey]`, delete the old, replace the entry in `pageKeys`. Tell the expert any external links to the old URL will need updating in Kajabi.

**Pre-flight check before saving:** every key in `pageKeys` MUST exist in `pages` and vice versa. Mismatches break the editor's page picker and may break export.

For landing pages (`kind: 'landing_page'`): there is only `index`. Do NOT add or remove pages — landing pages collapse to a single page by definition. If the expert wants multiple pages, they need a `kind: 'site'` site instead.

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

## 8. Thin client architecture & sync (operator-triggered)

> **🚨 CANONICAL ARCHITECTURE (2026-04-30+):** Every thin client is a **5-line iframe** of `https://app.kajabi-studio.com/`. The expert signs into master through the iframe and edits sites against master's database (RLS-scoped to their `auth.uid()`). The engine, base themes, dashboard, editor, preview pipeline — all of it lives on master and is rendered inside the iframe. Engine fixes propagate **the instant master deploys**; there is no `bun update`, no file copy, no sync ritual. The legacy "engine npm package + thin shell" model (§8.1–§8.9 in older versions of this file) is dead.

The canonical iframe template lives at `thin-client-templates/iframe-app/`. It contains:

```
thin-client-templates/iframe-app/
├── App.tsx                  ← 5-line <iframe src="https://app.kajabi-studio.com/" />
├── main.tsx
├── index.html
├── index.css
├── vite.config.ts
├── package.json             ← deps = react + react-dom only
├── AGENTS.md                ← thin-client AI's "read this first" file
├── README.md
├── knowledge/
│   └── README.md            ← placeholder; sync script populates the rest
└── scripts/
    └── sync-knowledge.ts    ← Deno script that pulls the knowledge bundle
```

### 8.1 Operator trigger: `convert to iframe`

When the operator types **`convert to iframe`** (or `migrate to iframe shell`) in a thin client project, execute this immediately — no clarifying questions:

```bash
# 1. Nuke the old shell + engine wiring
rm -rf src node_modules public/base-theme supabase scripts packages \
       eslint.config.js tsconfig.app.json tsconfig.node.json \
       AGENTS.md PRO_CAPABILITIES.md README.md \
       tailwind.config.ts postcss.config.js components.json
```

Then copy the **whole** `thin-client-templates/iframe-app/` directory into the project root — every file, including the easy-to-miss `AGENTS.md`, `scripts/sync-knowledge.ts`, and `knowledge/README.md`. Without those three, the thin-client AI refuses site-editing requests with "no knowledge folder, I'm just an iframe shell."

Then `bun install` and run the knowledge sync once:

```bash
deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts
```

The expert's sites/data are unaffected — they live in master's database, tied to the expert's `auth.uid()`.

### 8.2 How the knowledge bundle works

Master's `publish-knowledge-bundle` edge function (admin-only, gated on `THIN_CLIENT_APP_TOKEN`) packages every file the thin-client AI needs (this `AGENTS.md`, `PRO_CAPABILITIES.md`, `src/engines/kajabi_rendering_guide.md`, every relevant `mem://reference/*.md`) into a deterministically-hashed zip in the `knowledge-bundle` storage bucket and records the version in `knowledge_bundle_versions` (current row marked `is_current = true`).

Thin clients call `get-knowledge-bundle-version` on every chat-start, compare the returned hash to their local `knowledge/.bundle-hash`, and download+unpack the new zip if it differs (no-op otherwise). Same hash = same bytes = idempotent — safe to publish on every master AGENTS edit.

**Operator publish flow** — after editing `AGENTS.md` / `PRO_CAPABILITIES.md` / any `mem://reference/*.md` on master, run the publisher script (see `mem://reference/knowledge-bundle-publish-procedure.md` for the exact one-shot Deno script). It reads the relevant files locally and POSTs them as `{ files: [{ path, content }] }` to `publish-knowledge-bundle` with the `x-admin-secret` header set to `THIN_CLIENT_APP_TOKEN`. Within a few seconds every thin client picks up the new bundle on its next chat.

### 8.3 Operator trigger: `sync knowledge` (rare)

If the operator pastes `sync knowledge` in a thin client, run the sync script manually:

```bash
deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts
```

This is rarely needed because thin-client AIs run it automatically on chat-start. Useful only if the operator just published a new bundle and wants to confirm the thin client picked it up before testing.

### 8.4 What an iframe thin client CANNOT do (and shouldn't try)

- Render previews locally — the editor preview lives on master, served through the iframe.
- Execute the export pipeline locally — `update-site-design` saves JSON to master's DB; the export runs on master when the expert clicks Export.
- Read/write the `sites` table directly — no Supabase client, no anon key. Always use `get-site-design` / `update-site-design` / `upload-site-image` over HTTPS with `X-App-Token`.
- Cache anything site-related locally — there is no client-side store.

### 8.5 Legacy: engine-package thin clients (deprecated, being phased out)

A small number of older thin clients still ship local `src/blocks/`, `src/engines/`, and depend on the `@k-studio-pro/engine` npm package directly (instead of iframing master). Detection:

```bash
test -d src/blocks && echo "LEGACY: ships local engine source"
grep -q "@k-studio-pro/engine" package.json && echo "LEGACY: depends on engine npm package"
```

For these projects:

- **Recommended fix:** **`convert to iframe`** (§8.1). Vastly simpler going forward — every engine fix lands instantly, no `bun update` ritual, no Vite cache busts, no AuthProvider context fragmentation.
- **If the operator insists on staying on the engine package:** `bun update @k-studio-pro/engine && rm -rf node_modules/.vite`, then hard-refresh. The engine npm package (`@k-studio-pro/engine`, source at `packages/engine/`) is still published to npm on every `packages/engine/package.json` version bump, so this path keeps working — but it's no longer the recommended architecture.

The detailed per-file sync workflows (`sync everything from master`, `sync AGENTS.md from master`, `migrate to engine package`, etc.) that used to live here are gone. They were always a workaround for the wrong architecture; the iframe model makes them obsolete.

### 8.6 Recovery: thin client missing the knowledge bundle

A common failure mode: a thin client was converted to iframe but the `knowledge/` folder only has `README.md` (no `AGENTS.md`, no `PRO_CAPABILITIES.md`). The thin-client AI then refuses authoring work because it has zero rules loaded. Fix:

1. Confirm `scripts/sync-knowledge.ts` exists. If not, copy it from `thin-client-templates/iframe-app/scripts/sync-knowledge.ts`.
2. Run the sync script:
   ```bash
   deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts
   ```
3. If the sync reports success but the AI still complains, restart the chat — the AI reads the bundle on chat-start.

If `get-knowledge-bundle-version` returns "no current bundle," master hasn't published one yet — run the publisher script (see §8.2 + `mem://reference/knowledge-bundle-publish-procedure.md`) on master first.



## 9. Pro template capabilities (moved out for sync speed)

The full Pro-only reference now lives in `PRO_CAPABILITIES.md` so standalone `sync AGENTS.md from master` stays fast.

**Before composing any Pro-only block, field, or theme setting:** read `PRO_CAPABILITIES.md`. It keeps the detailed 9.x numbering intact (slider, columns, tabs, search/filter, font overrides, button/form systems, custom CSS class, Pro-only block catalog).

**Standalone trigger:** if the operator pastes **"sync PRO_CAPABILITIES.md from master"** or **"sync pro capabilities from master"**, sync only that file from master and leave `AGENTS.md` untouched.
