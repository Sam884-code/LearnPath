import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getStorageDriver } from "@/lib/storage";
import { deleteSubmission } from "@/services/deleteSubmission";

export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;

  await deleteSubmission(prisma, getStorageDriver(), ctx.userId, id);
  return new NextResponse(null, { status: 204 });
});
