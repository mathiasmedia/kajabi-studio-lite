---
name: Engine zip loader esbuild fix (v0.3.5)
description: Why thin-client base-theme zip imports break under Vite dep pre-bundling, and the viteEngineZipPlugin() that fixes it (full esbuild support landed in 0.3.5)
type: reference
---

## Symptom

Thin client exports fail with `Base theme zip "..." is invalid: Can't find end of central directory`. Or: 1-byte zip downloaded, `BASE_THEME_URLS[x] === ""` at runtime, `fetch on '' returned 200` (HTML body), `JSZip: invalid zip file`. Sometimes the dev server crashes during dep-scan with `No loader is configured for ".zip" files`.

## Root cause

`packages/engine/src/engines/baseThemeValidator.ts` imports the four base-theme zips with Vite's `?url` suffix:

```ts
import streamlinedHomeUrl from '../../base-themes/streamlined-home.zip?url';
```

Vite's main pipeline understands `?url`. **esbuild does not.** Vite uses esbuild for dep PRE-bundling, and `@k-studio-pro/engine` MUST be in `optimizeDeps.include` (or transitively pre-bundled) so React/Router stay deduped — otherwise `AuthProvider` context fragments (see `mem://reference/auth-context-fragmentation.md`).

When esbuild walks the engine source during pre-bundle, it hits the four `*.zip?url` imports and either crashes or stubs them to `""`. By the time the page loads, `BASE_THEME_URLS` is `{ 'streamlined-home': '', ... }` and exports break.

## Why 0.3.4 was a partial fix

0.3.4's `viteEngineZipPlugin()` registered ONLY a Vite `resolveId`/`load` hook. Vite's main pipeline calls those — but esbuild's dep-scan/dep-bundle runs in a separate process with its own plugin API and never invokes Vite hooks. So 0.3.4 fixed the dev server's main pipeline but NOT the dep-pre-bundle step where the `""` stub is actually emitted.

Consequence: on 0.3.4 the only working workaround was `optimizeDeps.exclude: ["@k-studio-pro/engine"]`, which silently re-introduced the AuthProvider context-fragmentation bug.

## Right fix (engine 0.3.5)

`viteEngineZipPlugin()` now registers BOTH:

1. **Vite `resolveId`/`load` hooks** — for the main dev/prod pipeline (unchanged from 0.3.4)
2. **esbuild plugin auto-injected via `config(cfg)` hook into `optimizeDeps.esbuildOptions.plugins`** — for the dep-scan + dep-bundle phase

The esbuild plugin's `onResolve` matches `\.zip\?url$`, resolves the path on disk, and `onLoad` emits a stub that re-exports the same `?url` import. By the time Vite serves the prebundled chunk to the browser, the `?url` import inside it is handled by Vite's main pipeline (which DOES understand `?url`).

Net effect: thin clients keep `@k-studio-pro/engine` in `optimizeDeps.include` AND zip imports work end-to-end. No `optimizeDeps.exclude` workaround needed — and using one will silently break AuthProvider.

## Wrong fix (DO NOT do this)

A previous thin-client AI "fixed" this by:
1. Copying the four zips into `public/base-theme/`
2. Overriding `BASE_THEME_URLS` at app startup to point at `/base-theme/*.zip`

That works once but defeats the entire engine-bundled-zips architecture:
- Stale zips on every future engine bump
- Manual re-copy on every base-theme update
- Next thin client to hit the bug redoes the hack
- "Thin" clients aren't thin anymore

## Wrong fix #2 (DO NOT do this)

Adding `optimizeDeps.exclude: ["@k-studio-pro/engine"]` to make zip imports work. This was the only escape hatch on 0.3.4 — but excluding the engine from dep-pre-bundle means React/Router/AuthContext can be loaded as separate module instances, which fragments the AuthProvider context and makes `useAuth()` throw `"useAuth must be used within an AuthProvider"` even when the route tree IS wrapped.

On 0.3.5+, REMOVE this line if a previous AI added it.

## Recovery on a broken thin client

1. `bun update @k-studio-pro/engine` (must land 0.3.5+)
2. Re-sync `vite.config.ts` from `thin-client-templates/vite.config.ts`
3. If the config has `optimizeDeps.exclude: ["@k-studio-pro/engine"]`, **delete that line**
4. `rm -rf node_modules/.vite`
5. Hard-refresh the preview
6. If a previous AI added `public/base-theme/` + a `BASE_THEME_URLS` override, delete both — the plugin makes them obsolete
7. Run an export, verify zip is well-formed (>1KB, opens in any zip tool)
