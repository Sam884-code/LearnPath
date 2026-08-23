-- CreateIndex
CREATE INDEX "step_materials_template_step_id_idx" ON "step_materials"("template_step_id");

-- CreateIndex
CREATE INDEX "submissions_user_step_id_idx" ON "submissions"("user_step_id");

-- CreateIndex
CREATE INDEX "mentor_questions_enrollment_id_idx" ON "mentor_questions"("enrollment_id");

