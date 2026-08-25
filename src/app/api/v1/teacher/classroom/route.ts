import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { getOrCreateClassroom } from "@/services/classroom";

// SPEC.md §13: GET /teacher/classroom — the teacher's class (created lazily),
// its join code and current members.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const classroom = await getOrCreateClassroom(prisma, ctx.userId);
  return NextResponse.json({ classroom });
});
