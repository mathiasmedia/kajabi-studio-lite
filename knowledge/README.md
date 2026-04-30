# Thin client AI knowledge

This folder is **auto-synced** from the master Lovable project (Kajabi Studio Max) on every chat message via `scripts/sync-knowledge.ts`.

**Do not edit anything in this folder by hand.** Changes are overwritten on the next sync.

## What's in here

- `AGENTS.md` — full thin-client authoring guide (rules for editing site `design` JSON, block hygiene, dynamic-page rules, etc.)
- `PRO_CAPABILITIES.md` — full Pro theme reference (custom fonts, slider, columns, tabs, button system, etc.)
- `mem/index.md` — distilled "Core" rules every action must respect
- `mem/~user.md` — operator's communication preferences
- `mem/<topic>.md` — topic-specific elaborations (when present)
- `engines/kajabi_rendering_guide.md` — Liquid tags, filters, CSS layering
- `engines/kajabiFieldSchema.ts` — authoritative field-name catalog
- `blocks/types.ts` — block-prop TypeScript types

## When the AI reads these

The Lovable AI in this project is configured (via the project's chat preamble / custom instructions) to read these files **before** taking any action that modifies the expert's site. The sync script ensures it's always reading the latest version.

## Bumping the bundle

The master project re-publishes the bundle whenever its rules change. Sync happens automatically on the next chat message — no operator action required.

## File: `.bundle-hash`

Stores the hash of the currently-synced bundle so the sync script can short-circuit when there's nothing new.
