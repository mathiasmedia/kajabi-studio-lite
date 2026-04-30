import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const engineSrc = (sub: string) => path.resolve(__dirname, `./node_modules/@k-studio-pro/engine/src/${sub}`);

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
  optimizeDeps: {
    include: ["jszip"],
  },
  resolve: {
    // More-specific aliases MUST come before the catch-all "@".
    alias: [
      { find: "@kajabi-studio/engine", replacement: engineSrc("index.ts") },
      { find: /^@\/blocks$/, replacement: engineSrc("blocks") },
      { find: /^@\/blocks\//, replacement: engineSrc("blocks") + "/" },
      { find: /^@\/engines$/, replacement: engineSrc("engines") },
      { find: /^@\/engines\//, replacement: engineSrc("engines") + "/" },
      { find: /^@\/lib\/siteDesign$/, replacement: engineSrc("siteDesign") },
      { find: /^@\/lib\/siteDesign\//, replacement: engineSrc("siteDesign") + "/" },
      { find: /^@\/types\/assets$/, replacement: engineSrc("types/assets") },
      { find: /^@\/types\/schemas$/, replacement: engineSrc("types/schemas") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
