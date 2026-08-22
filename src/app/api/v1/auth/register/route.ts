import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { setAuthCookie, signToken } from "@/lib/jwt";
import { serializeUser } from "@/lib/serialize";

const BCRYPT_COST = 12;

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Must be a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["student", "teacher"]).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await parseBody(req, registerSchema);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "This email is already registered");
  }

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: bcrypt.hashSync(body.password, BCRYPT_COST),
      role: body.role ?? "student",
    },
  });

  const token = signToken(user.id, user.role);
  const res = NextResponse.json({ token, user: serializeUser(user) }, { status: 201 });
  setAuthCookie(res, token);
  return res;
});
