import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rateLimit";
import { startRoadmapGeneration } from "@/services/roadmapGenerate";

const schema = z.object({
  subject_id: z.string().uuid(),
  grade_level: z.number().int().min(1).max(12).nullable().optional(),
  track: z.enum(["exam", "depth"]),
});

// SPEC §14.4: POST /teacher/roadmaps/generate — start a RAG generation in the
// background. Returns a generationId to poll; the draft template appears when it
// finishes.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  enforceRateLimit(`roadmap-generate:${ctx.userId}`, RATE_LIMITS.roadmapGenerate);
  const body = await parseBody(req, schema);

  const result = await startRoadmapGeneration(prisma, {
    subjectId: body.subject_id,
    gradeLevel: body.grade_level ?? null,
    track: body.track,
    teacherId: ctx.userId,
  });

  return NextResponse.json(result, { status: 202 });
});
