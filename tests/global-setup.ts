import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { TEST_DB_NAME, TEST_DB_PORT, TEST_DB_URL } from "./test-db-config";

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, ".pgtest-data");
const testStorageDir = path.join(projectRoot, ".test-storage");

// Spins up a real, throwaway Postgres server for the test run — vitest's
// concurrency tests need genuine row locking, which nothing in-memory or
// mocked can substitute for.
export default async function setup() {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(testStorageDir, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "password",
    port: TEST_DB_PORT,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(TEST_DB_NAME);

  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });

  return async () => {
    await pg.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  };
}
