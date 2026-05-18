---
name: Engine data-layer injection (v0.2.0)
description: Engine v0.2.0+ owns siteStore/imageStore/exportPersistence. Thin clients ship 1-line shims at src/lib/* and call setSupabaseClient(supabase) in main.tsx before <App /> renders.
type: feature
---

Engine v0.2.0 moved the data layer (siteStore.ts, imageStore.ts, exportPersistence.ts — 678 LOC total) into `packages/engine/src/data/`. The package now exports them via the `@k-studio-pro/engine/data` subpath.

**Why a lazy proxy instead of passing `supabase` as a function arg:** The data layer has 15 call sites across 3 files; rewriting every one to take `client` as a first arg would be 15 mechanical edits AND break every call site in master + every thin client. Instead, `packages/engine/src/data/client.ts` exports a Proxy:

```ts
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
```

Every data-layer file imports `import { supabase } from './client'` and uses `supabase.from(...)` / `supabase.auth.getUser()` verbatim — no per-call-site rewrites. The proxy throws a clear error on first use if `setSupabaseClient` was never called.

**Master's main.tsx wires it in:**
```ts
import { setSupabaseClient } from "@k-studio-pro/engine";
import { supabase } from "@/integrations/supabase/client";
setSupabaseClient(supabase);  // BEFORE createRoot(...).render(<App />)
```

**Master's `src/lib/{siteStore,imageStore,exportPersistence}.ts` are now 1-line shims:**
```ts
export * from '@k-studio-pro/engine/data';
```

Existing imports `from '@/lib/siteStore'` keep working through these shims — no consumer file changed.

**Aliases that make `@k-studio-pro/engine/data` resolve to local source on master** (so master dogfoods the live code without a publish round-trip):
- `vite.config.ts`: alias `^@k-studio-pro\/engine\/data$` → `./packages/engine/src/data/index.ts`
- `tsconfig.json` + `tsconfig.app.json`: paths entry `"@k-studio-pro/engine/data": ["./packages/engine/src/data/index.ts"]`

**Thin-client templates** (`thin-client-templates/`):
- `main.tsx` — full file template with `setSupabaseClient` wiring
- `src-lib-data-shim.ts` — the 1-line shim, copied to all 3 `src/lib/*` files
- `package.json` — pins `@k-studio-pro/engine` ^0.2.0
- `tsconfig.app.json` — adds `@k-studio-pro/engine` + `@k-studio-pro/engine/data` + `@k-studio-pro/engine/vite` paths pointing into `node_modules/`

**Common failure mode after migration:** forgetting the `setSupabaseClient(supabase)` line in `main.tsx`. Symptom: app loads, dashboard mounts, first call to `listSites()` throws `[engine] Supabase client not set. Call setSupabaseClient(supabase) in your app entry (main.tsx) before rendering.`

**What did NOT move (still per-thin-client):**
- App shell (SitesDashboard, SiteEditor, AppHeader) — deferred to a future session per the plan, because the shell pulls in react-router, shadcn primitives, and per-project routes (Auth, Admin) that need a Provider pattern. Data-layer move is the safe Phase 1.
