import { defineConfig } from "@playwright/test";
import {
  E2E_APP_PORT,
  E2E_BASE_URL,
  E2E_DB_URL,
  E2E_JWT_SECRET,
  E2E_STORAGE_PATH,
} from "./tests/e2e/e2e-config";

// The app is served with `next dev` (not `next start`) because `next build`
// fails under OneDrive on this machine with an EINVAL readlink error — a
// filesystem quirk, unrelated to the app. Dev mode compiles each route on
// first hit, so timeouts are generous.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command: `npx next dev -p ${E2E_APP_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB_URL,
      JWT_SECRET: E2E_JWT_SECRET,
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_PATH: E2E_STORAGE_PATH,
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
    },
  },
});
