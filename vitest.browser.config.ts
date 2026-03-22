import { defineConfig } from "vitest/config";
import { resolve } from "path";
import solidPlugin from "vite-plugin-solid";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [
    solidPlugin({
      solid: {
        generate: "universal",
        moduleName: "solidion/renderer",
      },
    }),
  ],
  test: {
    include: ["tests/browser/**/*.test.{ts,tsx}"],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: "chromium" },
      ],
      headless: true,
    },
  },
  resolve: {
    alias: {
      "solidion": resolve(__dirname, "src"),
      "solid-js/universal": resolve(__dirname, "node_modules/solid-js/universal/dist/universal.js"),
      "solid-js": resolve(__dirname, "node_modules/solid-js/dist/solid.js"),
    },
  },
});
