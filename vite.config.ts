import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// ─────────────────────────────────────────────────────────────────────
// Inlined engine vite helpers
//
// We can't `import { viteEngineAliases, viteEngineZipPlugin } from
// "@k-studio-pro/engine/vite"` here because Node's native loader fields
// the config import and refuses to strip TS types from files inside
// `node_modules/`. The helpers below are a verbatim port of the engine's
// `src/vite.ts` so behavior matches the master template exactly.
//
// DO NOT hand-edit the engine alias regexes — they exist to prevent the
// trailing-slash bug for deep imports like `@/blocks/components/Slider`.
// ─────────────────────────────────────────────────────────────────────

function engineDir(projectRoot: string, sub: string): string {
  return (
    path.resolve(projectRoot, "node_modules/@k-studio-pro/engine/src", sub) +
    "/"
  );
}
function engineFile(projectRoot: string, file: string): string {
  return path.resolve(
    projectRoot,
    "node_modules/@k-studio-pro/engine/src",
    file,
  );
}

function viteEngineAliases(projectRoot: string) {
  return [
    { find: /^@\/blocks\//, replacement: engineDir(projectRoot, "blocks") },
    { find: /^@\/engines\//, replacement: engineDir(projectRoot, "engines") },
    {
      find: /^@\/lib\/siteDesign\//,
      replacement: engineDir(projectRoot, "siteDesign"),
    },
    { find: /^@\/types\//, replacement: engineDir(projectRoot, "types") },
    {
      find: /^@\/blocks$/,
      replacement: engineFile(projectRoot, "blocks/index.ts"),
    },
    {
      find: /^@\/engines$/,
      replacement: engineFile(projectRoot, "engines/index.ts"),
    },
    {
      find: /^@\/lib\/siteDesign$/,
      replacement: engineFile(projectRoot, "siteDesign/index.ts"),
    },
  ];
}

function viteEngineZipPlugin(): Plugin {
  const PREFIX = "\0engine-zip-url:";
  return {
    name: "k-studio-engine-zip-url",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(".zip?url")) return null;
      // Skip if we're already resolving our own re-export (prevents
      // self-reference error in Rollup at build time).
      if (importer && importer.startsWith(PREFIX)) return null;
      const withoutQuery = source.slice(0, -"?url".length);
      let absPath: string;
      if (path.isAbsolute(withoutQuery)) {
        absPath = withoutQuery;
      } else if (importer) {
        absPath = path.resolve(path.dirname(importer), withoutQuery);
      } else {
        return null;
      }
      if (!fs.existsSync(absPath)) return null;
      return PREFIX + absPath;
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const absPath = id.slice(PREFIX.length);
      // Delegate to Vite's built-in ?url asset handling by resolving
      // the absolute path with ?url, bypassing this plugin via the
      // importer-prefix guard in resolveId above.
      const resolved = await this.resolve(absPath + "?url", id, {
        skipSelf: true,
      });
      const target = resolved?.id ?? absPath + "?url";
      return `export { default } from ${JSON.stringify(target)};`;
    },
  };
}

// https://vitejs.dev/config/
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
    // Makes the engine's `*.zip?url` base-theme imports survive esbuild
    // dep-pre-bundling. Without this, esbuild stubs the four base-theme
    // zip URLs to "" during pre-bundle, BASE_THEME_URLS ends up empty,
    // and exports either fail or download a corrupt 1-byte zip. The
    // historical "fix" was to copy zips into public/base-theme/ and
    // override BASE_THEME_URLS at startup — DO NOT do that; this plugin
    // is the proper fix.
    viteEngineZipPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    // Order matters: more-specific aliases must come before "@".
    alias: [
      // Auth-safe direct alias (preserved for back-compat with App.tsx
      // which imports `AuthProvider` / `useAuth` from `@engine-auth`).
      // The engine `dedupe` entry below also keeps the engine
      // single-instance.
      {
        find: /^@engine-auth$/,
        replacement: engineFile(
          __dirname,
          "shell/hooks/useAuth.tsx",
        ),
      },
      // Engine package — maps @/blocks, @/engines, @/lib/siteDesign,
      // @/types into node_modules/@k-studio-pro/engine.
      ...viteEngineAliases(__dirname),
      // Thin-client app shell — pages, components, hooks, lib, etc.
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    // Dedupe is CRITICAL — without this, the engine package and the
    // thin-client app can each get their own copy of React / React
    // Router, which fragments React contexts (most visibly: AuthProvider
    // in the engine shell vs. useAuth() called from a different React
    // copy) and produces "useAuth must be used within an AuthProvider"
    // even when the tree is wrapped correctly. Add `@k-studio-pro/engine`
    // so the engine package itself is also single-instance.
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
  // Pre-bundle React + Router so Vite ships ONE copy across both the
  // thin client and the engine package's shell. Skipping this lets Vite
  // split the engine shell into a separate dep optimization chunk that
  // imports its own React/Router instance — that's the classic
  // "AuthProvider context lost" failure mode after migrating to the
  // engine package.
  //
  // DO NOT add `@k-studio-pro/engine`, `@k-studio-pro/engine/shell`, or
  // `@k-studio-pro/engine/data` to `optimizeDeps.exclude` — excluding
  // them brings the fragmentation back. The engine is intentionally
  // pre-bundled alongside React so every shell hook resolves to the
  // same module instance.
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
    ],
    // Belt-and-suspenders: even though viteEngineZipPlugin rewrites
    // `*.zip?url` imports before esbuild sees them, esbuild's dep-scan
    // can still log "No loader is configured for .zip" warnings while
    // walking the engine source. Map .zip to the `empty` loader so
    // those warnings don't surface — the actual zip URLs come from the
    // plugin's resolveId, not esbuild's scan.
    esbuildOptions: {
      loader: {
        ".zip": "empty",
      },
    },
  },
}));
