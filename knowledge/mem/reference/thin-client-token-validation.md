---
name: Thin client token validation
description: How thin-client AIs find THIN_CLIENT_APP_TOKEN; thin clients have NO secrets store (no fetch_secrets), discovery is env vars + .env file fallback
type: reference
---

## The setup

Thin clients are iframe shells of master. They have **no project-level secrets management UI**, no `secrets--fetch_secrets` tool, no edge functions of their own. Master's edge functions (`get-site-design` / `update-site-design` / `upload-site-image`) require the `THIN_CLIENT_APP_TOKEN` value in the `X-App-Token` header. The thin-client AI must obtain that value somehow.

## Architectural decision (operator-confirmed 2026-04-30)

**Per-thin-client `.env` / Lovable env-var injection. NOT hardcoded in AGENTS.md.** The operator pastes the token into each thin client's environment. Reasons: keeps the token out of public repo source; same security posture as master; allows the token to be different per environment (dev vs prod) if needed later.

## Discovery procedure the thin-client AI must use

Try in order, stop at first hit:

1. `Deno.env.get("VITE_THIN_CLIENT_APP_TOKEN")` — Lovable's standard env injection
2. `Deno.env.get("THIN_CLIENT_APP_TOKEN")` — same, without VITE prefix
3. Read `.env` text file in repo root, parse `^(VITE_)?THIN_CLIENT_APP_TOKEN=` line

Validation: token starts with `tca_live`, is 57 chars long.

If all three fail → ask the operator to add `VITE_THIN_CLIENT_APP_TOKEN` as a project secret in this Lovable project. Do NOT hardcode it. Do NOT write migrations.

## Why the previous instructions failed

The old AGENTS.md said "look for `VITE_THIN_CLIENT_APP_TOKEN` in this thin client's own `.env`" — which:
- Confused the AI because most thin clients use Lovable's env injection (mirrored to `Deno.env`), not a literal `.env` file
- Didn't show a concrete extraction snippet
- Didn't clarify that `secrets--fetch_secrets` doesn't exist on thin clients

The current AGENTS.md (in `thin-client-templates/iframe-app/AGENTS.md` "🔑 How to find the app token" section) gives the AI: a discovery shell command, a copy-paste TS snippet using `Deno.env.get()` + `.env` fallback, and the verbatim message to ask the operator if both come up empty.

## Master-side state (unchanged)

`validate_client_token(_site_id, _token_hash)` Postgres RPC referenced by `get-site-design`/`update-site-design`/`upload-site-image` DOES NOT EXIST. No `client_tokens` table either. ONLY the legacy shared-token path works: edge function checks `appToken === Deno.env.get("THIN_CLIENT_APP_TOKEN")` first and uses service-role on match. NO master-side migration needed for thin clients to work — they just need the right token value.
