import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { viewLessonStep } from "@/services/viewStep";

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;
  const result = await viewLessonStep(prisma, ctx.userId, id);
  return NextResponse.json(result);
});
