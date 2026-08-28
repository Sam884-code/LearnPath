import pino from "pino";

// Single structured logger for all server-side code. Plain JSON to stdout (no
// transport worker — that keeps it compatible with Next's server bundler and
// with Vercel, which captures stdout as logs). Level is controlled by LOG_LEVEL
// (default "info"); use "debug" locally or "silent" in tests.
//
// Guard the level: an empty or invalid LOG_LEVEL (e.g. a blank Vercel env var,
// which arrives as "" and slips past ??) would make Pino throw at import time
// ("default level: must be included in custom levels") and break the build.
const VALID_LEVELS = new Set(["trace", "debug", "info", "warn", "error", "fatal", "silent"]);
const envLevel = process.env.LOG_LEVEL;
const level =
  envLevel && VALID_LEVELS.has(envLevel)
    ? envLevel
    : process.env.NODE_ENV === "test"
      ? "silent"
      : "info";

export const logger = pino({
  level,
  base: undefined, // omit pid/hostname noise; add real context per-call instead
});

export type Logger = typeof logger;
