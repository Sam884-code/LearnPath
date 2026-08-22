import jwt from "jsonwebtoken";
import type { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // SPEC.md §5: 7-day expiry
export const AUTH_COOKIE_NAME = "token";

export type AuthTokenPayload = {
  sub: string;
  role: Role;
  exp: number;
  iat: number;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ role }, getSecret(), {
    subject: userId,
    expiresIn: SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getSecret());
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Invalid token payload");
  }
  return decoded as AuthTokenPayload;
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}
