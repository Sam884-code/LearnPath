import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { submitQuiz } from "@/services/submitQuiz";

const submitSchema = z.object({
  answers: z.array(
    z.object({
      question_id: z.string().uuid(),
      chosen_index: z.number().int().min(0),
    })
  ),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;
  const body = await parseBody(req, submitSchema);
  const result = await submitQuiz(prisma, ctx.userId, id, body.answers);
  return NextResponse.json(result);
});
