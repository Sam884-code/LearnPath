import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { createEnrollment } from "@/services/createEnrollment";
import { serializeSubject } from "@/lib/serialize";

const enrollmentSchema = z.object({
  subject_id: z.string().uuid("subject_id must be a valid UUID"),
  track: z.enum(["exam", "depth"]),
  daily_hours: z.enum(["lt1", "1to2", "gt3"]),
  wants_mentor_qa: z.boolean(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = await requireAuth(req);
  const body = await parseBody(req, enrollmentSchema);

  const { enrollment, template, activeUserStep } = await createEnrollment(prisma, {
    userId: ctx.userId,
    subjectId: body.subject_id,
    track: body.track,
    dailyHours: body.daily_hours,
    wantsMentorQa: body.wants_mentor_qa,
    rawAnswers: body,
  });

  const activeTemplateStep = template.steps.find((s) => s.id === activeUserStep.templateStepId)!;

  return NextResponse.json(
    {
      enrollment: {
        id: enrollment.id,
        subject: serializeSubject(template.subject),
        track: enrollment.track,
        pace: enrollment.pace,
        started_at: enrollment.startedAt,
        total_steps: template.steps.length,
      },
      active_step: {
        id: activeUserStep.id,
        title: activeTemplateStep.title,
        type: activeTemplateStep.type,
        order_index: activeUserStep.orderIndex,
        due_date: activeUserStep.dueDate,
      },
    },
    { status: 201 }
  );
});
