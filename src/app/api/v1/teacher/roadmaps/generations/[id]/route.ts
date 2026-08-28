import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { ApiError } from "@/lib/errors";

// SPEC §14.4: GET /teacher/roadmaps/generations/:id — poll a generation's status
// (pending → processing → ready | failed). Returns the draft template id + step
// count when ready.
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const { id } = await params;

  const gen = await prisma.roadmapGeneration.findUnique({ where: { id } });
  if (!gen || gen.createdById !== ctx.userId) {
    throw new ApiError(404, "NOT_FOUND", "Generation not found");
  }

  const stepCount = gen.templateId
    ? await prisma.templateStep.count({ where: { templateId: gen.templateId } })
    : null;

  return NextResponse.json({
    status: gen.status,
    template_id: gen.templateId,
    step_count: stepCount,
    error: gen.error,
  });
});
