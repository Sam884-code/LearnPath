import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import type { StorageDriver } from "@/lib/storage/types";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

// SPEC.md §5.6: GET /submissions/:id/file — 302 to a 15-minute signed URL.
// Readable by the owning student or any teacher (grading requires it).
export async function getSubmissionDownloadUrl(
  prisma: PrismaClient,
  storage: StorageDriver,
  userId: string,
  role: "student" | "teacher",
  submissionId: string
): Promise<string> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { userStep: { include: { enrollment: true } } },
  });

  if (!submission) {
    throw new ApiError(404, "NOT_FOUND", "Submission not found");
  }
  if (role !== "teacher" && submission.userStep.enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only view your own submissions");
  }

  return storage.getSignedDownloadUrl(submission.fileKey, SIGNED_URL_TTL_SECONDS);
}
