import type { NextRequest } from "next/server";
import { ApiError } from "./errors";
import { logger } from "./logger";

// SPEC.md §11.1. A fixed-window rate limiter behind a swappable store, so the
// in-memory default can be replaced by a shared store (Upstash Redis) at scale
// without touching call sites.

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export interface RateLimitStore {
  hit(key: string, limit: number, windowMs: number): RateLimitResult;
}

// Single-instance fixed-window counter. Correct behind one server; only a soft
// limit across multiple serverless instances (see SPEC.md §11.1).
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      // Opportunistic cleanup so the map doesn't grow unbounded.
      if (this.buckets.size > 5000) this.sweep(now);
      return { allowed: true, remaining: limit - 1, resetAt };
    }
    existing.count += 1;
    return { allowed: existing.count <= limit, remaining: Math.max(limit - existing.count, 0), resetAt: existing.resetAt };
  }

  private sweep(now: number) {
    for (const [k, v] of this.buckets) if (now >= v.resetAt) this.buckets.delete(k);
  }

  // Test seam.
  reset() {
    this.buckets.clear();
  }
}

export const memoryStore = new MemoryRateLimitStore();

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Named limiter configs; limits overridable via env for tests/staging.
export const RATE_LIMITS = {
  login: { max: envInt("RATE_LIMIT_LOGIN_MAX", 5), windowMs: 15 * 60_000 },
  register: { max: envInt("RATE_LIMIT_REGISTER_MAX", 10), windowMs: 60 * 60_000 },
  // AI Knowledge Base (SPEC §14) — protect quota/cost. Keyed per teacher.
  textbookUpload: { max: envInt("RATE_LIMIT_UPLOAD_MAX", 20), windowMs: 60 * 60_000 },
  roadmapGenerate: { max: envInt("RATE_LIMIT_GENERATE_MAX", 10), windowMs: 60 * 60_000 },
  classroomJoin: { max: envInt("RATE_LIMIT_JOIN_MAX", 20), windowMs: 60 * 60_000 },
} as const;

// Best-effort client IP; Vercel populates x-forwarded-for. Falls back to a
// constant so the limiter still works locally (and in tests).
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

// Records a hit and throws RATE_LIMITED (429) once the window limit is exceeded.
export function enforceRateLimit(
  key: string,
  cfg: { max: number; windowMs: number },
  store: RateLimitStore = memoryStore
): void {
  const result = store.hit(key, cfg.max, cfg.windowMs);
  if (!result.allowed) {
    const retryAfterSec = Math.max(Math.ceil((result.resetAt - Date.now()) / 1000), 1);
    logger.warn({ key, retryAfterSec }, "rate limit exceeded");
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
  }
}
