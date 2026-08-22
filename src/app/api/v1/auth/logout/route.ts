import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api";
import { AUTH_COOKIE_NAME } from "@/lib/jwt";

// Not in SPEC.md §5.2's list, but core auth: clears the httpOnly session
// cookie (which client JS cannot touch). Used by the sign-out control.
export const POST = withErrorHandling(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
