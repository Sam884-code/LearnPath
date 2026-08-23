// Dedicated ports/DB for the Playwright e2e run, kept separate from the vitest
// harness (54329) and local dev (5432) so all three can coexist.
export const E2E_DB_PORT = 54330;
export const E2E_DB_NAME = "focus_e2e";
export const E2E_DB_URL = `postgresql://postgres:password@127.0.0.1:${E2E_DB_PORT}/${E2E_DB_NAME}`;
export const E2E_APP_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_APP_PORT}`;
// Must satisfy the JWT_SECRET >= 16 char rule enforced on boot by src/lib/env.ts.
export const E2E_JWT_SECRET = "e2e-only-secret-do-not-use-elsewhere";
export const E2E_STORAGE_PATH = "./.e2e-storage";
