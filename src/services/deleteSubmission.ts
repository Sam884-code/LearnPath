import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import type { StorageDriver } from "@/lib/storage/types";

// SPEC.md §5.6: DELETE /submissions/:id — only own, only while grade IS NULL.
export async function deleteSubmission(
  prisma: PrismaClient,
  storage: StorageDriver,
  userId: string,
  submissionId: string
): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { userStep: { include: { enrollment: true } } },
  });

  if (!submission) {
    throw new ApiError(404, "NOT_FOUND", "Submission not found");
  }
  if (submission.userStep.enrollment.userId !== userId) {
    throw new ApiError(403, "FORBIDDEN", "You can only delete your own submissions");
  }
  if (submission.grade !== null) {
    throw new ApiError(403, "FORBIDDEN", "Cannot delete a submission that has already been graded");
  }

  await storage.delete(submission.fileKey);
  await prisma.submission.delete({ where: { id: submissionId } });
}
