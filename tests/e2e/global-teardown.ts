import type EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";
import { E2E_STORAGE_PATH } from "./e2e-config";

export default async function globalTeardown() {
  const pg = (globalThis as unknown as { __E2E_PG__?: EmbeddedPostgres }).__E2E_PG__;
  if (pg) await pg.stop();

  const projectRoot = path.resolve(__dirname, "..", "..");
  fs.rmSync(path.join(projectRoot, ".e2edb"), { recursive: true, force: true });
  fs.rmSync(path.join(projectRoot, E2E_STORAGE_PATH), { recursive: true, force: true });
}
