import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { addTemplateStep } from "@/services/templateAuthoring";

const addStepSchema = z.object({
  order_index: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["lesson", "quiz", "assignment"]),
  pass_score: z.number().int().min(0).max(100).optional(),
  max_attempts: z.number().int().positive().nullable().optional(),
  estimated_minutes: z.number().int().positive(),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const body = await parseBody(req, addStepSchema);

  const step = await addTemplateStep(prisma, id, {
    orderIndex: body.order_index,
    title: body.title,
    description: body.description,
    type: body.type,
    passScore: body.pass_score,
    maxAttempts: body.max_attempts,
    estimatedMinutes: body.estimated_minutes,
  });

  return NextResponse.json({ step }, { status: 201 });
});
