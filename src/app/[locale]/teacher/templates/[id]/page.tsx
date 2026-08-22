"use client";

import { FormEvent, use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  teacherAddQuestion,
  teacherAddStep,
  teacherGetTemplate,
  teacherPublishTemplate,
  teacherReorderSteps,
  type ApiTemplateDetail,
  type ApiTemplateStep,
  type StepType,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";

type T = ReturnType<typeof useTranslations>;

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const [template, setTemplate] = useState<ApiTemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      const res = await teacherGetTemplate(id);
      setTemplate(res.template);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function move(index: number, dir: -1 | 1) {
    if (!template) return;
    const ids = template.steps.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setBusy(true);
    try {
      const res = await teacherReorderSteps(id, ids);
      setTemplate(res.template);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await teacherPublishTemplate(id);
      setNotice(t("teacher.publishedOk"));
      await reload();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell>
      <Link href="/teacher/templates" className="text-sm" style={{ color: "var(--text-muted)" }}>
        ← {t("teacher.back")}
      </Link>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!template ? (
        <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.loading")}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
                {template.title}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {template.subject.title} · {t(template.track === "exam" ? "teacher.trackExam" : "teacher.trackDepth")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {notice && (
                <span className="text-sm" style={{ color: "var(--accent-text)" }}>
                  {notice}
                </span>
              )}
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: template.isPublished ? "var(--accent-soft)" : "var(--surface-muted)",
                  color: template.isPublished ? "var(--accent-text)" : "var(--text-muted)",
                }}
              >
                {template.isPublished ? t("teacher.published") : t("teacher.draft")}
              </span>
              {!template.isPublished && (
                <button
                  onClick={publish}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--accent)" }}
                >
                  {busy ? t("teacher.publishing") : t("teacher.publish")}
                </button>
              )}
            </div>
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {t("teacher.steps")}
          </h2>
          <ol className="flex flex-col gap-3">
            {template.steps.map((step, i) => (
              <li key={step.id}>
                <StepCard
                  t={t}
                  step={step}
                  index={i}
                  total={template.steps.length}
                  busy={busy}
                  onMove={move}
                  onChanged={reload}
                  onError={setError}
                />
              </li>
            ))}
          </ol>

          <AddStepForm t={t} templateId={id} nextIndex={template.steps.length + 1} onAdded={reload} onError={setError} />
        </>
      )}
    </TeacherShell>
  );
}

function StepCard({
  t,
  step,
  index,
  total,
  busy,
  onMove,
  onChanged,
  onError,
}: {
  t: T;
  step: ApiTemplateStep;
  index: number;
  total: number;
  busy: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const [showQuestions, setShowQuestions] = useState(false);
  const typeIcon = step.type === "lesson" ? "📖" : step.type === "quiz" ? "📝" : "📤";

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: "var(--surface-muted)", color: "var(--text-muted)" }}
        >
          {step.orderIndex}
        </span>
        <span className="text-lg" aria-hidden>
          {typeIcon}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
            {step.title}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t(`stepType.${step.type}`)}
            {step.type === "quiz" && ` · ${t("teacher.questionsCount", { n: step.questions.length })}`}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove(index, -1)}
            disabled={busy || index === 0}
            className="rounded border px-2 py-1 text-xs disabled:opacity-30"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            ↑
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={busy || index === total - 1}
            className="rounded border px-2 py-1 text-xs disabled:opacity-30"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            ↓
          </button>
        </div>
      </div>

      {step.type === "quiz" && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {step.questions.length === 0 && (
            <p className="mb-2 text-xs" style={{ color: "var(--danger)" }}>
              {t("teacher.quizNeedsQuestion")}
            </p>
          )}
          <ol className="mb-2 flex flex-col gap-1">
            {step.questions.map((q) => (
              <li key={q.id} className="text-xs" style={{ color: "var(--text)" }}>
                {q.orderIndex}. {q.text}{" "}
                <span style={{ color: "var(--accent-text)" }}>({q.options[q.correctIndex]})</span>
              </li>
            ))}
          </ol>
          {showQuestions ? (
            <AddQuestionForm
              t={t}
              stepId={step.id}
              onAdded={() => {
                setShowQuestions(false);
                onChanged();
              }}
              onCancel={() => setShowQuestions(false)}
              onError={onError}
            />
          ) : (
            <button
              onClick={() => setShowQuestions(true)}
              className="text-xs font-semibold"
              style={{ color: "var(--accent-text)" }}
            >
              + {t("teacher.addQuestion")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddStepForm({
  t,
  templateId,
  nextIndex,
  onAdded,
  onError,
}: {
  t: T;
  templateId: string;
  nextIndex: number;
  onAdded: () => void;
  onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<StepType>("lesson");
  const [minutes, setMinutes] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await teacherAddStep(templateId, {
        order_index: nextIndex,
        title,
        description,
        type,
        estimated_minutes: minutes,
      });
      setTitle("");
      setDescription("");
      setType("lesson");
      setMinutes(30);
      setOpen(false);
      onAdded();
    } catch (err) {
      onError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold"
        style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
      >
        + {t("teacher.addStep")}
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.stepTitle")}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.stepType")}
        </span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as StepType)}
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="lesson">{t("stepType.lesson")}</option>
          <option value="quiz">{t("stepType.quiz")}</option>
          <option value="assignment">{t("stepType.assignment")}</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.estimatedMinutes")}
        </span>
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.stepDescription")}
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {submitting ? t("teacher.saving") : t("teacher.save")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border px-4 py-2 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {t("teacher.cancel")}
        </button>
      </div>
    </form>
  );
}

function AddQuestionForm({
  t,
  stepId,
  onAdded,
  onCancel,
  onError,
}: {
  t: T;
  stepId: string;
  onAdded: () => void;
  onCancel: () => void;
  onError: (m: string) => void;
}) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const filled = options.map((o) => o.trim());
    if (filled.some((o) => o.length === 0)) return;
    setSubmitting(true);
    try {
      await teacherAddQuestion(stepId, { text, options: filled, correct_index: correct, explanation });
      onAdded();
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-2 flex flex-col gap-2 rounded border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        placeholder={t("teacher.questionText")}
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct"
            checked={correct === i}
            onChange={() => setCorrect(i)}
            aria-label={t("teacher.correctAnswer")}
          />
          <input
            value={opt}
            onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
            required
            placeholder={t("teacher.option", { n: i + 1 })}
            className="flex-1 rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
        </div>
      ))}
      {options.length < 6 && (
        <button
          type="button"
          onClick={() => setOptions((o) => [...o, ""])}
          className="self-start text-xs font-semibold"
          style={{ color: "var(--accent-text)" }}
        >
          + {t("teacher.addOption")}
        </button>
      )}
      <textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        required
        rows={2}
        placeholder={t("teacher.explanation")}
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {submitting ? t("teacher.saving") : t("teacher.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {t("teacher.cancel")}
        </button>
      </div>
    </form>
  );
}
