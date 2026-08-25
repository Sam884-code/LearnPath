import { PrismaClient, Track, StepType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD_HASH = bcrypt.hashSync("password123", 12);

async function seedUsers() {
  const teacher = await prisma.user.upsert({
    where: { email: "ani.hakobyan@learnpath.am" },
    update: {},
    create: {
      name: "Անի Հակոբյան",
      email: "ani.hakobyan@learnpath.am",
      passwordHash: PASSWORD_HASH,
      role: "teacher",
      locale: "hy",
    },
  });

  const students = await Promise.all(
    [
      { name: "Դավիթ Պետրոսյան", email: "davit.petrosyan@learnpath.am" },
      { name: "Մարիամ Ղազարյան", email: "mariam.ghazaryan@learnpath.am" },
      { name: "Նարեկ Սարգսյան", email: "narek.sargsyan@learnpath.am" },
    ].map(({ name, email }) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { name, email, passwordHash: PASSWORD_HASH, role: "student", locale: "hy" },
      })
    )
  );

  // Classroom linking the seed students to the teacher, with a fixed, readable
  // join code for predictable local testing.
  const classroom = await prisma.classroom.upsert({
    where: { teacherId: teacher.id },
    update: {},
    create: { teacherId: teacher.id, name: teacher.name, joinCode: "MATH01" },
  });
  for (const student of students) {
    await prisma.classroomMembership.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId: student.id } },
      update: {},
      create: { classroomId: classroom.id, studentId: student.id },
    });
  }

  return { teacher, students, classroom };
}

async function seedSubjects() {
  const math = await prisma.subject.upsert({
    where: { slug: "mathematics" },
    update: {},
    create: { title: "Մաթեմատիկա", slug: "mathematics", icon: "math", isActive: true },
  });

  const physics = await prisma.subject.upsert({
    where: { slug: "physics" },
    update: {},
    create: { title: "Ֆիզիկա", slug: "physics", icon: "physics", isActive: true },
  });

  return { math, physics };
}

async function upsertTemplate(params: {
  subjectId: string;
  track: Track;
  title: string;
  description: string;
  authorId: string;
}) {
  const existing = await prisma.roadmapTemplate.findFirst({
    where: { subjectId: params.subjectId, track: params.track },
  });
  if (existing) {
    return prisma.roadmapTemplate.update({
      where: { id: existing.id },
      data: {
        title: params.title,
        description: params.description,
        authorId: params.authorId,
        isPublished: true,
      },
    });
  }
  return prisma.roadmapTemplate.create({
    data: {
      subjectId: params.subjectId,
      track: params.track,
      title: params.title,
      description: params.description,
      authorId: params.authorId,
      isPublished: true,
    },
  });
}

type StepSeed = {
  orderIndex: number;
  title: string;
  description: string;
  type: StepType;
  passScore?: number;
  maxAttempts?: number | null;
  estimatedMinutes: number;
  questions?: {
    orderIndex: number;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
};

async function upsertSteps(templateId: string, steps: StepSeed[]) {
  for (const step of steps) {
    const templateStep = await prisma.templateStep.upsert({
      where: { templateId_orderIndex: { templateId, orderIndex: step.orderIndex } },
      update: {
        title: step.title,
        description: step.description,
        type: step.type,
        passScore: step.passScore ?? 60,
        maxAttempts: step.maxAttempts === undefined ? 3 : step.maxAttempts,
        estimatedMinutes: step.estimatedMinutes,
      },
      create: {
        templateId,
        orderIndex: step.orderIndex,
        title: step.title,
        description: step.description,
        type: step.type,
        passScore: step.passScore ?? 60,
        maxAttempts: step.maxAttempts === undefined ? 3 : step.maxAttempts,
        estimatedMinutes: step.estimatedMinutes,
      },
    });

    for (const q of step.questions ?? []) {
      await prisma.question.upsert({
        where: {
          templateStepId_orderIndex: { templateStepId: templateStep.id, orderIndex: q.orderIndex },
        },
        update: {
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
        create: {
          templateStepId: templateStep.id,
          orderIndex: q.orderIndex,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
      });
    }
  }
}

// SPEC.md §5 build order calls for 8 steps mixing lesson/quiz/assignment, with
// two of the quiz steps carrying 5 questions each (4 options, with explanations).
const EXAM_STEPS: StepSeed[] = [
  {
    orderIndex: 1,
    type: "lesson",
    title: "Ներածություն հանրահաշվին",
    description:
      "Այս դասում կծանոթանանք հանրահաշվի հիմնական հասկացություններին՝ փոփոխականներ, արտահայտություններ և հավասարումների կազմության սկզբունքները։",
    estimatedMinutes: 30,
  },
  {
    orderIndex: 2,
    type: "quiz",
    title: "Թեստ․ Հանրահաշվի հիմունքներ",
    description: "Ստուգիր, թե որքանով ես յուրացրել հանրահաշվի հիմունքները։",
    estimatedMinutes: 15,
    questions: [
      {
        orderIndex: 1,
        text: "Ո՞րն է 3x + 5 = 11 հավասարման լուծումը։",
        options: ["x = 2", "x = 3", "x = 5", "x = 6"],
        correctIndex: 0,
        explanation: "3x = 11 - 5 = 6, հետևաբար x = 2։",
      },
      {
        orderIndex: 2,
        text: "Ո՞ր արտահայտությունն է համարժեք 2(x + 3)-ին։",
        options: ["2x + 3", "2x + 6", "x + 6", "2x + 5"],
        correctIndex: 1,
        explanation: "Բացելով փակագիծը՝ 2·x + 2·3 = 2x + 6։",
      },
      {
        orderIndex: 3,
        text: "Ի՞նչ է փոփոխականը հանրահաշվում։",
        options: ["Հաստատուն թիվ", "Անհայտ արժեք, որը կարող է փոփոխվել", "Գործողության նշան", "Հավասարման նշան"],
        correctIndex: 1,
        explanation: "Փոփոխականը սովորաբար նշանակվում է տառով և կարող է ընդունել տարբեր արժեքներ։",
      },
      {
        orderIndex: 4,
        text: "Պարզեցրու՝ 5x - 2x։",
        options: ["2x", "3x", "5x", "7x"],
        correctIndex: 1,
        explanation: "5x - 2x = (5-2)x = 3x։",
      },
      {
        orderIndex: 5,
        text: "Ո՞ր արտահայտությունը ՉԻ հավասար 4(x - 1)-ին։",
        options: ["4x - 4", "4x - 1", "-4 + 4x", "4x - 4 (կրկին)"],
        correctIndex: 1,
        explanation: "4(x - 1) = 4x - 4, ոչ թե 4x - 1։",
      },
    ],
  },
  {
    orderIndex: 3,
    type: "lesson",
    title: "Գծային հավասարումներ",
    description: "Կսովորենք լուծել մեկ և երկու փոփոխականով գծային հավասարումներ։",
    estimatedMinutes: 40,
  },
  {
    orderIndex: 4,
    type: "assignment",
    title: "Գործնական աշխատանք 1․ Գծային հավասարումներ",
    description: "Լուծիր կցված 10 խնդիրները և վերբեռնիր քո լուծումների լուսանկարը կամ ֆայլը։",
    estimatedMinutes: 45,
    maxAttempts: null,
  },
  {
    orderIndex: 5,
    type: "lesson",
    title: "Քառակուսի հավասարումներ",
    description: "Դիսկրիմինանտ, արմատների բանաձև և գործոնավորման եղանակներ։",
    estimatedMinutes: 45,
  },
  {
    orderIndex: 6,
    type: "quiz",
    title: "Թեստ․ Քառակուսի հավասարումներ",
    description: "Ստուգիր, թե որքանով ես յուրացրել քառակուսի հավասարումները։",
    estimatedMinutes: 15,
    questions: [
      {
        orderIndex: 1,
        text: "Ո՞րն է x² - 5x + 6 = 0 հավասարման արմատներից մեկը։",
        options: ["x = 1", "x = 2", "x = 4", "x = 5"],
        correctIndex: 1,
        explanation: "(x-2)(x-3) = 0, հետևաբար x = 2 կամ x = 3։",
      },
      {
        orderIndex: 2,
        text: "Ի՞նչ է դիսկրիմինանտը ax² + bx + c = 0 հավասարման համար։",
        options: ["b² - 4ac", "b² + 4ac", "4ac - b²", "a² + b²"],
        correctIndex: 0,
        explanation: "Դիսկրիմինանտի բանաձևն է D = b² - 4ac։",
      },
      {
        orderIndex: 3,
        text: "Եթե դիսկրիմինանտը բացասական է, քանի՞ իրական արմատ ունի հավասարումը։",
        options: ["0", "1", "2", "անվերջ շատ"],
        correctIndex: 0,
        explanation: "Բացասական դիսկրիմինանտի դեպքում իրական արմատներ չկան։",
      },
      {
        orderIndex: 4,
        text: "Ո՞րն է x² = 9 հավասարման լուծումը։",
        options: ["x = 3 միայն", "x = -3 միայն", "x = ±3", "լուծում չկա"],
        correctIndex: 2,
        explanation: "Քառակուսի արմատը վերցնելիս պետք է հաշվի առնել երկու նշանները՝ x = ±3։",
      },
      {
        orderIndex: 5,
        text: "ax² + bx + c պարաբոլայի սիմետրիայի առանցքի բանաձևն ո՞րն է։",
        options: ["x = -b/2a", "x = b/2a", "x = -2a/b", "x = 2a/b"],
        correctIndex: 0,
        explanation: "Սիմետրիայի առանցքը հաշվարկվում է x = -b/(2a) բանաձևով։",
      },
    ],
  },
  {
    orderIndex: 7,
    type: "lesson",
    title: "Ֆունկցիաներ և գրաֆիկներ",
    description: "Ֆունկցիայի հասկացությունը, տիրույթ, արժեքների բազմություն և գրաֆիկի կառուցում։",
    estimatedMinutes: 40,
  },
  {
    orderIndex: 8,
    type: "assignment",
    title: "Ամփոփիչ առաջադրանք",
    description: "Ամբողջ նյութն ընդգրկող վերջնական աշխատանք։ Վերբեռնիր քո լուծումը։",
    estimatedMinutes: 60,
    maxAttempts: null,
  },
];

// Not the focus of this prompt (only the "exam" track's content was specified
// in detail) — kept short but non-empty so the depth-track template is still a
// usable roadmap rather than a dead end with zero steps.
const DEPTH_STEPS: StepSeed[] = [
  {
    orderIndex: 1,
    type: "lesson",
    title: "Հանրահաշվի խորացված ներածություն",
    description: "Ավելի խորը նայում ենք արտահայտությունների կառուցվածքին և ապացուցման տրամաբանությանը։",
    estimatedMinutes: 35,
  },
  {
    orderIndex: 2,
    type: "quiz",
    title: "Թեստ․ Ապացուցողական մտածողություն",
    description: "Ստուգիր հիմնական հասկացությունների ըմբռնումը։",
    estimatedMinutes: 15,
    questions: [
      {
        orderIndex: 1,
        text: "Ո՞րն է նույնության (identity) օրինակ։",
        options: ["x + 1 = 2", "(x+1)² = x² + 2x + 1", "x² = 4", "2x = 6"],
        correctIndex: 1,
        explanation: "Նույնությունը ճշմարիտ է x-ի ցանկացած արժեքի համար։",
      },
      {
        orderIndex: 2,
        text: "Ինչպե՞ս ապացուցել, որ երկու արտահայտություն համարժեք են։",
        options: [
          "Փոխարինել մեկ արժեք և տեսնել՝ համընկնո՞ւմ է",
          "Պարզեցնել երկուսն էլ և համեմատել",
          "Չափել գրաֆիկով",
          "Ենթադրել՝ առանց ստուգման",
        ],
        correctIndex: 1,
        explanation: "Համարժեքությունը ապացուցվում է հանրահաշվական պարզեցմամբ, ոչ թե մեկ արժեքով ստուգմամբ։",
      },
      {
        orderIndex: 3,
        text: "Ո՞ր պնդումն է միշտ ճշմարիտ։",
        options: ["a - b = b - a", "a² ≥ 0", "1/a > 0", "a·0 = a"],
        correctIndex: 1,
        explanation: "Ցանկացած իրական թվի քառակուսին ոչ բացասական է։",
      },
    ],
  },
  {
    orderIndex: 3,
    type: "lesson",
    title: "Ֆունկցիաների խորացված հատկություններ",
    description: "Մոնոտոնություն, զույգ/կենտ ֆունկցիաներ, կոմպոզիցիա։",
    estimatedMinutes: 45,
  },
  {
    orderIndex: 4,
    type: "assignment",
    title: "Հետազոտական աշխատանք",
    description: "Ընտրիր մեկ ֆունկցիա և վերլուծիր դրա հատկությունները՝ ըստ դասին տրված ցուցումների։",
    estimatedMinutes: 60,
    maxAttempts: null,
  },
];

async function main() {
  const { teacher } = await seedUsers();
  const { math } = await seedSubjects();
  // Ֆիզիկա exists as a subject but has no templates yet — nothing in this
  // prompt asked for physics content.

  const examTemplate = await upsertTemplate({
    subjectId: math.id,
    track: "exam",
    title: "Մաթեմատիկա · Քննության պատրաստություն",
    description: "Ուղի՝ կենտրոնացած քննության հանձնման վրա։ Ընդգրկում է հանրահաշվի հիմունքները մինչև ֆունկցիաներ։",
    authorId: teacher.id,
  });
  await upsertSteps(examTemplate.id, EXAM_STEPS);

  const depthTemplate = await upsertTemplate({
    subjectId: math.id,
    track: "depth",
    title: "Մաթեմատիկա · Խորացված ուսուցում",
    description: "Ուղի՝ կենտրոնացած նյութի խորը ըմբռնման վրա, ապացուցողական մտածողությամբ։",
    authorId: teacher.id,
  });
  await upsertSteps(depthTemplate.id, DEPTH_STEPS);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
