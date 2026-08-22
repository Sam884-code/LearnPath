import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { gradeSubmission } from "@/services/gradingQueue";

const gradeSchema = z.object({
  grade: z.number().int().min(0).max(100),
  feedback: z.string().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const body = await parseBody(req, gradeSchema);

  const result = await gradeSubmission(prisma, ctx.userId, id, body.grade, body.feedback ?? null);
  return NextResponse.json(result);
});
