-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'teacher');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('hy', 'en');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('exam', 'depth');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('lesson', 'quiz', 'assignment');

-- CreateEnum
CREATE TYPE "Pace" AS ENUM ('light', 'normal', 'intense');

-- CreateEnum
CREATE TYPE "UserStepStatus" AS ENUM ('locked', 'active', 'done');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "locale" "Locale" NOT NULL DEFAULT 'hy',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_templates" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "subject_id" UUID NOT NULL,
    "track" "Track" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roadmap_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_steps" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "template_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "StepType" NOT NULL,
    "pass_score" INTEGER NOT NULL DEFAULT 60,
    "max_attempts" INTEGER DEFAULT 3,
    "estimated_minutes" INTEGER NOT NULL,

    CONSTRAINT "template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_materials" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "template_step_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "uploaded_by" UUID NOT NULL,

    CONSTRAINT "step_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "template_step_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_index" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "track" "Track" NOT NULL,
    "pace" "Pace" NOT NULL,
    "wants_mentor_qa" BOOLEAN NOT NULL,
    "raw_answers" JSONB NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_steps" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "template_step_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" "UserStepStatus" NOT NULL DEFAULT 'locked',
    "score" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "due_date" DATE,
    "activated_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "user_step_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "grade" INTEGER,
    "feedback" TEXT,
    "graded_by" UUID,
    "graded_at" TIMESTAMPTZ(6),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "user_step_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_questions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_step_id" UUID,
    "body" TEXT NOT NULL,
    "answer" TEXT,
    "answered_by" UUID,
    "answered_at" TIMESTAMPTZ(6),

    CONSTRAINT "mentor_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE INDEX "roadmap_templates_subject_id_track_idx" ON "roadmap_templates"("subject_id", "track");

-- CreateIndex
CREATE UNIQUE INDEX "template_steps_template_id_order_index_key" ON "template_steps"("template_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "questions_template_step_id_order_index_key" ON "questions"("template_step_id", "order_index");

-- CreateIndex
CREATE INDEX "enrollments_user_id_subject_id_idx" ON "enrollments"("user_id", "subject_id");

-- CreateIndex
CREATE INDEX "user_steps_enrollment_id_order_index_idx" ON "user_steps"("enrollment_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "user_steps_enrollment_id_template_step_id_key" ON "user_steps"("enrollment_id", "template_step_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_user_step_id_attempt_number_key" ON "quiz_attempts"("user_step_id", "attempt_number");

-- AddForeignKey
ALTER TABLE "roadmap_templates" ADD CONSTRAINT "roadmap_templates_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_templates" ADD CONSTRAINT "roadmap_templates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_steps" ADD CONSTRAINT "template_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "roadmap_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_materials" ADD CONSTRAINT "step_materials_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_materials" ADD CONSTRAINT "step_materials_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "template_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "roadmap_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_steps" ADD CONSTRAINT "user_steps_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_steps" ADD CONSTRAINT "user_steps_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "template_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_step_id_fkey" FOREIGN KEY ("user_step_id") REFERENCES "user_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_step_id_fkey" FOREIGN KEY ("user_step_id") REFERENCES "user_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_questions" ADD CONSTRAINT "mentor_questions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_questions" ADD CONSTRAINT "mentor_questions_user_step_id_fkey" FOREIGN KEY ("user_step_id") REFERENCES "user_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_questions" ADD CONSTRAINT "mentor_questions_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Partial unique indexes: Prisma's schema DSL cannot express a WHERE clause on
-- a unique index, so these three constraints from SPEC.md are hand-written here.

-- SPEC.md §2.3: one published template per (subject, track). Multiple drafts
-- for the same subject+track may still coexist; only publishing is exclusive.
CREATE UNIQUE INDEX "roadmap_templates_subject_id_track_published_key"
    ON "roadmap_templates" ("subject_id", "track")
    WHERE "is_published" = true;

-- SPEC.md §2.7: a student can't have two live (uncompleted) enrollments in the
-- same subject at once.
CREATE UNIQUE INDEX "enrollments_user_id_subject_id_live_key"
    ON "enrollments" ("user_id", "subject_id")
    WHERE "completed_at" IS NULL;

-- SPEC.md §2.8 (the critical one): at most one active step per enrollment.
-- This makes the core "single active step" product rule impossible to violate
-- at the database level, even under concurrent advanceStep() calls.
CREATE UNIQUE INDEX "user_steps_enrollment_id_active_key"
    ON "user_steps" ("enrollment_id")
    WHERE "status" = 'active';
