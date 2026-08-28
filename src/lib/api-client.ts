import type { ErrorCode } from "./errors";

// Thrown by every client-side API call. Carries the machine-readable `code`
// from SPEC.md §5.1's error envelope so UI can map it to an Armenian string
// (see src/lib/errorMessages.ts) rather than showing a raw English message.
export class ClientApiError extends Error {
  code: ErrorCode | "INTERNAL_ERROR" | "NETWORK_ERROR";
  status: number;

  constructor(code: ClientApiError["code"], message: string, status: number) {
    super(message);
    this.name = "ClientApiError";
    this.code = code;
    this.status = status;
  }
}

const BASE = "/api/v1";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      // Same-origin, so the httpOnly auth cookie is sent automatically.
      credentials: "same-origin",
      ...init,
    });
  } catch {
    throw new ClientApiError("NETWORK_ERROR", "Network request failed", 0);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // No JSON body (shouldn't happen for our API, but guard anyway).
  }

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ClientApiError(
      (err?.code as ClientApiError["code"]) ?? "INTERNAL_ERROR",
      err?.message ?? "Request failed",
      res.status
    );
  }

  return body as T;
}

// ---- Typed shapes returned by the API (only the fields the UI consumes) ----

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher";
  locale: "hy" | "en";
};

export type ApiEnrollmentSummary = {
  id: string;
  subjectId: string;
  templateId: string;
  track: "exam" | "depth";
  pace: "light" | "normal" | "intense";
  wantsMentorQa: boolean;
  startedAt: string;
  completedAt: string | null;
};

export type ApiSubject = { id: string; title: string; slug: string; icon: string | null };

export type ApiActiveStep = {
  id: string;
  title: string;
  type: "lesson" | "quiz" | "assignment";
  order_index: number;
  due_date: string | null;
};

export type CreateEnrollmentResponse = {
  enrollment: {
    id: string;
    subject: ApiSubject;
    track: string;
    pace: string;
    started_at: string;
    total_steps: number;
  };
  active_step: ApiActiveStep;
};

// ---- Endpoint helpers ----

export function register(input: {
  name: string;
  email: string;
  password: string;
  role?: "student" | "teacher";
  invite_code?: string;
}) {
  return apiFetch<{ token: string; user: ApiUser }>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }) {
  return apiFetch<{ token: string; user: ApiUser }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getMe() {
  return apiFetch<{ user: ApiUser; enrollments: ApiEnrollmentSummary[] }>("/me");
}

export function logout() {
  return apiFetch<{ ok: true }>("/auth/logout", { method: "POST" });
}

export function getSubjects() {
  return apiFetch<{ subjects: ApiSubject[] }>("/subjects");
}

export function createEnrollment(input: {
  subject_id: string;
  track: "exam" | "depth";
  daily_hours: "lt1" | "1to2" | "gt3";
  wants_mentor_qa: boolean;
}) {
  return apiFetch<CreateEnrollmentResponse>("/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type ApiRoadmapStep = {
  id: string;
  order_index: number;
  title: string;
  type: "lesson" | "quiz" | "assignment";
  status: "locked" | "active" | "done";
  score: number | null;
  attempts: number;
  max_attempts: number | null;
  due_date: string | null;
  overdue: boolean;
  awaiting_review: boolean;
};

export type ApiRoadmap = {
  enrollment: {
    id: string;
    subject: ApiSubject;
    track: string;
    pace: string;
    completed_at: string | null;
  };
  progress: { done: number; total: number; percent: number; active_step_id: string | null };
  steps: ApiRoadmapStep[];
};

export function getRoadmap(enrollmentId: string) {
  return apiFetch<ApiRoadmap>(`/enrollments/${enrollmentId}/roadmap`);
}

// ---- Step detail (§5.4/§5.5/§5.6) ----

export type StepType = "lesson" | "quiz" | "assignment";
export type StepStatus = "locked" | "active" | "done";

export type ApiMaterial = { id: string; file_name: string; size_bytes: number; download_url: string };
export type ApiSubmission = {
  id: string;
  file_name: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
};

export type ApiStepDetail = {
  id: string;
  enrollment_id: string;
  wants_mentor_qa: boolean;
  title: string;
  description: string;
  type: StepType;
  status: StepStatus;
  order_index: number;
  pass_score: number;
  attempts: number;
  max_attempts: number | null;
  due_date: string | null;
  overdue: boolean;
  materials: ApiMaterial[];
  submission: ApiSubmission | null;
};

export type ApiStepSummary = {
  id: string;
  order_index: number;
  title: string;
  type: StepType;
  status: StepStatus;
  score: number | null;
  attempts: number;
  due_date: string | null;
};

export type CompletionResult = {
  step: ApiStepSummary;
  next_step: ApiStepSummary | null;
  enrollment_finished: boolean;
};

export function getStep(stepId: string) {
  return apiFetch<ApiStepDetail>(`/steps/${stepId}`);
}

export function viewLesson(stepId: string) {
  return apiFetch<CompletionResult>(`/steps/${stepId}/view`, { method: "POST" });
}

export type ApiQuizQuestion = { id: string; order_index: number; text: string; options: string[] };
export type ApiQuiz = {
  questions: ApiQuizQuestion[];
  pass_score: number;
  attempts: number;
  max_attempts: number | null;
};

export function getQuiz(stepId: string) {
  return apiFetch<ApiQuiz>(`/steps/${stepId}/quiz`);
}

export type ApiQuizResultItem = {
  question_id: string;
  correct: boolean;
  correct_index: number;
  explanation: string;
};
export type SubmitQuizResult = {
  score: number;
  passed: boolean;
  attempts: number;
  attempts_left: number | null;
  results: ApiQuizResultItem[];
  next_step: ApiStepSummary | null;
  enrollment_finished: boolean;
};

export function submitQuiz(stepId: string, answers: { question_id: string; chosen_index: number }[]) {
  return apiFetch<SubmitQuizResult>(`/steps/${stepId}/quiz/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

export type SubmitAssignmentResult = { submission: ApiSubmission; step: ApiStepSummary };

// Uses XMLHttpRequest (not fetch) so we can report real upload progress.
// Maps the same { error: { code } } envelope to a ClientApiError.
export function submitAssignment(
  stepId: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<SubmitAssignmentResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/steps/${stepId}/submissions`);
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as SubmitAssignmentResult);
      } else {
        const err = (body as { error?: { code?: string; message?: string } })?.error;
        reject(
          new ClientApiError(
            (err?.code as ClientApiError["code"]) ?? "INTERNAL_ERROR",
            err?.message ?? "Upload failed",
            xhr.status
          )
        );
      }
    };
    xhr.onerror = () => reject(new ClientApiError("NETWORK_ERROR", "Upload failed", 0));
    xhr.send(form);
  });
}

export function deleteSubmission(submissionId: string) {
  return apiFetch<void>(`/submissions/${submissionId}`, { method: "DELETE" });
}

export function askMentorQuestion(enrollmentId: string, body: string, userStepId?: string) {
  return apiFetch<{ question: { id: string; body: string; answer: string | null } }>(
    `/enrollments/${enrollmentId}/questions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, user_step_id: userStepId }),
    }
  );
}

// ---- Teacher (§5.8) ----

export type ApiTemplateSummary = {
  id: string;
  title: string;
  description: string;
  track: "exam" | "depth";
  isPublished: boolean;
  subject: ApiSubject;
  steps: { id: string; type: StepType }[];
};

export type ApiTemplateQuestion = {
  id: string;
  orderIndex: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type ApiTemplateStep = {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  type: StepType;
  passScore: number;
  maxAttempts: number | null;
  estimatedMinutes: number;
  questions: ApiTemplateQuestion[];
  materials: { id: string; fileName: string; sizeBytes: number }[];
};

export type ApiTemplateDetail = {
  id: string;
  subjectId: string;
  track: "exam" | "depth";
  title: string;
  description: string;
  isPublished: boolean;
  subject: ApiSubject;
  steps: ApiTemplateStep[];
};

export function teacherListTemplates() {
  return apiFetch<{ templates: ApiTemplateSummary[] }>("/teacher/templates");
}

export function teacherGetTemplate(id: string) {
  return apiFetch<{ template: ApiTemplateDetail }>(`/teacher/templates/${id}`);
}

export function teacherCreateTemplate(input: {
  subject_id: string;
  track: "exam" | "depth";
  title: string;
  description: string;
}) {
  return apiFetch<{ template: { id: string } }>("/teacher/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function teacherPublishTemplate(id: string) {
  return apiFetch<{ template: { id: string; isPublished: boolean } }>(`/teacher/templates/${id}/publish`, {
    method: "POST",
  });
}

export function teacherAddStep(
  templateId: string,
  input: {
    order_index: number;
    title: string;
    description: string;
    type: StepType;
    pass_score?: number;
    max_attempts?: number | null;
    estimated_minutes: number;
  }
) {
  return apiFetch<{ step: { id: string } }>(`/teacher/templates/${templateId}/steps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function teacherReorderSteps(templateId: string, stepIds: string[]) {
  return apiFetch<{ template: ApiTemplateDetail }>(`/teacher/templates/${templateId}/reorder-steps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step_ids: stepIds }),
  });
}

export function teacherAddQuestion(
  stepId: string,
  input: { text: string; options: string[]; correct_index: number; explanation: string }
) {
  return apiFetch<{ question: { id: string } }>(`/teacher/steps/${stepId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type ApiPendingSubmission = {
  id: string;
  file_name: string;
  submitted_at: string;
  student: { id: string; name: string };
  step: { id: string; title: string };
};

export function teacherListSubmissions() {
  return apiFetch<{ submissions: ApiPendingSubmission[] }>("/teacher/submissions");
}

export function teacherGradeSubmission(id: string, grade: number, feedback: string) {
  return apiFetch<{ submission: { id: string; grade: number | null }; advanced: boolean }>(
    `/teacher/submissions/${id}/grade`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade, feedback }),
    }
  );
}

export type ApiStuckStudent = {
  enrollment_id: string;
  student: { id: string; name: string; email: string };
  subject: { id: string; title: string };
  step: { id: string; title: string; attempts: number; max_attempts: number | null };
};

export function teacherListStuck() {
  return apiFetch<{ students: ApiStuckStudent[] }>("/teacher/students/stuck");
}

export function teacherResetAttempts(userStepId: string) {
  return apiFetch<{ step: { id: string; attempts: number } }>(
    `/teacher/user-steps/${userStepId}/reset-attempts`,
    { method: "POST" }
  );
}

export type ApiTeacherQuestion = {
  id: string;
  body: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  student: { id: string; name: string };
  subject: { id: string; title: string };
  step: { id: string; title: string } | null;
};

export function teacherListQuestions(status: "unanswered" | "all" = "unanswered") {
  return apiFetch<{ questions: ApiTeacherQuestion[] }>(`/teacher/questions?status=${status}`);
}

export function teacherAnswerQuestion(id: string, answer: string) {
  return apiFetch<{ question: ApiTeacherQuestion }>(`/teacher/questions/${id}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
}

// ---- Classroom (link students to a teacher) ----

export type ApiClassroomMember = { id: string; name: string; email: string; joined_at: string };
export type ApiClassroom = { id: string; name: string; join_code: string; members: ApiClassroomMember[] };
export type ApiStudentClassroom = {
  id: string;
  name: string;
  teacher: { id: string; name: string };
  joined_at: string;
};

// Teacher: fetch (lazily create) their class + join code + members.
export function teacherGetClassroom() {
  return apiFetch<{ classroom: ApiClassroom }>("/teacher/classroom");
}

// Teacher: rotate the join code.
export function teacherRegenerateJoinCode() {
  return apiFetch<{ classroom: ApiClassroom }>("/teacher/classroom/regenerate", { method: "POST" });
}

// Student: join a class by code.
export function joinClassroom(code: string) {
  return apiFetch<{ classroom: { id: string; name: string }; teacher: { id: string; name: string } }>(
    "/classroom/join",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }
  );
}

// Student: the classes they've joined.
export function getMyClassrooms() {
  return apiFetch<{ classrooms: ApiStudentClassroom[] }>("/classroom/mine");
}

// ---- AI Knowledge Base (§14) ----

export type ApiTextbook = {
  id: string;
  title: string;
  subject: { id: string; title: string };
  grade_level: number | null;
  file_name: string;
  page_count: number | null;
  status: "uploaded" | "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
  created_at: string;
};

export function teacherListTextbooks() {
  return apiFetch<{ textbooks: ApiTextbook[] }>("/teacher/textbooks");
}

// Multipart upload — do NOT set Content-Type; the browser adds the boundary.
export function teacherUploadTextbook(input: {
  file: File;
  subjectId: string;
  title?: string;
  gradeLevel?: number | null;
}) {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("subject_id", input.subjectId);
  if (input.title) fd.append("title", input.title);
  if (input.gradeLevel != null) fd.append("grade_level", String(input.gradeLevel));
  return apiFetch<{ textbook: { id: string; status: string } }>("/teacher/textbooks", {
    method: "POST",
    body: fd,
  });
}

export function teacherDeleteTextbook(id: string) {
  return apiFetch<void>(`/teacher/textbooks/${id}`, { method: "DELETE" });
}

export type ApiGenerationStatus = {
  status: "pending" | "processing" | "ready" | "failed";
  template_id: string | null;
  step_count: number | null;
  error: string | null;
};

// Starts a background generation; returns the id to poll with teacherGetGeneration.
export function teacherGenerateRoadmap(input: {
  subjectId: string;
  gradeLevel?: number | null;
  track: "exam" | "depth";
}) {
  return apiFetch<{ generationId: string }>("/teacher/roadmaps/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject_id: input.subjectId, grade_level: input.gradeLevel ?? null, track: input.track }),
  });
}

export function teacherGetGeneration(id: string) {
  return apiFetch<ApiGenerationStatus>(`/teacher/roadmaps/generations/${id}`);
}
