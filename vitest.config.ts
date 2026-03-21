import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        inline: ["solid-js"],
      },
    },
  },
  resolve: {
    conditions: ["browser", "development"],
    alias: {
      "solid-js/universal": resolve(__dirname, "node_modules/solid-js/universal/dist/dev.js"),
      "solid-js": resolve(__dirname, "node_modules/solid-js/dist/dev.js"),
    },
  },
});
