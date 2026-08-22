import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    // Playwright e2e specs live in tests/e2e and must not be run by vitest
    // (they import @playwright/test and drive a browser).
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // Run test files sequentially. Each file creates its own PrismaClient (with
    // a default pool of cpus*2+1 connections); running ~15 files in parallel
    // exhausts the embedded Postgres's max_connections=100, surfacing as
    // intermittent PrismaClientInitializationError. Sequential execution keeps
    // only one file's client connected at a time. Tests within a file still run
    // together, so the advanceStep concurrency test is unaffected.
    fileParallelism: false,
    // `test.env` (unlike mutating process.env at runtime) reliably reaches
    // every worker process — needed since the storage driver reads these at
    // construction time. STORAGE_DRIVER is intentionally left unset so tests
    // default to "local", exercising the same driver dev uses without cloud
    // credentials.
    env: {
      JWT_SECRET: "vitest-only-test-secret-do-not-use-elsewhere",
      LOCAL_STORAGE_PATH: "./.test-storage",
    },
  },
});
