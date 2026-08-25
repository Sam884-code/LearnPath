import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { joinClassroom } from "@/services/classroom";

const joinSchema = z.object({ code: z.string().trim().min(1, "Code is required").max(16) });

// SPEC.md §13: POST /classroom/join { code } — a student joins a teacher's class.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "student");
  const body = await parseBody(req, joinSchema);
  const result = await joinClassroom(prisma, ctx.userId, body.code);
  return NextResponse.json(result, { status: 201 });
});
