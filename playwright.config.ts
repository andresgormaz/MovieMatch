import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// This dev sandbox pre-installs Chromium outside Playwright's usual cache
// dir; use it when present so tests don't need a `playwright install` step
// here, but fall back to Playwright's normal browser resolution anywhere
// else this config runs (CI, another machine) where that path won't exist.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  // Tests share one local dev database (same as this repo's existing manual
  // verification scripts) -- running them one at a time avoids cross-test
  // interference instead of adding per-test data isolation infrastructure.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
});
