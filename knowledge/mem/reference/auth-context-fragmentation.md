---
name: AuthProvider context fragmentation
description: "useAuth must be used within an AuthProvider" error after engine migration — caused by importing AuthProvider and RequireAuth from different module paths, missing Vite dedupe/optimizeDeps for React+Router, or stale node_modules/.vite cache
type: reference
---

# "useAuth must be used within an AuthProvider" — engine shell module fragmentation

Fires even when the route tree IS wrapped in `<AuthProvider>`. Root cause: Vite's dep optimizer split the engine shell into TWO chunks, each carrying its own React context instance, so the `AuthContext` written by `<AuthProvider>` is invisible to the `useAuth()` call inside `<RequireAuth>`.

## Three rules to prevent it

1. **Single import subpath in App.tsx.** Both `AuthProvider` AND `RequireAuth` MUST be imported from the SAME engine entry — always `@k-studio-pro/engine/shell`:
   ```ts
   // ✅ Correct
   import { AuthProvider, RequireAuth } from "@k-studio-pro/engine/shell";

   // ❌ Wrong — fragments the module graph
   import { AuthProvider } from "@k-studio-pro/engine/shell";
   import { RequireAuth } from "@/components/RequireAuth";
   ```
   Don't import `RequireAuth` / `useAuth` from `@/components/RequireAuth` / `@/hooks/useAuth` inside App.tsx. Those are 1-line shims, but mixing them with a direct engine import creates the second chunk. The shims themselves should re-export from `@k-studio-pro/engine/shell` too (see `thin-client-templates/src-shell-shim.ts`).

2. **Route tree shape.**
   ```tsx
   <BrowserRouter>
     <AuthProvider>
       <Routes>...</Routes>
     </AuthProvider>
   </BrowserRouter>
   ```

3. **vite.config.ts has React + Router pre-bundled and deduped.**
   ```ts
   resolve: {
     dedupe: [
       "react", "react-dom",
       "react/jsx-runtime", "react/jsx-dev-runtime",
       "react-router-dom",
       "@tanstack/react-query", "@tanstack/query-core",
       "swiper",
       "@k-studio-pro/engine",
     ],
   },
   optimizeDeps: {
     include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "react-router-dom"],
   },
   ```
   Do NOT add `@k-studio-pro/engine`, `@k-studio-pro/engine/shell`, or `@k-studio-pro/engine/data` to `optimizeDeps.exclude` unless proven necessary.

## Recovery procedure when it appears in a thin client

1. Open `src/App.tsx` — confirm `AuthProvider` and `RequireAuth` come from `@k-studio-pro/engine/shell` on the same import line.
2. Open `vite.config.ts` — confirm `dedupe` and `optimizeDeps.include` match. Re-sync from `thin-client-templates/vite.config.ts` if not.
3. `rm -rf node_modules/.vite`
4. Restart dev server, hard-refresh browser.

## Templates that enforce this

- `thin-client-templates/App.tsx` — single-subpath import baked in
- `thin-client-templates/vite.config.ts` — dedupe + optimizeDeps configured
- `thin-client-templates/src-shell-shim.ts` — every shim re-exports from `/shell`

Full docs: AGENTS.md §8.‑1 "Post-migration check — useAuth must be used within an AuthProvider".
