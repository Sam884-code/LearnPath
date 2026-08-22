import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getRoadmap } from "@/services/getRoadmap";

export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;
  const roadmap = await getRoadmap(prisma, ctx.userId, id);
  return NextResponse.json(roadmap);
});
