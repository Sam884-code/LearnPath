import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { ApiError } from "./errors";
import { AUTH_COOKIE_NAME, verifyToken } from "./jwt";

export type AuthContext = { userId: string; role: Role };

// Accepts either the httpOnly cookie (browser sessions) or an
// `Authorization: Bearer <jwt>` header (API clients), per SPEC.md §5.
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieToken = req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  const token = bearerToken ?? cookieToken;

  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    const payload = verifyToken(token);
    return { userId: payload.sub, role: payload.role };
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}

// Used as: requireRole(await requireAuth(req), "teacher")
export function requireRole(ctx: AuthContext, role: Role): AuthContext {
  if (ctx.role !== role) {
    throw new ApiError(403, "FORBIDDEN", `This action requires the '${role}' role`);
  }
  return ctx;
}
