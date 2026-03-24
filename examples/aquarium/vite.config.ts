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
      "solidion": resolve(__dirname, "../../src"),
      "solid-js/store": resolve(rootModules, "solid-js/store/dist/store.js"),
      "solid-js/universal": resolve(rootModules, "solid-js/universal/dist/universal.js"),
      "solid-js": resolve(rootModules, "solid-js/dist/solid.js"),
    },
  },
  build: {
    outDir: "dist",
  },
});
