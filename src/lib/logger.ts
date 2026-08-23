import pino from "pino";

// Single structured logger for all server-side code. Plain JSON to stdout (no
// transport worker — that keeps it compatible with Next's server bundler and
// with Vercel, which captures stdout as logs). Level is controlled by LOG_LEVEL
// (default "info"); use "debug" locally or "silent" in tests.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: undefined, // omit pid/hostname noise; add real context per-call instead
});

export type Logger = typeof logger;
