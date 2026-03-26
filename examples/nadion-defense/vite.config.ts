import { defineConfig } from "vite";
import { resolve } from "path";
import solidPlugin from "vite-plugin-solid";

const rootModules = resolve(__dirname, "../../node_modules");

export default defineConfig({
  plugins: [
    solidPlugin({
      solid: {
        generate: "universal",
        moduleName: "solidion/renderer",
      },
    }),
  ],
  resolve: {
    alias: {
      "solidion/recs": resolve(__dirname, "../../src/recs/index.ts"),
      "solidion/core": resolve(__dirname, "../../src/core/index.ts"),
      "solidion/debug": resolve(__dirname, "../../src/debug/index.ts"),
      "solidion/renderer": resolve(__dirname, "../../src/renderer.ts"),
      "solidion": resolve(__dirname, "../../src/index.ts"),
      // Deduplicate solid-js: ensure both example and library code use the
      // same instance, AND use the browser build (not server/SSR).
      "solid-js/universal": resolve(rootModules, "solid-js/universal/dist/universal.js"),
      "solid-js": resolve(rootModules, "solid-js/dist/solid.js"),
    },
  },
  base: "./",
  build: {
    outDir: "dist",
  },
});
