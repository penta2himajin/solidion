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
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types.ts", "src/types.generated.ts", "src/index.ts", "src/hooks/index.ts", "src/components/index.ts", "src/behaviors/index.ts"],
      reporter: ["text", "text-summary"],
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
