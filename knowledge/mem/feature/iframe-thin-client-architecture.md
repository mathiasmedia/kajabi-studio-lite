---
name: Iframe thin client architecture
description: Thin clients are 5-line iframe shells of master, NOT remixes that import the engine package. Replaces the entire "sync from master" workflow.
type: feature
---

# Iframe Thin Client Architecture (canonical, replaces engine-package model)

**As of 2026-04-30, every NEW thin client is an iframe of `https://app.kajabi-studio.com/`.** The engine-package model (`@k-studio-pro/engine` + `bun update` + `sync everything from master`) is officially **legacy** — kept alive only for thin clients that haven't been migrated yet.

## The model

A thin client is a Lovable project containing exactly:

```tsx
// src/App.tsx — the entire app
import { memo } from "react";
const MASTER_URL = "https://app.kajabi-studio.com/";

// CRITICAL: memo + always-equal compare keeps the <iframe> DOM node mounted
// exactly ONCE. Without this, every parent re-render (HMR save in dev, any
// state change in prod) replaces the iframe and reloads master — blowing
// away the expert's session and unsaved edits.
const FrameOnce = memo(
  function FrameOnce() {
    return (
      <iframe
        key="kajabi-studio-iframe-v1"
        src={MASTER_URL}
        title="Kajabi Studio"
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", border: 0 }}
        allow="clipboard-read; clipboard-write; downloads"
      />
    );
  },
  () => true,
);

export default function App() { return <FrameOnce />; }

// Force full reload on dev HMR for this module so we never half-swap the iframe.
if (import.meta.hot) { import.meta.hot.invalidate(); }
```

Plus stock `main.tsx`, `index.css` (reset only), `index.html`, `package.json` (only `react` + `react-dom` + Vite), `vite.config.ts`. **Total dependency footprint: 2 packages.** No `@k-studio-pro/engine`. No Supabase client. No router. No engine source.

🚨 **The `memo` + `() => true` + `import.meta.hot.invalidate()` pattern is MANDATORY** — without it the iframe reloads on every parent re-render or HMR save, killing the expert's session and unsaved work mid-edit. Every new thin client must ship with this exact App.tsx (verified shipping in `thin-client-templates/iframe-app/App.tsx` as of 2026-04-30).

Template files: `thin-client-templates/iframe-app/`.

## How auth + data work

1. Each expert opens their thin client → master loads in the iframe.
2. Master shows its login screen (master is iframe-able; verified `curl -I` returns no `X-Frame-Options` / `frame-ancestors`).
3. Expert signs up or logs in with their own email/Google.
4. Master's RLS scopes every query by `auth.uid()` → expert sees only THEIR sites.
5. Build, edit, export — all happens inside the iframe against the live master.

**No baked-in tokens. No admin session piggybacking. No `/embed/:siteId` route. No per-thin-client config (no `SITE_ID` constant, no env vars).** Every thin client is byte-identical.

## Why this beats the engine-package model

| Concern | Engine-package model (legacy) | Iframe model (canonical) |
|---|---|---|
| Engine fix propagates | `bun update @k-studio-pro/engine` per thin client + `rm -rf node_modules/.vite` + hard-refresh | Instant — next page load on the iframe is the new master |
| Vite/React fragmentation bugs | "useAuth must be used within an AuthProvider", AuthProvider context fragmentation, optimizeDeps tuning | Impossible — there's no React tree to fragment |
| Base-theme zip loader bugs | esbuild dep-pre-bundle workarounds, `viteEngineZipPlugin()` | Impossible — base themes load on master's deployment |
| `sync everything from master` | 25-file parallel batch + version bump + smoke test | Doesn't exist — nothing to sync |
| Supabase client wiring | `setSupabaseClient(supabase)` in `main.tsx` before `<App/>` | Doesn't exist — master owns its own client |
| Dependency drift | `swiper`, `@tanstack/react-query`, `react-router-dom`, etc. all need to match master | Two deps total: `react` + `react-dom` |
| Lines of code per thin client | ~50 files, hundreds of LOC of shims + wiring | 5 files, ~30 LOC total |

## Migration path for existing engine-package thin clients

When the operator says **"convert to iframe"** or **"migrate to iframe shell"**, copy the ENTIRE `thin-client-templates/iframe-app/` directory — not just the 5 wiring files. The knowledge bundle (`AGENTS.md` + `scripts/sync-knowledge.ts` + `knowledge/README.md`) is what lets the thin-client AI answer "yes I can edit your site" instead of "I'm just an iframe shell, I can't help."

1. `rm -rf src node_modules public/base-theme supabase scripts packages eslint.config.js tsconfig.app.json tsconfig.node.json AGENTS.md PRO_CAPABILITIES.md README.md tailwind.config.ts postcss.config.js components.json`
2. `mkdir -p src scripts knowledge`
3. Copy from `thin-client-templates/iframe-app/`:
   - `App.tsx`, `main.tsx`, `index.css` → `src/`
   - `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, `AGENTS.md` → root
   - `scripts/sync-knowledge.ts` → `scripts/`
   - `knowledge/README.md` → `knowledge/`
4. `bun install`
5. Run the knowledge sync once so the AI has rules immediately:
   ```
   deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts
   ```
6. Hard-refresh.

**The 3 files that are easy to forget and that BREAK the experience when missing:** `AGENTS.md` (root), `scripts/sync-knowledge.ts`, `knowledge/README.md`. Without them, the AI says "no knowledge folder, I can't help" — even though the iframe itself works fine for the expert. Always copy the whole template directory.

Expert's site IDs are preserved — they live in master's DB keyed to the expert's auth account, never in the thin client. Nothing to migrate data-wise.

### Recovery for already-converted thin clients missing the knowledge bundle

If a thin client was converted before this rule existed and its AI is refusing to edit sites with "no knowledge/ directory or AGENTS.md":

1. `cross_project--read_project_file` from project `kajabi-studio-max` (ID `4fd872bc-5636-4a8a-bde9-a334a0656f59`) for `thin-client-templates/iframe-app/{AGENTS.md, scripts/sync-knowledge.ts, knowledge/README.md}` (parallel batch).
2. Write each to its target path (`AGENTS.md`, `scripts/sync-knowledge.ts`, `knowledge/README.md`).
3. Run `deno run --allow-read --allow-write --allow-net --allow-env scripts/sync-knowledge.ts`.
4. Tell the AI to read `AGENTS.md` + `knowledge/AGENTS.md` §3.

## What the operator does NOT do anymore

- ❌ `sync everything from master` (no engine to sync)
- ❌ `bun update @k-studio-pro/engine` (no engine package)
- ❌ `migrate to engine package` (no migration target)
- ❌ AGENTS.md / PRO_CAPABILITIES.md sync (the iframe loads master's live AI which uses master's docs)

The single remaining operator workflow: **deploy master.** Every thin client picks it up automatically on next page load.

## What the AI inside a thin client does

The thin client AI **CAN edit the expert's sites and landing pages** via master's edge functions (`get-site-design` / `update-site-design` / `upload-site-image` / `generate-site-image`) using HTTPS + the `X-App-Token` header. It does NOT have a local Supabase client, engine, or wiring — and it doesn't need them.

The rules + edge-function recipes live in the synced knowledge bundle (`knowledge/AGENTS.md` §3 + `knowledge/PRO_CAPABILITIES.md`). The thin-client `AGENTS.md` (root) tells the AI to:
1. Run `scripts/sync-knowledge.ts` on the first message of every chat.
2. Read `knowledge/AGENTS.md` before doing any work.
3. NEVER refuse a site-editing request with "this is just an iframe shell" — that answer is wrong.

If an operator opens the thin-client Lovable project and says "add a feature to the app shell", THAT is the only request the AI should bounce back to master ("the app shell is intentionally minimal — make engine/UI changes in kajabi-studio-max"). Site-editing requests are ALWAYS in scope.
