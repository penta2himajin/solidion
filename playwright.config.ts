import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15_000,
  use: {
    headless: true,
    baseURL: "http://localhost:3004",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run preview",
    cwd: "./examples/aquarium",
    port: 3004,
    reuseExistingServer: !process.env.CI,
  },
});
