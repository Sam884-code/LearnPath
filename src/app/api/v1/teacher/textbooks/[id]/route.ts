import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { getStorageDriver } from "@/lib/storage";

// SPEC §14.4: DELETE /teacher/textbooks/:id — remove the textbook, its chunks
// (cascade), and the stored PDF.
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  requireRole(await requireAuth(req), "teacher");
  const { id } = await params;

    const textbook = await prisma.textbook.findUnique({ where: { id } });
    if (!textbook) {
      throw new ApiError(404, "NOT_FOUND", "Textbook not found");
    }

    try {
      await getStorageDriver().delete(textbook.fileKey);
    } catch {
      // Blob may already be gone; deleting the row is what matters.
    }
    await prisma.textbook.delete({ where: { id } }); // chunks cascade

    return new NextResponse(null, { status: 204 });
  },
);
