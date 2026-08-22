import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { addQuestion } from "@/services/templateAuthoring";

// SPEC.md §2.6: options is an array of 2-6 strings.
const addQuestionSchema = z
  .object({
    text: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    correct_index: z.number().int().min(0),
    explanation: z.string().min(1),
  })
  .refine((data) => data.correct_index < data.options.length, {
    message: "correct_index must be a valid index into options",
    path: ["correct_index"],
  });

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const body = await parseBody(req, addQuestionSchema);

  const question = await addQuestion(prisma, id, {
    text: body.text,
    options: body.options,
    correctIndex: body.correct_index,
    explanation: body.explanation,
  });

  return NextResponse.json({ question }, { status: 201 });
});
