import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  // CI: Vite on :5173 via webServer below. Local Wrangler primary is http://127.0.0.1:8787 via .\dev.ps1 (T7).
  // Do not hard-code http://127.0.0.1:5173 or :8787 in specs — use page.goto("/") relative to baseURL.
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--disable-blink-features=AutomationControlled"],
        },
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // Vite fallback proxy (vite.config.ts:64). Wrangler :8787 is spun via .\dev.ps1, not here.
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
