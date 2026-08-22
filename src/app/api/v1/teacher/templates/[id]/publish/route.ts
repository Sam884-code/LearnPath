import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { publishTemplate } from "@/services/templateAuthoring";

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  requireRole(await requireAuth(req), "teacher");
  const { id } = await params;

  const template = await publishTemplate(prisma, id);
  return NextResponse.json({ template });
});
