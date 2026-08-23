import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// SPEC.md §11.1: login is rate-limited to 5 attempts / 15 min per IP + email.
// The e2e server pins RATE_LIMIT_LOGIN_MAX=5 (see playwright.config.ts).
test("login is rate-limited after repeated failed attempts (429 RATE_LIMITED)", async ({ page }) => {
  // A unique email keeps this test's counter isolated from any other login.
  const email = `ratelimit-${randomUUID()}@test.local`;

  const statuses: number[] = [];
  let rateLimitedBody: { error?: { code?: string } } | null = null;

  for (let i = 0; i < 7; i++) {
    const res = await page.request.post("/api/v1/auth/login", {
      data: { email, password: "wrong-password" },
      failOnStatusCode: false,
    });
    statuses.push(res.status());
    if (res.status() === 429) {
      rateLimitedBody = await res.json();
      break;
    }
  }

  // The first attempts return 401 INVALID_CREDENTIALS; once the limit is passed
  // the endpoint returns 429 RATE_LIMITED instead of continuing to process them.
  expect(statuses).toContain(429);
  expect(statuses.filter((s) => s === 401).length).toBeGreaterThanOrEqual(5);
  expect(rateLimitedBody?.error?.code).toBe("RATE_LIMITED");
});
