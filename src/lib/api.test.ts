import { describe, test, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withErrorHandling } from "./api";
import { ApiError } from "./errors";

// Minimal stand-ins — the wrapped handlers throw before touching req/ctx.
const req = {} as NextRequest;
const ctx = { params: Promise.resolve({}) };

async function bodyOf(res: NextResponse) {
  return (await res.json()) as { error: { code: string; message: string } };
}

describe("withErrorHandling", () => {
  test("passes through ApiError with its status and code", async () => {
    const res = await withErrorHandling(async () => {
      throw new ApiError(403, "STEP_LOCKED", "nope");
    })(req, ctx);
    expect(res.status).toBe(403);
    expect((await bodyOf(res)).error.code).toBe("STEP_LOCKED");
  });

  test("maps Prisma P2023 (malformed uuid path param) to 404 NOT_FOUND, not 500", async () => {
    const res = await withErrorHandling(async () => {
      throw new Prisma.PrismaClientKnownRequestError("malformed uuid", {
        code: "P2023",
        clientVersion: "test",
      });
    })(req, ctx);
    expect(res.status).toBe(404);
    expect((await bodyOf(res)).error.code).toBe("NOT_FOUND");
  });

  test("maps Prisma P2025 (record not found) to 404 NOT_FOUND", async () => {
    const res = await withErrorHandling(async () => {
      throw new Prisma.PrismaClientKnownRequestError("not found", {
        code: "P2025",
        clientVersion: "test",
      });
    })(req, ctx);
    expect(res.status).toBe(404);
  });

  test("falls back to 500 INTERNAL_ERROR for genuinely unexpected errors", async () => {
    const res = await withErrorHandling(async () => {
      throw new Error("boom");
    })(req, ctx);
    expect(res.status).toBe(500);
    expect((await bodyOf(res)).error.code).toBe("INTERNAL_ERROR");
  });
});
