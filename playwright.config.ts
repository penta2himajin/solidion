import { defineConfig, devices } from "@playwright/test";

const reuseExistingServer = !process.env.CI;

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
  ],
});
