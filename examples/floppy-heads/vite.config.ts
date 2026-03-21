import { defineConfig } from "vite";
import { resolve } from "path";

const rootModules = resolve(__dirname, "../../node_modules");

export default defineConfig({
  resolve: {
    alias: {
      "solidion": resolve(__dirname, "../../src"),
      // Deduplicate solid-js: ensure both example and library code use the
      // same instance, AND use the browser build (not server/SSR).
      "solid-js/universal": resolve(rootModules, "solid-js/universal/dist/universal.js"),
      "solid-js": resolve(rootModules, "solid-js/dist/solid.js"),
    },
  },
  build: {
    outDir: "dist",
  },
});
