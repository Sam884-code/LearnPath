import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { askMentorQuestion, listMentorQuestions } from "@/services/mentorQuestions";

export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;

  const questions = await listMentorQuestions(prisma, ctx.userId, id);
  return NextResponse.json({ questions });
});

const askSchema = z.object({
  body: z.string().min(1),
  user_step_id: z.string().uuid().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;
  const body = await parseBody(req, askSchema);

  const question = await askMentorQuestion(prisma, ctx.userId, id, body.body, body.user_step_id ?? null);
  return NextResponse.json({ question }, { status: 201 });
});
