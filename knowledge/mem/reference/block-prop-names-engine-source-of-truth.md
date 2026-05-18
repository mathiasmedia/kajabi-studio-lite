---
name: block-prop-names-engine-source-of-truth
description: ⭐ CRITICAL silent-drop trap for ALL blocks (not just chrome). update-site-design accepts arbitrary JSON without validating prop names against the block's *Props interface — wrong names sit valid in JSON, render as default/empty, save returns 200 OK, expert sees no change. Always read the block's component file in the engine BEFORE authoring props. Includes verified wrong→right table for pricing_card, feature, cta, text, image, accordion, link_list. Companion to §4.25 (chrome keys); this covers content keys.
type: reference
---

# Block content props — read the engine source before authoring, every time

## The trap (verified 2026-04, Mastermind pricing section, three save cycles wasted)

`update-site-design` accepts arbitrary JSON. **It does NOT validate prop names against any block's `*Props` interface.** So:

- You write `{ type: "pricing_card", props: { title: "Pro", description: "...", featured: true } }`
- Save returns `200 OK`
- The JSON sits in the database verbatim — re-fetching shows your edits present
- The renderer ignores every unknown key and draws the card from the (still empty/default) real props
- Expert sees no change after save. You see no error. You re-save. Same outcome.

Three full save cycles passed before anyone noticed the cards looked unchanged.

## Verified wrong→right renames (read these before touching the listed blocks)

Source of truth: `node_modules/@k-studio-pro/engine/src/blocks/components/<BlockName>.tsx` (thin clients) or `packages/engine/src/blocks/components/<BlockName>.tsx` (master). Each component exports a `<BlockName>Props` interface — **that interface is the only thing the renderer reads**.

| Block | ❌ Wrong (silently dropped) | ✅ Right (engine reads these) |
|---|---|---|
| `pricing_card` | `title` | `name` |
| `pricing_card` | `description` | `text` |
| `pricing_card` | `priceSubtext` / `caption` | `heading` |
| `pricing_card` | `featured` / `popular` / `recommended` | `highlight` (boolean) |
| `pricing_card` | `badge` / `tag` | `badgeText` |
| `pricing_card` | `accentColor` / `themeColor` | `brandColor` |
| `pricing_card` | inline-styled `<ul>` for features | plain `<ul><li>…</li></ul>` in `text` (engine's `decorateFeatureList` auto-wraps each `<li>` in a branded checkmark chip — your inline styles get overwritten) |
| `feature` | `title` | write inline as `<h3>` inside the single `text` HTML field (per `mem://feature/feature-single-text-field.md`) |
| `feature` | `description` / `body` | `text` |
| `feature` | `imageUrl` / `src` | `image` |
| `feature` | `cta` / `link` | `buttonText` + `buttonUrl` + `showButton: true` |
| `cta` | `text` / `title` | `label` (or `buttonText` — both accepted, prefer `label`) |
| `cta` | `href` / `link` | `url` |
| `text` | `body` / `content` / `richText` | `html` (or `text` — both accepted) |
| `image` | `url` / `imageUrl` | `src` |
| `image` | `link` / `href` | `imageHref` |
| `accordion` | `title` / `header` | `heading` |
| `accordion` | `body` / `content` | `text` |
| `logo` | `image` | `logoSrc` (or `image` — check the block source) |
| `link_list` | `header` / `heading` | `title` |

## The rule — every author/edit of a block

1. **Before writing `props: { ... }`, READ THE BLOCK'S COMPONENT FILE.** One `code--view` per block type touched. Find the `*Props` interface. That's the field whitelist.
2. **Cross-check `mem://reference/block-field-catalog.md`** for Kajabi-side field names (snake_case, output). This memory is for engine-side prop names (camelCase, input). Both matter — one is what you write, the other is what gets exported.
3. **Never assume a "natural" name works.** Conventions vary by block: some use `name`, some use `title`, some use `label`, some use `heading`. The only way to know is to read the source.

## Pre-flight check before EVERY `update-site-design` save

For every block authored or edited:
1. Open the block's source file in the engine.
2. List the `*Props` interface fields.
3. Diff against the props object you're about to send.
4. **Any key in your object that's NOT in the interface = silent-drop bug.** Rename or remove.

## Symptom mapping → suspect prop names FIRST

- "I saved and refreshed but the card looks identical"
- "Expert says nothing changed, but my save returned 200"
- "Re-fetching shows my edits in JSON but the preview ignores them"
- "Background color (chrome) took effect but title/body (content) didn't"
- "Badge isn't showing even though I set `badge: 'POPULAR'`"

→ Open the block source. Compare prop names to the interface. If any prop you set isn't in the interface, that's the bug. Don't go looking at chrome, padding, the renderer, or the save endpoint.

## Why save validation isn't the answer

Adding strict prop validation to `update-site-design` would break legitimate use cases (forward-compat for new fields the master engine adds before thin-client engines update; experimental blocks; migration windows). The save endpoint is correctly permissive. **The discipline must live in the AI: read the block source before authoring, every time.**

## Mnemonic

**Two API responses look identical: "wrote your fields" and "wrote your fields and threw most of them away." 200 OK does NOT mean your change took effect — only the render does.** Always verify in the live preview after save; if nothing changed, suspect prop names before anything else.

## Related

- `mem://reference/block-chrome-key-hygiene.md` — chrome props (padding, borderRadius, backgroundColor, boxShadow) have the same silent-drop trap; that memory covers chrome, this one covers content
- `mem://reference/block-field-catalog.md` — Kajabi snake_case OUTPUT field names (the other side of the translation)
- `mem://feature/feature-single-text-field.md` — feature block has ONE `text` HTML field, no separate heading/body
- AGENTS.md §4.25 (chrome keys) and §4.26 (content keys) — the canonical authoring rules
