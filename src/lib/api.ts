import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError, errorBody } from "./errors";

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
      console.error(e);
      // "INTERNAL_ERROR" isn't in SPEC.md §5.1's closed code list — this is a
      // last-resort fallback for genuinely unexpected failures, kept in the
      // same { error: { code, message } } shape as every other response.
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, { status: 500 });
    }
  };
}
