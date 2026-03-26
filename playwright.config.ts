import { defineConfig, devices } from "@playwright/test";

const reuseExistingServer = !process.env.CI;

/** Mobile viewport shared across mobile projects */
const mobileViewport = { width: 390, height: 844 };

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15_000,
  use: {
    headless: true,
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "aquarium",
      testMatch: "aquarium.spec.ts",
      use: { baseURL: "http://localhost:3004" },
    },
    {
      name: "breakout",
      testMatch: "breakout.spec.ts",
      use: { baseURL: "http://localhost:3010" },
    },
    {
      name: "floppy-heads",
      testMatch: "floppy-heads.spec.ts",
      use: { baseURL: "http://localhost:3011" },
    },
    {
      name: "nadion-defense",
      testMatch: "nadion-defense.spec.ts",
      use: { baseURL: "http://localhost:3012" },
    },
    {
      name: "null-pow",
      testMatch: "null-pow.spec.ts",
      use: { baseURL: "http://localhost:3013" },
    },
    {
      name: "honeycomb-rush",
      testMatch: "honeycomb-rush.spec.ts",
      use: { baseURL: "http://localhost:3014" },
    },
    // Mobile projects
    {
      name: "aquarium-mobile",
      testMatch: "aquarium-mobile.spec.ts",
      use: { baseURL: "http://localhost:3004", viewport: mobileViewport, isMobile: true, hasTouch: true },
    },
    {
      name: "breakout-mobile",
      testMatch: "breakout-mobile.spec.ts",
      use: { baseURL: "http://localhost:3010", viewport: mobileViewport, isMobile: true, hasTouch: true },
    },
    {
      name: "floppy-heads-mobile",
      testMatch: "floppy-heads-mobile.spec.ts",
      use: { baseURL: "http://localhost:3011", viewport: mobileViewport, isMobile: true, hasTouch: true },
    },
    {
      name: "nadion-defense-mobile",
      testMatch: "nadion-defense-mobile.spec.ts",
      use: { baseURL: "http://localhost:3012", viewport: mobileViewport, isMobile: true, hasTouch: true },
    },
    {
      name: "null-pow-mobile",
      testMatch: "null-pow-mobile.spec.ts",
      use: { baseURL: "http://localhost:3013", viewport: mobileViewport, isMobile: true, hasTouch: true },
    },
    {
      name: "honeycomb-rush-mobile",
      testMatch: "honeycomb-rush-mobile.spec.ts",
      use: { baseURL: "http://localhost:3014", viewport: mobileViewport, isMobile: true, hasTouch: true },
    },
  ],
  webServer: [
    {
      command: "npx vite preview --port 3004",
      cwd: "./examples/aquarium",
      port: 3004,
      reuseExistingServer,
    },
    {
      command: "npx vite preview --port 3010",
      cwd: "./examples/breakout",
      port: 3010,
      reuseExistingServer,
    },
    {
      command: "npx vite preview --port 3011",
      cwd: "./examples/floppy-heads",
      port: 3011,
      reuseExistingServer,
    },
    {
      command: "npx vite preview --port 3012",
      cwd: "./examples/nadion-defense",
      port: 3012,
      reuseExistingServer,
    },
    {
      command: "npx vite preview --port 3013",
      cwd: "./examples/null-pow",
      port: 3013,
      reuseExistingServer,
    },
    {
      command: "npx vite preview --port 3014",
      cwd: "./examples/honeycomb-rush",
      port: 3014,
      reuseExistingServer,
    },
  ],
});
