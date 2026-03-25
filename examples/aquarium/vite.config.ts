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
      "solidion/ecs": resolve(__dirname, "../../src/ecs/index.ts"),
      "solidion/core": resolve(__dirname, "../../src/core/index.ts"),
      "solidion/debug": resolve(__dirname, "../../src/debug/index.ts"),
      "solidion": resolve(__dirname, "../../src/index.ts"),
      "solid-js/store": resolve(rootModules, "solid-js/store/dist/store.js"),
      "solid-js/universal": resolve(rootModules, "solid-js/universal/dist/universal.js"),
      "solid-js": resolve(rootModules, "solid-js/dist/solid.js"),
    },
  },
  base: "./",
  build: {
    outDir: "dist",
  },
});
