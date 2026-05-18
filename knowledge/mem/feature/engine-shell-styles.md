---
name: Engine shell styles ship Inter + brand tokens
description: Inter font, grayscale brand tokens, and the universal preview-bundle font override all live in `packages/engine/src/shell/styles.css` (side-effect imported by `shell/index.ts`). Thin clients inherit automatically via `bun update @k-studio-pro/engine` — no per-project index.css/index.html edits.
type: feature
---

## What ships from the engine shell

`packages/engine/src/shell/styles.css` (loaded as a side effect by `packages/engine/src/shell/index.ts`) is the single source of truth for app-shell branding:

1. **Inter font** loaded via `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')` — no `<link>` tag in `index.html` required.
2. **Grayscale brand tokens** for "Pro Studio by Mathias Media" — full `:root { --background, --foreground, --primary, ... }` set. Wins against the host app's own `:root` because the engine shell CSS is imported AFTER the host app's `./index.css` in `main.tsx`.
3. **Universal font override** that beats `<SitePreview>`'s injected `* { font-family: ... !important }` rule:
   ```css
   html body, html body *:not(.preview-root):not(.preview-root *) {
     font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
   }
   ```
   The `.preview-root` exclusion keeps block previews rendering in each site's own fonts.

## What master's local `src/index.css` MUST NOT contain

- Brand tokens (`--background`, `--foreground`, etc.) — duplicating creates drift between master and thin clients.
- The Inter `@import` — already loaded by the engine.
- The `html body *:not(.preview-root)` font override — already in the engine.
- Any `<link href="fonts.googleapis.com/...Inter...">` in `index.html`.

Master's `src/index.css` keeps only: `@tailwind` directives, `@layer base { * { @apply border-border } html, body { ... } }`, font-feature utilities, `.bg-dot-grid`, the Bootstrap `.row` / `.col-md-*` parity grid, and the `.kajabi-arrow-btn` slider-arrow CSS.

## Logo asset

`packages/engine/src/shell/assets/mathias-media-logo.png` — imported by `AppHeader.tsx` via the relative path `../assets/mathias-media-logo.png` (NOT `@/assets/...`, which is a master-local Vite alias that doesn't resolve in thin clients).

## Updating

Bump `packages/engine/package.json` `version` and any thin client gets the updated styling via `bun update @k-studio-pro/engine` + hard refresh. No file copies, no AGENTS.md sync needed.
