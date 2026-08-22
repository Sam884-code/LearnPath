import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { getTemplateDetail } from "@/services/templateAuthoring";

export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const template = await getTemplateDetail(prisma, id);
  return NextResponse.json({ template });
});
