import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { createTemplate, listTemplates } from "@/services/templateAuthoring";

export const GET = withErrorHandling(async (req: NextRequest) => {
  requireRole(await requireAuth(req), "teacher");
  const templates = await listTemplates(prisma);
  return NextResponse.json({ templates });
});

const createTemplateSchema = z.object({
  subject_id: z.string().uuid(),
  track: z.enum(["exam", "depth"]),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const body = await parseBody(req, createTemplateSchema);

  const template = await createTemplate(prisma, ctx.userId, {
    subjectId: body.subject_id,
    track: body.track,
    title: body.title,
    description: body.description,
  });

  return NextResponse.json({ template }, { status: 201 });
});
