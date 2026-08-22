import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getQuiz } from "@/services/getQuiz";

export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;
  const quiz = await getQuiz(prisma, ctx.userId, id);
  return NextResponse.json(quiz);
});
