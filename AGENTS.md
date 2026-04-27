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

### 4.6 Image references must be public URLs

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

### 4.12 NEVER set `fullWidth: true` on a section unless explicitly asked

Kajabi's "Make section full width" toggle (`fullWidth: true` in our props → `full_width: 'true'` in `settings_data.json`) breaks the section's inner content out of the standard 1170px container so it spans the entire viewport edge-to-edge. This is **almost always wrong** for content sections (hero, features, CTAs, testimonials, copy blocks): on wide monitors the headline and paragraph stretch hundreds of characters wide and become unreadable; the layout looks unprofessional and amateur.

**The default is constrained.** Every `ContentSection` in a template MUST omit `fullWidth` (or set it to `false`) unless the expert **explicitly** asks for "full width", "edge to edge", "no margins", "full bleed", or describes a layout that obviously requires it (e.g. "an image gallery that touches both screen edges"). Phrases like "make it bigger", "make the hero feel premium", "more impactful", "more spacious" do **not** mean full width — they usually mean larger padding, bigger type, or a stronger background — never a content breakout.

This applies to:
- New templates being built from a prompt.
- Redesigns of existing sections.
- Any "make it more premium / more impactful / cleaner" pass.
- Sections with background images (the image already covers the viewport via `bg_image` + `background-size: cover`; `fullWidth` only affects the inner content column, not the image).

**Common confusion:** authors often think `fullWidth` controls whether the **background image** covers the full viewport. It does not. Background images already cover the full section width by default. `fullWidth` controls whether the **text/blocks inside** the section break out of the 1170px container — and stretching headlines + paragraphs to 2000px+ wide is what makes the page look broken.

**Pre-flight check before saving any template or page:** scan every `content` section's props. If `fullWidth: true` is set and the expert never asked for it, remove it.

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
- `src/lib/siteStore.ts`
- `src/lib/imageStore.ts`

**Editor shell + preview:**
- `src/pages/SiteEditor.tsx`
- `src/pages/SitesDashboard.tsx`
- `src/components/SitePreview.tsx`

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
