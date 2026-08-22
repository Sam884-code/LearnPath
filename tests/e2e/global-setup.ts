import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { E2E_DB_NAME, E2E_DB_PORT, E2E_DB_URL, E2E_STORAGE_PATH } from "./e2e-config";

const projectRoot = path.resolve(__dirname, "..", "..");
const dataDir = path.join(projectRoot, ".e2edb");

// Starts a throwaway Postgres for the e2e run, migrates and seeds it. Kept on
// globalThis so global-teardown can stop it (same Playwright runner process).
export default async function globalSetup() {
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(path.join(projectRoot, E2E_STORAGE_PATH), { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "password",
    port: E2E_DB_PORT,
    persistent: false,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(E2E_DB_NAME);

  const env = { ...process.env, DATABASE_URL: E2E_DB_URL };
  execSync("npx prisma migrate deploy", { cwd: projectRoot, env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { cwd: projectRoot, env, stdio: "inherit" });

  (globalThis as unknown as { __E2E_PG__?: EmbeddedPostgres }).__E2E_PG__ = pg;
}
