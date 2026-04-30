import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { viteEngineAliases, viteEngineZipPlugin } from "@k-studio-pro/engine/vite";

// https://vitejs.dev/config/
//
// Thin-client vite config. The engine alias block comes from the engine
// package itself (`@k-studio-pro/engine/vite`) so the trailing-slash bug
// for deep imports (e.g. `@/blocks/components/Slider`) cannot regress —
// the helper guarantees the trailing slash on every replacement.
//
// DO NOT hand-edit the engine alias block here. If `@/blocks`,
// `@/engines`, `@/lib/siteDesign`, or `@/types` ever stop resolving,
// `bun update @k-studio-pro/engine` to pick up the latest helper.
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // viteEngineZipPlugin makes the engine's `*.zip?url` base-theme imports
    // survive esbuild dep-pre-bundling. Without this, esbuild stubs the four
    // base-theme zip URLs to "" during pre-bundle, BASE_THEME_URLS ends up
    // empty, and exports either fail or download a corrupt 1-byte zip. The
    // historical "fix" was to copy zips into public/base-theme/ and override
    // BASE_THEME_URLS at startup — DO NOT do that; this plugin is the proper
    // fix and ships from the engine package itself.
    viteEngineZipPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    // Order matters: more-specific aliases must come before "@".
    alias: [
      // ---- Auth-safe direct alias (preserved for back-compat with App.tsx
      // which imports `AuthProvider` / `useAuth` from `@engine-auth`). The
      // engine `dedupe` entry below also keeps the engine single-instance.
      {
        find: /^@engine-auth$/,
        replacement: path.resolve(
          __dirname,
          "node_modules/@k-studio-pro/engine/src/shell/hooks/useAuth.tsx",
        ),
      },
      // Engine package — maps @/blocks, @/engines, @/lib/siteDesign, @/types
      // into node_modules/@k-studio-pro/engine. See engine's src/vite.ts.
      ...viteEngineAliases(__dirname),
      // Thin-client app shell — pages, components, hooks, lib, etc.
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    // Dedupe is CRITICAL — without this, the engine package and the thin-client
    // app can each get their own copy of React / React Router, which fragments
    // React contexts (most visibly: AuthProvider in the engine shell vs.
    // useAuth() called from a different React copy) and produces the
    // "useAuth must be used within an AuthProvider" error even when the tree
    // is wrapped correctly. Add `@k-studio-pro/engine` so the engine package
    // itself is also single-instance across the dep graph.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "swiper",
      "@k-studio-pro/engine",
    ],
  },
  // Pre-bundle React + Router so Vite ships ONE copy across both the thin
  // client and the engine package's shell. Skipping this lets Vite split the
  // engine shell into a separate dep optimization chunk that imports its own
  // React/Router instance — that's the classic "AuthProvider context lost"
  // failure mode after migrating to the engine package.
  //
  // DO NOT add `@k-studio-pro/engine`, `@k-studio-pro/engine/shell`, or
  // `@k-studio-pro/engine/data` to `optimizeDeps.exclude` — excluding them
  // brings the fragmentation back. The engine is intentionally pre-bundled
  // alongside React so every shell hook resolves to the same module instance.
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
    ],
  },
}));
