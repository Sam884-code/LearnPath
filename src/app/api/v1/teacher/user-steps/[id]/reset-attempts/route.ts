import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { resetStepAttempts } from "@/services/resetStepAttempts";

// SPEC.md §11.3: POST /teacher/user-steps/:id/reset-attempts
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const step = await resetStepAttempts(prisma, ctx.userId, id);
  return NextResponse.json({ step });
});
