---
name: Engine-shipped Vite alias helper + ESLint guardrail
description: Engine v0.1.18 ships `@k-studio-pro/engine/vite` exporting `viteEngineAliases(__dirname)` so thin clients never hand-write the regex aliases that caused the trailing-slash bug; pair with no-restricted-imports ESLint rule banning deep @/ imports
type: feature
---

## What the engine ships (v0.1.18+)

`packages/engine/src/vite.ts` exports `viteEngineAliases(projectRoot: string): EngineAlias[]`. Returns the canonical alias array for `@/blocks`, `@/engines`, `@/lib/siteDesign`, `@/types` (deep + barrel forms), with the trailing slash baked into every regex replacement via a private `engineDir()` helper that re-appends `"/"` after `path.resolve()`.

Subpath export in `package.json`:
```json
"./vite": { "types": "./src/vite.ts", "default": "./src/vite.ts" }
```

## Thin client usage

```ts
// vite.config.ts
import { viteEngineAliases } from "@k-studio-pro/engine/vite";

export default defineConfig({
  resolve: {
    alias: [
      ...viteEngineAliases(__dirname),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "swiper"],
  },
});
```

Engine aliases MUST come before the `@` catch-all (more specific first).

## ESLint guardrail (paired with the helper)

Add to thin client `eslint.config.js`:
```js
"no-restricted-imports": ["error", {
  patterns: [{
    group: ["@/blocks/*", "@/engines/*", "@/lib/siteDesign/*", "@/types/*"],
    message: "Import from the barrel ('@/blocks'), not deep paths. Deep paths are the failure surface for the vite alias trailing-slash bug."
  }]
}]
```

Reasoning: the trailing-slash bug ONLY bites deep imports. Engine internals use relative imports (immune). If thin-client code only ever imports from barrels (`@/blocks`, `@/engines`, etc.), the bug becomes unreachable regardless of vite config.

## Why both layers

- **Helper** = correct config by construction (no human writes the regex).
- **ESLint rule** = even if someone bypasses the helper or future-Vite changes break the helper, deep imports won't compile, so the bug can't manifest.
- **Engine internals using relative paths** = third layer of immunity; engine never depends on thin-client alias config.

## Rollout to existing thin clients

Single prompt (see master AGENTS.md / chat log "Eliminate the vite-alias trailing-slash class of bugs"):
1. `bun update @k-studio-pro/engine` (≥0.1.18).
2. Replace `resolve.alias` with `[...viteEngineAliases(__dirname), { find: "@", replacement: ... }]`.
3. Add the ESLint `no-restricted-imports` rule.
4. `rg` for any existing `@/blocks/...` deep imports in `src/` and rewrite to barrel imports.
5. Restart Vite, verify sliders.
