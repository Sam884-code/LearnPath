-- CreateTable
CREATE TABLE "classrooms" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "teacher_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_memberships" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classroom_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,

    CONSTRAINT "classroom_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_teacher_id_key" ON "classrooms"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_join_code_key" ON "classrooms"("join_code");

-- CreateIndex
CREATE INDEX "classroom_memberships_student_id_idx" ON "classroom_memberships"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_memberships_classroom_id_student_id_key" ON "classroom_memberships"("classroom_id", "student_id");

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_memberships" ADD CONSTRAINT "classroom_memberships_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_memberships" ADD CONSTRAINT "classroom_memberships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
