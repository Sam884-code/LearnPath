import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { listQuestionsForTeacher } from "@/services/mentorQuestions";

// GET /teacher/questions?status=unanswered (default) | all
export const GET = withErrorHandling(async (req: NextRequest) => {
  requireRole(await requireAuth(req), "teacher");
  const status = req.nextUrl.searchParams.get("status");
  const onlyUnanswered = status !== "all";
  const questions = await listQuestionsForTeacher(prisma, onlyUnanswered);
  return NextResponse.json({ questions });
});
