import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getStorageDriver } from "@/lib/storage";
import { getSubmissionDownloadUrl } from "@/services/getSubmissionDownloadUrl";

export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const ctx = await requireAuth(req);
  const { id } = await params;

  const url = await getSubmissionDownloadUrl(prisma, getStorageDriver(), ctx.userId, ctx.role, id);
  return NextResponse.redirect(url, 302);
});
