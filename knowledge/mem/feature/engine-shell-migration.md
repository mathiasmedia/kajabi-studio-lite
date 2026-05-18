---
name: Engine shell migration (v0.3.0)
description: Phase 2 of move-to-bun moved the entire app shell into the engine package; master files are now 1-line re-export shims
type: feature
---
# Engine shell migration — engine v0.3.0

Phase 2 of the move-to-bun plan. Phase 1 (v0.2.0) moved the data layer; Phase 2 moves the entire app shell.

## What's in the engine now

`packages/engine/src/shell/` contains:
- `hooks/useAuth.tsx` — AuthProvider + useAuth (talks to per-project Supabase via the data-layer Proxy from `data/client.ts`; no DI wrapper needed)
- `components/{AppHeader,RequireAuth,NavLink}.tsx`
- `pages/{SitesDashboard,SiteEditor,LandingPagesDashboard,Index,NotFound}.tsx`
- `ui/*` — vendored shadcn primitives: button, card, input, label, badge, alert-dialog, dialog, dropdown-menu, select, sonner (next-themes import stripped — defaults theme to "system")
- `lib/utils.ts` — `cn()` helper

## Public surface

- `@k-studio-pro/engine` root barrel re-exports: AuthProvider, useAuth, RequireAuth, NavLink, AppHeader, SitesDashboardPage, SiteEditorPage, LandingPagesDashboardPage, IndexPage, NotFoundPage. **Pages are exported with `Page` suffix to avoid colliding with block component names** (e.g. blocks export `Card`, shadcn UI also has `Card`).
- `@k-studio-pro/engine/shell` subpath re-exports the vendored shadcn primitives (Button, Card, Dialog, etc.) by their bare names. Use this subpath when composing project-specific pages (Auth.tsx, Admin.tsx) so you don't re-vendor shadcn.

## Master shims

- `src/components/{AppHeader,RequireAuth,NavLink,SitePreview}.tsx` — 1-line `export { ... } from '@k-studio-pro/engine'`
- `src/hooks/useAuth.tsx` — 1-line shim
- `src/pages/{Index,NotFound,SitesDashboard,SiteEditor,LandingPagesDashboard}.tsx` — 1-line `export { XxxPage as default } from '@k-studio-pro/engine'`
- `src/App.tsx` — STAYS as a real wiring file (composes engine pages with project-specific `Auth`/`Admin`/`ResetPassword` routes). This is the right boundary because per-project pages need to coexist with engine pages.
- `src/pages/{Auth,ResetPassword,Admin}.tsx` — STAY in master (project-specific UI)
- `src/components/admin/**` — STAYS in master

## AppHeader brand props

The engine `AppHeader` accepts `brandTitle` / `brandSubtitle` props (defaults: "Studio Pro" / "Build, save, and export Kajabi themes."). Thin clients with a custom brand should render `<AppHeader brandTitle="..." brandSubtitle="..." />` from a small wrapper instead of pure shim.

## Toast unification

Both engine pages were converted from shadcn `useToast()` → sonner `toast()` so we don't have to vendor the entire shadcn toast/toaster system. Calls converted: `toast({title, description})` → `toast(title, {description})`; `toast({title, variant: 'destructive'})` → `toast.error(title)`.

## Why pages don't include App.tsx itself

`App.tsx` composes engine pages with project-specific routes (Auth, ResetPassword, Admin). Moving `App.tsx` into the engine would force every project to either use the same auth UI or re-implement routing. Keeping it in master is the right boundary — it's the single wiring file each project owns.

## What deferred to a future phase

- Base themes (`public/base-theme/*.zip`) — kept as separate sync per the operator's Phase 2 scope.
