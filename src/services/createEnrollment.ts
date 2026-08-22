import { Pace, Prisma, PrismaClient, RoadmapTemplate, Subject, TemplateStep, Track, UserStep } from "@prisma/client";
import { ApiError } from "@/lib/errors";

type DailyHours = "lt1" | "1to2" | "gt3";

// SPEC.md §3, Q3 -> pace mapping.
const PACE_BY_DAILY_HOURS: Record<DailyHours, Pace> = {
  lt1: "light",
  "1to2": "normal",
  gt3: "intense",
};

const PACE_SPACING: Record<Pace, { divisor: number; minDays: number }> = {
  light: { divisor: 30, minDays: 3 },
  normal: { divisor: 60, minDays: 2 },
  intense: { divisor: 120, minDays: 1 },
};

// SPEC.md §3 gives a per-step spacing rule but never defines the referenced
// `cumulative_spacing` helper precisely. Read literally ("cumulative"), each
// step's due_date is the enrollment start plus the running total of every
// prior step's spacing (in whole days) plus its own — a growing schedule from
// day one, not an isolated offset recomputed per step.
function stepSpacingDays(pace: Pace, estimatedMinutes: number): number {
  const { divisor, minDays } = PACE_SPACING[pace];
  return Math.ceil(Math.max(estimatedMinutes / divisor, minDays));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export type CreateEnrollmentInput = {
  userId: string;
  subjectId: string;
  track: Track;
  dailyHours: DailyHours;
  wantsMentorQa: boolean;
  rawAnswers: unknown;
};

export type CreateEnrollmentResult = {
  enrollment: Awaited<ReturnType<PrismaClient["enrollment"]["create"]>>;
  template: RoadmapTemplate & { subject: Subject; steps: TemplateStep[] };
  activeUserStep: UserStep;
};

// SPEC.md §3's enrollment-creation transaction: resolve the published
// template, then create the enrollment and every user_step atomically — a
// half-created roadmap is worse than a failed signup.
export async function createEnrollment(
  prisma: PrismaClient,
  input: CreateEnrollmentInput
): Promise<CreateEnrollmentResult> {
  const liveEnrollment = await prisma.enrollment.findFirst({
    where: { userId: input.userId, subjectId: input.subjectId, completedAt: null },
  });
  if (liveEnrollment) {
    throw new ApiError(409, "ALREADY_ENROLLED", "You already have an active enrollment in this subject");
  }

  const template = await prisma.roadmapTemplate.findFirst({
    where: { subjectId: input.subjectId, track: input.track, isPublished: true },
    include: { steps: { orderBy: { orderIndex: "asc" } }, subject: true },
  });
  if (!template) {
    throw new ApiError(422, "NO_TEMPLATE_AVAILABLE", "No published template exists for this subject and track");
  }

  const pace = PACE_BY_DAILY_HOURS[input.dailyHours];
  const startedAt = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          userId: input.userId,
          subjectId: input.subjectId,
          templateId: template.id,
          track: input.track,
          pace,
          wantsMentorQa: input.wantsMentorQa,
          rawAnswers: input.rawAnswers as Prisma.InputJsonValue,
          startedAt,
        },
      });

      let cumulativeDays = 0;
      let activeUserStep: UserStep | null = null;

      for (const step of template.steps) {
        cumulativeDays += stepSpacingDays(pace, step.estimatedMinutes);
        const userStep = await tx.userStep.create({
          data: {
            enrollmentId: enrollment.id,
            templateStepId: step.id,
            orderIndex: step.orderIndex,
            status: step.orderIndex === 1 ? "active" : "locked",
            dueDate: addDays(startedAt, cumulativeDays),
            activatedAt: step.orderIndex === 1 ? startedAt : null,
          },
        });
        if (step.orderIndex === 1) activeUserStep = userStep;
      }

      return { enrollment, template, activeUserStep: activeUserStep! };
    });
  } catch (e) {
    // Defense in depth: the partial unique index from Prompt 1
    // (enrollments_user_id_subject_id_live_key) is the real guarantee against
    // a race between two concurrent enrollment requests; the findFirst check
    // above is just the fast, common-case path.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "ALREADY_ENROLLED", "You already have an active enrollment in this subject");
    }
    throw e;
  }
}
