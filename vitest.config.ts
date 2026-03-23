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
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/types.ts", "src/types.generated.ts",
        "src/index.ts", "src/hooks/index.ts", "src/components/index.ts", "src/behaviors/index.ts",
        // Phaser-dependent: covered by browser tests (vitest.browser.config.ts)
        "src/components/Game.ts", "src/components/Scene.ts",
        "src/components/Overlay.ts", "src/components/Preload.ts",
      ],
      reporter: ["text", "text-summary"],
    },
  },
  resolve: {
    conditions: ["browser", "development"],
    alias: {
      "solid-js/universal": resolve(__dirname, "node_modules/solid-js/universal/dist/dev.js"),
      "solid-js/store": resolve(__dirname, "node_modules/solid-js/store/dist/dev.js"),
      "solid-js": resolve(__dirname, "node_modules/solid-js/dist/dev.js"),
    },
  },
});
