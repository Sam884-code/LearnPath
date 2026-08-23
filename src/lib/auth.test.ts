import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "./auth";
import { signToken } from "./jwt";
import { ApiError } from "./errors";

function reqWith(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/v1/me", { headers });
}

describe("requireAuth", () => {
  test("rejects a request with no token as UNAUTHORIZED", async () => {
    await expect(requireAuth(reqWith())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("rejects a malformed/invalid bearer token as UNAUTHORIZED", async () => {
    await expect(requireAuth(reqWith({ authorization: "Bearer not-a-real-jwt" }))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("accepts a valid bearer token and returns the auth context", async () => {
    const token = signToken("user-123", "student");
    const ctx = await requireAuth(reqWith({ authorization: `Bearer ${token}` }));
    expect(ctx).toEqual({ userId: "user-123", role: "student" });
  });

  test("accepts the token via the httpOnly cookie too", async () => {
    const token = signToken("user-abc", "teacher");
    const ctx = await requireAuth(reqWith({ cookie: `token=${token}` }));
    expect(ctx).toEqual({ userId: "user-abc", role: "teacher" });
  });
});

describe("requireRole", () => {
  test("a student is refused a teacher-only role with FORBIDDEN", () => {
    expect(() => requireRole({ userId: "s1", role: "student" }, "teacher")).toThrow(ApiError);
    try {
      requireRole({ userId: "s1", role: "student" }, "teacher");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
      expect((e as ApiError).status).toBe(403);
    }
  });

  test("a teacher passes the teacher role check", () => {
    const ctx = { userId: "t1", role: "teacher" as const };
    expect(requireRole(ctx, "teacher")).toBe(ctx);
  });
});
