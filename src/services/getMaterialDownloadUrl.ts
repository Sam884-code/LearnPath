import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";
import type { StorageDriver } from "@/lib/storage/types";

const SIGNED_URL_TTL_SECONDS = 15 * 60;

// SPEC.md §5.6: GET /materials/:id/file — 302 to a 15-minute signed URL.
// Materials belong to a template_step shared across every enrolled student,
// not to one specific enrollment, so "own" here means "you have a user_step
// for this template_step that isn't locked" — a teacher can always access it.
export async function getMaterialDownloadUrl(
  prisma: PrismaClient,
  storage: StorageDriver,
  userId: string,
  role: "student" | "teacher",
  materialId: string
): Promise<string> {
  const material = await prisma.stepMaterial.findUnique({
    where: { id: materialId },
  });

  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Material not found");
  }

  if (role !== "teacher") {
    const accessibleUserStep = await prisma.userStep.findFirst({
      where: {
        templateStepId: material.templateStepId,
        status: { not: "locked" },
        enrollment: { userId },
      },
    });
    if (!accessibleUserStep) {
      throw new ApiError(403, "FORBIDDEN", "You don't have access to this material");
    }
  }

  return storage.getSignedDownloadUrl(material.fileKey, SIGNED_URL_TTL_SECONDS);
}
