import { defineConfig, devices } from "@playwright/test"

// E2E config for the money-flow specs (Phase 4). These drive a REAL browser
// against a locally-running dev server backed by the `dev` Supabase schema.
// The dev server is expected to already be running on PORT (default 3001) — start
// it with `PORT=3001 npm run dev -- -p 3001` before `npm run test:e2e`.
const PORT = process.env.E2E_PORT || "3001"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
