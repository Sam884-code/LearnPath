import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { listPendingSubmissions } from "@/services/gradingQueue";

// SPEC.md §5.8: GET /teacher/submissions?status=pending — "pending" is the
// only documented status value.
export const GET = withErrorHandling(async (req: NextRequest) => {
  requireRole(await requireAuth(req), "teacher");
  const submissions = await listPendingSubmissions(prisma);
  return NextResponse.json({ submissions });
});
