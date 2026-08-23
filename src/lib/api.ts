import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ZodType } from "zod";
import { ApiError, errorBody } from "./errors";
import { logger } from "./logger";

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    throw new ApiError(400, "VALIDATION_ERROR", message);
  }
  return result.data;
}

type RouteHandler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

// Wraps a route handler so every endpoint returns the exact error envelope
// from SPEC.md §5.1, regardless of where in the handler it throws.
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(errorBody(e.code, e.message), { status: e.status });
      }
      // Map known Prisma errors to clean responses instead of a blanket 500.
      // P2023 = malformed value for a column (e.g. a non-UUID id in the path);
      // P2025 = required record not found. Both mean "no such resource".
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2023" || e.code === "P2025")) {
        return NextResponse.json(errorBody("NOT_FOUND", "Resource not found"), { status: 404 });
      }
      // Structured log with request context (SPEC.md §11.2) so unexpected 500s
      // are traceable. `err` is Pino's serialized-error key. Guarded with
      // optional chaining — the last-resort handler must never throw itself.
      logger.error({ err: e, method: req?.method, path: req?.nextUrl?.pathname }, "unhandled route error");
      // "INTERNAL_ERROR" isn't in SPEC.md §5.1's closed code list — this is a
      // last-resort fallback for genuinely unexpected failures, kept in the
      // same { error: { code, message } } shape as every other response.
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, { status: 500 });
    }
  };
}
