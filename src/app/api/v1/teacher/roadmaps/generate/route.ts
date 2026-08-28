import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { generateRoadmap } from "@/services/roadmapGenerate";

const schema = z.object({
  subject_id: z.string().uuid(),
  grade_level: z.number().int().min(1).max(12).nullable().optional(),
  track: z.enum(["exam", "depth"]),
});

// SPEC §14.4: POST /teacher/roadmaps/generate — RAG-generate a DRAFT roadmap
// template from the knowledge base. Returns the draft template id for review.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const body = await parseBody(req, schema);

  const result = await generateRoadmap(prisma, {
    subjectId: body.subject_id,
    gradeLevel: body.grade_level ?? null,
    track: body.track,
    teacherId: ctx.userId,
  });

  return NextResponse.json(result, { status: 201 });
});
