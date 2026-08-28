import { z } from "zod";

// Central, validated view of the environment. Import `env` instead of reading
// process.env directly. validateEnv() is called from instrumentation.ts so a
// misconfigured deploy fails fast on boot rather than at the first request.

const baseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Neon Postgres connection string)"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  // When set, teacher self-registration requires this invite code. When unset,
  // teacher self-registration is disabled (students only).
  TEACHER_INVITE_CODE: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a full URL, e.g. https://your-app.vercel.app"),
  STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./storage"),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  // Direct (non-pooled) DB connection for Prisma migrations (SPEC §14 / Supabase).
  DIRECT_URL: z.string().optional(),
  // Observability (SPEC.md §11.2) and rate-limit overrides (§11.1). All optional.
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),
  RATE_LIMIT_LOGIN_MAX: z.string().optional(),
  RATE_LIMIT_REGISTER_MAX: z.string().optional(),
  // AI Knowledge Base (SPEC §14). Optional so the app boots without them; the KB
  // services require them at call time and fail with a clear message if absent.
  GEMINI_API_KEY: z.string().optional(), // Gemini: generation + embeddings
  OPENAI_API_KEY: z.string().optional(), // unused (embeddings moved to Gemini)
  EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  ROADMAP_MODEL: z.string().default("gemini-3.5-flash"),
});

// When STORAGE_DRIVER=r2, the R2 credentials become required.
const schema = baseSchema.superRefine((val, ctx) => {
  if (val.STORAGE_DRIVER === "r2") {
    for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const) {
      if (!val[key]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when STORAGE_DRIVER=r2` });
      }
    }
  }
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

// Validates process.env against the schema, throwing a single readable error
// that lists every problem. Called once on server boot (instrumentation.ts).
export function validateEnv(): Env {
  if (cached) return cached;
  // Treat blank env vars as unset — Vercel surfaces empty values as "", which
  // would otherwise fail optional-enum checks (e.g. LOG_LEVEL) or mask a
  // genuinely-missing required var.
  const cleaned = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  cached = result.data;
  return cached;
}

// Lazily-validated accessor. First call validates; later calls reuse the cache.
export function getEnv(): Env {
  return validateEnv();
}
