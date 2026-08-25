import { PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/errors";

// Short, human-friendly join codes. Ambiguous characters (0/O, 1/I) are left
// out so codes are easy to read aloud and type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Generate a code that isn't already taken (join codes are globally unique).
async function uniqueCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await prisma.classroom.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  // Astronomically unlikely (10 collisions on a 6-char code); let the generic
  // 500 handler in withErrorHandling take it.
  throw new Error("Could not allocate a unique join code");
}

type ClassroomView = {
  id: string;
  name: string;
  join_code: string;
  members: { id: string; name: string; email: string; joined_at: Date }[];
};

async function toView(prisma: PrismaClient, classroomId: string): Promise<ClassroomView> {
  const classroom = await prisma.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    include: {
      memberships: { include: { student: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return {
    id: classroom.id,
    name: classroom.name,
    join_code: classroom.joinCode,
    members: classroom.memberships.map((m) => ({
      id: m.student.id,
      name: m.student.name,
      email: m.student.email,
      joined_at: m.createdAt,
    })),
  };
}

// A teacher has exactly one classroom (Classroom.teacherId is unique). Create it
// lazily the first time it's requested, so "generate a join code" and "view my
// class" both just return the teacher's class.
export async function getOrCreateClassroom(prisma: PrismaClient, teacherId: string): Promise<ClassroomView> {
  const existing = await prisma.classroom.findUnique({ where: { teacherId } });
  if (existing) return toView(prisma, existing.id);

  const teacher = await prisma.user.findUniqueOrThrow({ where: { id: teacherId } });
  const created = await prisma.classroom.create({
    data: { teacherId, name: teacher.name, joinCode: await uniqueCode(prisma) },
  });
  return toView(prisma, created.id);
}

// Rotate the join code (e.g. if the old one leaked). Existing members stay.
export async function regenerateJoinCode(prisma: PrismaClient, teacherId: string): Promise<ClassroomView> {
  await getOrCreateClassroom(prisma, teacherId); // ensure it exists
  const updated = await prisma.classroom.update({
    where: { teacherId },
    data: { joinCode: await uniqueCode(prisma) },
  });
  return toView(prisma, updated.id);
}

// A student joins a class by code. Idempotent: joining a class you're already in
// just returns it. Returns the class plus the owning teacher's name.
export async function joinClassroom(prisma: PrismaClient, studentId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const classroom = await prisma.classroom.findUnique({
    where: { joinCode: code },
    include: { teacher: true },
  });
  if (!classroom) {
    throw new ApiError(404, "CLASSROOM_NOT_FOUND", "No class found for that code");
  }
  if (classroom.teacherId === studentId) {
    throw new ApiError(400, "VALIDATION_ERROR", "You cannot join your own class");
  }

  await prisma.classroomMembership.upsert({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId } },
    update: {},
    create: { classroomId: classroom.id, studentId },
  });

  return {
    classroom: { id: classroom.id, name: classroom.name },
    teacher: { id: classroom.teacher.id, name: classroom.teacher.name },
  };
}

// The classes a student has joined (for showing "you're in X's class").
export async function listStudentClassrooms(prisma: PrismaClient, studentId: string) {
  const memberships = await prisma.classroomMembership.findMany({
    where: { studentId },
    include: { classroom: { include: { teacher: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.classroom.id,
    name: m.classroom.name,
    teacher: { id: m.classroom.teacher.id, name: m.classroom.teacher.name },
    joined_at: m.createdAt,
  }));
}
