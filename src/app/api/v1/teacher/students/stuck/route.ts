import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { listStuckStudents } from "@/services/stuckStudents";

export const GET = withErrorHandling(async (req: NextRequest) => {
  requireRole(await requireAuth(req), "teacher");
  const students = await listStuckStudents(prisma);
  return NextResponse.json({ students });
});
