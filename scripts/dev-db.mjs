// Starts a real local Postgres for development using the embedded binary,
// matching the DATABASE_URL in .env (postgres:postgres@localhost:5432/focus).
// Keeps running until killed. Not part of the app — a convenience for running
// the full stack without installing Postgres.
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";

const dataDir = path.join(process.cwd(), ".devdb");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const alreadyInitialised = await import("node:fs").then((fs) => fs.existsSync(path.join(dataDir, "PG_VERSION")));

if (!alreadyInitialised) {
  await pg.initialise();
}
await pg.start();

if (!alreadyInitialised) {
  await pg.createDatabase("focus");
}

console.log("dev-db ready on port 5432 (database: focus)");

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
