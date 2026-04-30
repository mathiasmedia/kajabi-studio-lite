# Thin Client AI — Read This First

> 🚨 **CRITICAL — DO NOT SKIP. The #1 mistake AI makes in this project:**
>
> **YES, you CAN edit the expert's sites and landing pages from this thin client.** Even though the app shell is just a 5-line iframe, **YOU (the AI) edit site data directly via master's edge functions over HTTPS**. You do NOT need a local Supabase client, a local engine, or local wiring. The iframe is what the *expert* sees in their browser. It has nothing to do with how *you* do the work.
>
> If the user asks "can you work on this site / landing page?" the answer is **YES**. Do not say "no, this is just an iframe shell." That answer is wrong. Read `knowledge/AGENTS.md` §3 (THE CORE WORKFLOW) — it tells you exactly how to call `get-site-design` / `update-site-design` with `X-App-Token`. Both the URL and the token are in the knowledge bundle.

## Step 0 — ALWAYS run this on the first message of every chat

```bash
deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts
```

If the `knowledge/` folder only has a `README.md` (no `AGENTS.md`, no `PRO_CAPABILITIES.md`), the sync hasn't run yet and you have **zero rules loaded**. Run it first, then read what it pulled in.

## Step 1 — Read the rules before doing anything

Once `knowledge/` is populated:

1. **`knowledge/AGENTS.md`** — canonical authoring rules (block system, page structure, all the §4.x guardrails, the §3 site-editing workflow with full edge-function examples).
2. **`knowledge/PRO_CAPABILITIES.md`** — Pro-only blocks/fields/themeSettings reference.

These are the same rules the master AI follows. They are NOT optional reading — they are the source of truth for every authoring decision.

## What this project is

A **thin-client iframe wrapper** for the master Kajabi Studio app at `https://app.kajabi-studio.com/`. The expert visits this Lovable project, signs into master via the iframe, and edits their sites against master's database (RLS-scoped to their own `auth.uid()`).

The app code is intentionally minimal — `App.tsx` is a 5-line iframe. **Do not add features to the iframe shell** unless the operator explicitly asks.

## What you (the AI) actually do here

Your primary job is to **edit the expert's site `design` JSON via master's edge functions** (`get-site-design` / `update-site-design`). The mechanism is plain HTTPS calls with the thin-client app token in the `X-App-Token` header. No local Supabase setup needed. **Full step-by-step in `knowledge/AGENTS.md` §3.**

You do NOT:
- Modify the iframe `App.tsx`, `main.tsx`, `index.css`, or `vite.config.ts` (unless operator explicitly asks).
- Touch `scripts/sync-knowledge.ts` (operator-managed).
- Add database tables, edge functions, or auth wiring (those live on master).
- Add components, pages, or routes to the iframe shell.
- Refuse to work on a site because "this is just an iframe." (See the warning at the top.)

## Operator triggers

- **`convert to iframe`** / **`migrate to iframe shell`** — literal operator command. Replace the current project shell with the canonical iframe template in this folder, then run the knowledge sync.
- **`sync knowledge`** — force a re-sync (useful after a known master rule change).
- **All other site-editing requests** — work as documented in `knowledge/AGENTS.md` §3.
