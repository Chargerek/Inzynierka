import { defineConfig } from "@playwright/test";

/**
 * Testy dymne E2E — wymagają działającego stacku (docker compose up)
 * albo dev servera. Adresy można nadpisać zmiennymi środowiskowymi:
 *   PLAYWRIGHT_BASE_URL (domyślnie http://localhost:3000)
 *   PLAYWRIGHT_API_URL  (domyślnie http://localhost:8000)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    locale: "pl-PL",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
