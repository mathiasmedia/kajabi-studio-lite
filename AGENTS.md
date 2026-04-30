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

## 🔑 How to find the app token (READ THIS BEFORE EVERY SITE EDIT)

🚨 **Thin clients do NOT have a project-level secrets store like master does.** `secrets--fetch_secrets` is a master-only tool — it does not exist in thin-client tool inventories. The token must come from one of the following, checked in order:

### Discovery procedure — try in order, stop at first hit

```bash
# 1. Standard Lovable env injection (most common — Lovable mirrors project env vars into the sandbox)
echo "ENV CHECK:"
test -n "$VITE_THIN_CLIENT_APP_TOKEN" && echo "✓ VITE_THIN_CLIENT_APP_TOKEN is set (${#VITE_THIN_CLIENT_APP_TOKEN} chars)"
test -n "$THIN_CLIENT_APP_TOKEN" && echo "✓ THIN_CLIENT_APP_TOKEN is set (${#THIN_CLIENT_APP_TOKEN} chars)"

# 2. Literal .env file in repo root (fallback if env injection isn't configured)
test -f .env && echo "FILE CHECK:" && grep -E "^(VITE_)?THIN_CLIENT_APP_TOKEN=" .env || echo "no .env or no token line"
```

If **either** check finds a value starting with `tca_live` and 57 characters long, use it. In your edit script, prefer:

```ts
const APP_TOKEN =
  Deno.env.get("VITE_THIN_CLIENT_APP_TOKEN") ??
  Deno.env.get("THIN_CLIENT_APP_TOKEN") ??
  (await Deno.readTextFile(".env").catch(() => ""))
    .split("\n")
    .find((l) => /^(VITE_)?THIN_CLIENT_APP_TOKEN=/.test(l))
    ?.split("=", 2)[1]
    ?.trim()
    ?.replace(/^["']|["']$/g, "");

if (!APP_TOKEN) {
  console.error("THIN_CLIENT_APP_TOKEN not found. See AGENTS.md '🔑 How to find the app token'.");
  Deno.exit(1);
}
```

The Supabase URL is **not secret** — hardcode it: `const SUPABASE_URL = "https://iqxcgazfrydubrvxmnlv.supabase.co";`

### If both checks come up empty

This thin client was set up without the token. Ask the operator (verbatim):

> "I can't find the app token in this project's environment. Please add a project secret named **`VITE_THIN_CLIENT_APP_TOKEN`** with master's `THIN_CLIENT_APP_TOKEN` value (starts with `tca_live`, 57 chars). You can copy it from the master Lovable project's secrets, or from the Supabase project's edge function secrets. Once added, redeploy the preview and I'll retry."

Do NOT try to:
- Write a migration to create `client_tokens` / `validate_client_token` (the shared token IS the system).
- "Regenerate" the token from a dashboard (there's no UI for it; the value is whatever master has).
- Hardcode the token into AGENTS.md or any committed file (the operator chose `.env`/secrets to keep it out of public repo source).

## 🚨 If you see "Token validation failed" or "Invalid or revoked client token"

You found a token but master rejected it. Causes in order of likelihood:

1. **Stale value.** The thin client has an old token; master rotated `THIN_CLIENT_APP_TOKEN`. Ask the operator to update this project's `VITE_THIN_CLIENT_APP_TOKEN` secret to master's current value.
2. **Wrong value.** Length isn't 57 or it doesn't start with `tca_live`. Re-check the operator pasted it correctly.
3. **Wrong env var name.** Master's edge functions match against `THIN_CLIENT_APP_TOKEN` exactly; the `VITE_` prefix is just how Vite exposes it to the browser. Both work for sending — what matters is the **value** matches master's `THIN_CLIENT_APP_TOKEN` env var verbatim.

Do NOT attempt to "fix" this by writing migrations or building a per-site token system. The shared token IS the system today.
