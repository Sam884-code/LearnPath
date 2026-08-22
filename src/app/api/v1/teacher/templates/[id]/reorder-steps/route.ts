import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { reorderSteps } from "@/services/templateAuthoring";

const reorderSchema = z.object({
  step_ids: z.array(z.string().uuid()).min(1),
});

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  requireRole(await requireAuth(req), "teacher");
  const { id } = await params;
  const body = await parseBody(req, reorderSchema);
  const template = await reorderSteps(prisma, id, body.step_ids);
  return NextResponse.json({ template });
});
