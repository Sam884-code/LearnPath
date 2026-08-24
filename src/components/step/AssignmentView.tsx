"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { submitAssignment, type ApiStepDetail, type ApiSubmission } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { ErrorBanner } from "@/components/ui";
import { MaterialsList, StepHeader } from "./shared";
import ReactMarkdown from "react-markdown";

type T = ReturnType<typeof useTranslations>;

const MAX_BYTES = 10 * 1024 * 1024;
// Mirrors the server-side allowlist (SPEC.md §5.6). The server re-validates by
// sniffing content — this is only a fast pre-check to catch obvious mistakes.
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "doc", "docx", "txt"];
const ACCEPT = [".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt", ...ALLOWED_MIME].join(",");

export function AssignmentView({
  step,
  onComplete,
}: {
  step: ApiStepDetail;
  onComplete: (r: { nextStepUnlocked: boolean; enrollmentFinished: boolean }) => void;
}) {
  const t = useTranslations();
  const [submission, setSubmission] = useState<ApiSubmission | null>(step.submission);

  const graded = submission && submission.grade !== null;
  const belowPass = graded && submission!.grade! < step.pass_score;

  let mode: "done" | "awaiting" | "below" | "upload";
  if (step.status === "done") mode = "done";
  else if (submission && submission.grade === null) mode = "awaiting";
  else if (belowPass) mode = "below";
  else mode = "upload";

  return (
    <>
      <StepHeader t={t} orderIndex={step.order_index} type="assignment" title={step.title} overdue={step.overdue} />

      <article
        className="markdown-body rounded-2xl border p-5 leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
      >
        <ReactMarkdown>{step.description}</ReactMarkdown>
      </article>

      <MaterialsList t={t} materials={step.materials} />

      {mode === "done" && (
        <GradedCard t={t} submission={submission} passScore={step.pass_score} passed />
      )}

      {mode === "awaiting" && (
        <div className="mt-6 rounded-2xl p-5" style={{ background: "var(--surface-muted)" }}>
          <p className="font-semibold" style={{ color: "var(--text)" }}>
            {t("assignment.awaitingReview")}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {t("assignment.awaitingReviewBody")}
          </p>
        </div>
      )}

      {mode === "below" && (
        <>
          <GradedCard t={t} submission={submission} passScore={step.pass_score} passed={false} />
          <UploadForm t={t} step={step} onUploaded={setSubmission} onComplete={onComplete} />
        </>
      )}

      {mode === "upload" && (
        <UploadForm t={t} step={step} onUploaded={setSubmission} onComplete={onComplete} />
      )}
    </>
  );
}

function GradedCard({
  t,
  submission,
  passScore,
  passed,
}: {
  t: T;
  submission: ApiSubmission | null;
  passScore: number;
  passed: boolean;
}) {
  if (!submission || submission.grade === null) return null;
  return (
    <div
      className="mt-6 rounded-2xl p-5"
      style={{ background: passed ? "var(--success-soft)" : "var(--danger-soft)" }}
    >
      <p className="text-lg font-bold" style={{ color: passed ? "var(--success-text)" : "var(--danger)" }}>
        {t("assignment.gradeLabel", { score: submission.grade })}
      </p>
      {submission.feedback && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {t("assignment.feedbackLabel")}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            {submission.feedback}
          </p>
        </div>
      )}
      {!passed && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {t("assignment.belowPass", { score: passScore })}
        </p>
      )}
    </div>
  );
}

function UploadForm({
  t,
  step,
  onUploaded,
  onComplete,
}: {
  t: T;
  step: ApiStepDetail;
  onUploaded: (s: ApiSubmission) => void;
  onComplete: (r: { nextStepUnlocked: boolean; enrollmentFinished: boolean }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function pick(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(t("assignment.errFileTooLarge"));
      setFile(null);
      return;
    }
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_MIME.has(f.type) && !ALLOWED_EXT.includes(ext)) {
      setError(t("assignment.errBadType"));
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const res = await submitAssignment(step.id, file, setProgress);
      if (res.step.status === "done") {
        // pass_score === 0: advanced immediately.
        onComplete({ nextStepUnlocked: true, enrollmentFinished: false });
      } else {
        onUploaded(res.submission);
      }
    } catch (err) {
      setError(errorMessage(t, err));
      setUploading(false);
    }
  }

  return (
    <div className="mt-6">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      <button
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-8 text-center"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <span className="text-2xl" aria-hidden>
          📎
        </span>
        <span className="text-sm font-medium" style={{ color: file ? "var(--text)" : "var(--text-muted)" }}>
          {file ? file.name : t("assignment.chooseFile")}
        </span>
        <span className="text-xs">{t("assignment.allowedHint")}</span>
      </button>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {uploading && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-muted)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round(progress * 100)}%`, background: "var(--accent)" }}
          />
        </div>
      )}

      <button
        onClick={upload}
        disabled={!file || uploading}
        className="mt-4 w-full rounded-2xl px-5 py-4 text-base font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--accent)" }}
      >
        {uploading ? t("assignment.uploading") : step.submission ? t("assignment.reupload") : t("assignment.upload")}
      </button>
    </div>
  );
}
