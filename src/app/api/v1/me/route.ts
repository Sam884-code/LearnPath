import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { serializeEnrollment, serializeUser } from "@/lib/serialize";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const ctx = await requireAuth(req);

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    include: { enrollments: true },
  });
  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  return NextResponse.json({
    user: serializeUser(user),
    enrollments: user.enrollments.map(serializeEnrollment),
  });
});
