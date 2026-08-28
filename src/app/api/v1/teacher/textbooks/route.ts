import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { getStorageDriver } from "@/lib/storage";
import { ingestTextbook } from "@/services/textbookIngest";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// SPEC §14.4: GET /teacher/textbooks — list textbooks with status + chunk counts.
export const GET = withErrorHandling(async (req: NextRequest) => {
  requireRole(await requireAuth(req), "teacher");
  const rows = await prisma.textbook.findMany({
    orderBy: { createdAt: "desc" },
    include: { subject: true, _count: { select: { chunks: true } } },
  });
  return NextResponse.json({
    textbooks: rows.map((t) => ({
      id: t.id,
      title: t.title,
      subject: { id: t.subjectId, title: t.subject.title },
      grade_level: t.gradeLevel,
      file_name: t.fileName,
      page_count: t.pageCount,
      status: t.status,
      error: t.error,
      chunk_count: t._count.chunks,
      created_at: t.createdAt,
    })),
  });
});

// SPEC §14.4: POST /teacher/textbooks — upload a PDF; ingestion starts in the
// background (status uploaded → processing → ready | failed).
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ctx = requireRole(await requireAuth(req), "teacher");

  const form = await req.formData();
  const file = form.get("file");
  const subjectId = String(form.get("subject_id") ?? "");
  const title = String(form.get("title") ?? "");
  const gradeRaw = form.get("grade_level");
  const gradeLevel = gradeRaw ? Number.parseInt(String(gradeRaw), 10) : null;

  if (!(file instanceof File)) {
    throw new ApiError(400, "VALIDATION_ERROR", "A file field named 'file' is required");
  }
  if (!subjectId) {
    throw new ApiError(400, "VALIDATION_ERROR", "subject_id is required");
  }
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    throw new ApiError(400, "UNSUPPORTED_FILE_TYPE", "Only PDF textbooks are supported");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(400, "FILE_TOO_LARGE", "Textbook exceeds the 50 MB limit");
  }

  const key = `textbooks/${randomUUID()}-${file.name}`;
  await getStorageDriver().upload({ key, body: buffer, contentType: "application/pdf" });

  const textbook = await prisma.textbook.create({
    data: {
      subjectId,
      gradeLevel: gradeLevel && Number.isFinite(gradeLevel) ? gradeLevel : null,
      title: title || file.name,
      fileKey: key,
      fileName: file.name,
      uploadedById: ctx.userId,
      status: "uploaded",
    },
  });

  // Fire-and-forget: ingestion (extract → embed → store) runs in the background
  // and records its own success/failure on the textbook row.
  void ingestTextbook(prisma, textbook.id, buffer).catch(() => {});

  return NextResponse.json({ textbook: { id: textbook.id, status: "uploaded" } }, { status: 202 });
});
