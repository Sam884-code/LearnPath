import { describe, test, expect } from "vitest";
import { MemoryRateLimitStore, enforceRateLimit } from "./rateLimit";
import { ApiError } from "./errors";

describe("MemoryRateLimitStore", () => {
  test("allows up to the limit, then blocks", () => {
    const store = new MemoryRateLimitStore();
    const results = Array.from({ length: 4 }, () => store.hit("k", 3, 60_000));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
  });

  test("isolates keys from each other", () => {
    const store = new MemoryRateLimitStore();
    expect(store.hit("a", 1, 60_000).allowed).toBe(true);
    expect(store.hit("a", 1, 60_000).allowed).toBe(false);
    // Different key still has its full budget.
    expect(store.hit("b", 1, 60_000).allowed).toBe(true);
  });

  test("resets after the window elapses", async () => {
    const store = new MemoryRateLimitStore();
    expect(store.hit("k", 1, 30).allowed).toBe(true);
    expect(store.hit("k", 1, 30).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 45));
    expect(store.hit("k", 1, 30).allowed).toBe(true);
  });
});

describe("enforceRateLimit", () => {
  test("throws RATE_LIMITED (429) once the limit is exceeded", () => {
    const store = new MemoryRateLimitStore();
    const cfg = { max: 2, windowMs: 60_000 };
    enforceRateLimit("login:x", cfg, store); // 1
    enforceRateLimit("login:x", cfg, store); // 2
    try {
      enforceRateLimit("login:x", cfg, store); // 3 -> blocked
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("RATE_LIMITED");
      expect((e as ApiError).status).toBe(429);
    }
  });
});
