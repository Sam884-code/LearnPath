import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { setAuthCookie, signToken } from "@/lib/jwt";
import { serializeUser } from "@/lib/serialize";
import { RATE_LIMITS, clientIp, enforceRateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  email: z.string().email("Must be a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await parseBody(req, loginSchema);

  // SPEC.md §11.1: throttle brute-force attempts per IP + email.
  enforceRateLimit(`login:${clientIp(req)}:${body.email.toLowerCase()}`, RATE_LIMITS.login);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !bcrypt.compareSync(body.password, user.passwordHash)) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  const token = signToken(user.id, user.role);
  const res = NextResponse.json({ token, user: serializeUser(user) });
  setAuthCookie(res, token);
  return res;
});
