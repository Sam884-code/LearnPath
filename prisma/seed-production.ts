import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// One-time production bootstrap. Unlike prisma/seed.ts (which creates test
// students and demo templates), this seeds only what a real deployment needs
// to get started: the first teacher account and the base subjects. The teacher
// then authors real roadmap templates through the teacher UI.
//
// Run once after the first deploy:
//   TEACHER_NAME="..." TEACHER_EMAIL="..." TEACHER_PASSWORD="..." \
//   DATABASE_URL="<neon-url>" npx tsx prisma/seed-production.ts
//
// Idempotent: safe to re-run (it updates the teacher's password if changed).

const prisma = new PrismaClient();

const SUBJECTS = [
  { title: "Մաթեմատիկա", slug: "mathematics", icon: "math" },
  { title: "Ֆիզիկա", slug: "physics", icon: "physics" },
];

async function main() {
  const name = process.env.TEACHER_NAME;
  const email = process.env.TEACHER_EMAIL;
  const password = process.env.TEACHER_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Set TEACHER_NAME, TEACHER_EMAIL and TEACHER_PASSWORD before running this script."
    );
  }
  if (password.length < 8) {
    throw new Error("TEACHER_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const teacher = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "teacher" },
    create: { name, email, passwordHash, role: "teacher", locale: "hy" },
  });

  for (const s of SUBJECTS) {
    await prisma.subject.upsert({
      where: { slug: s.slug },
      update: { title: s.title, icon: s.icon },
      create: { title: s.title, slug: s.slug, icon: s.icon, isActive: true },
    });
  }

  console.log(`Seeded teacher "${teacher.name}" <${teacher.email}> and ${SUBJECTS.length} subjects.`);
  console.log("Log in as this teacher and author roadmap templates in the teacher UI.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
