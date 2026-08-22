import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { getStorageDriver } from "@/lib/storage";
import { addMaterial } from "@/services/templateAuthoring";

export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = requireRole(await requireAuth(req), "teacher");
  const { id } = await params;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "VALIDATION_ERROR", "A file field named 'file' is required");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const material = await addMaterial(prisma, getStorageDriver(), ctx.userId, id, {
    buffer,
    originalName: file.name || "file",
  });

  return NextResponse.json({ material }, { status: 201 });
});
