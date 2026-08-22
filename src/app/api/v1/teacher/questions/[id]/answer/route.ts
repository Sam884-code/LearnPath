import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { answerMentorQuestion } from "@/services/mentorQuestions";

const answerSchema = z.object({
  answer: z.string().min(1),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const body = await parseBody(req, answerSchema);

  const question = await answerMentorQuestion(prisma, ctx.userId, id, body.answer);
  return NextResponse.json({ question });
});
