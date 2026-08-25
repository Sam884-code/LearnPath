import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { regenerateJoinCode } from "@/services/classroom";

// SPEC.md §13: POST /teacher/classroom/regenerate — rotate the join code.
// Existing members stay; only new joins need the new code.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const classroom = await regenerateJoinCode(prisma, ctx.userId);
  return NextResponse.json({ classroom });
});
