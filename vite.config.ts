import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Engine path helpers — guarantee a trailing slash on directories so deep
// imports like `@/blocks/components/Slider` don't collapse into
// `…/blockscomponents/Slider` (path.resolve strips trailing slashes).
const ENGINE_SRC = path.resolve(
  __dirname,
  "node_modules/@k-studio-pro/engine/src",
);
function engineFile(file: string): string {
  return path.resolve(ENGINE_SRC, file);
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
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // Treat base-theme zips shipped inside the engine as static assets so
  // `import url from '...zip?url'` resolves to a served URL instead of esbuild
  // trying to parse the zip bytes as JS.
  assetsInclude: ["**/*.zip"],
  optimizeDeps: {
    force: true,
    include: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "jszip",
    ],
    exclude: ["@k-studio-pro/engine"],
    esbuildOptions: {
      loader: {
        ".zip": "empty",
      },
    },
  },
  resolve: {
    // Order matters: more-specific aliases must come before "@".
    alias: [
      // ---- Auth-safe direct alias (avoids duplicate AuthContext instances) ----
      { find: /^@engine-auth$/, replacement: engineFile("shell/hooks/useAuth.tsx") },
      // ---- Engine package ----
      { find: /^@k-studio-pro\/engine\/data$/, replacement: engineFile("data/index.ts") },
      { find: /^@k-studio-pro\/engine\/shell$/, replacement: engineFile("shell/index.ts") },
      { find: /^@k-studio-pro\/engine\/vite$/, replacement: engineFile("vite.ts") },
      { find: /^@k-studio-pro\/engine$/, replacement: engineFile("index.ts") },
      // Legacy alias (kept for any straggler imports inside engine internals).
      { find: "@kajabi-studio/engine", replacement: engineFile("index.ts") },
      // Backward-compat: legacy @/blocks, @/engines, @/lib/siteDesign, @/types
      // imports inside the engine package resolve back into the engine source.
      // Trailing slash on the directory replacement is REQUIRED — without it,
      // deep imports like `@/blocks/components/Slider` collapse into
      // `…/blockscomponents/Slider` (path.resolve strips trailing slashes).
      { find: /^@\/blocks(\/.*)?$/, replacement: ENGINE_SRC + "/blocks$1" },
      { find: /^@\/engines(\/.*)?$/, replacement: ENGINE_SRC + "/engines$1" },
      { find: /^@\/lib\/siteDesign(\/.*)?$/, replacement: ENGINE_SRC + "/siteDesign$1" },
      { find: /^@\/types(\/.*)?$/, replacement: ENGINE_SRC + "/types$1" },
      // ---- Thin client ----
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "swiper",
    ],
  },
}));
