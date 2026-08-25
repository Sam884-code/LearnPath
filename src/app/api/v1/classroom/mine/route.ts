import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { listStudentClassrooms } from "@/services/classroom";

// SPEC.md §13: GET /classroom/mine — the classes the student has joined.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "student");
  const classrooms = await listStudentClassrooms(prisma, ctx.userId);
  return NextResponse.json({ classrooms });
});
