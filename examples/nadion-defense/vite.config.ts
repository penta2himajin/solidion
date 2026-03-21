import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      solidion: resolve(__dirname, "../../src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
