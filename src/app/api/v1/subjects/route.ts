import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { serializeSubject } from "@/lib/serialize";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth(req);

  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  return NextResponse.json({ subjects: subjects.map(serializeSubject) });
});
