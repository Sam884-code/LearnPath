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
import { toast } from "sonner";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type T = ReturnType<typeof useTranslations>;

// Native <select> styled to match shadcn Input.
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const [template, setTemplate] = useState<ApiTemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setBusy(true);
    try {
      await teacherPublishTemplate(id);
      toast.success(t("teacher.publishedOk"));
      await reload();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeacherShell>
      <Link href="/teacher/templates" className="text-sm text-muted-foreground">
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
              <h1 className="text-xl font-bold text-foreground">{template.title}</h1>
              <p className="text-xs text-muted-foreground">
                {template.subject.title} · {t(template.track === "exam" ? "teacher.trackExam" : "teacher.trackDepth")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={template.isPublished ? "success" : "secondary"}>
                {template.isPublished ? t("teacher.published") : t("teacher.draft")}
              </Badge>
              {!template.isPublished && (
                <Button onClick={publish} disabled={busy}>
                  {busy ? t("teacher.publishing") : t("teacher.publish")}
                </Button>
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
    <Card className="gap-0 rounded-2xl p-4">
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
          <Button variant="outline" size="icon" className="size-7" onClick={() => onMove(index, -1)} disabled={busy || index === 0}>
            ↑
          </Button>
          <Button variant="outline" size="icon" className="size-7" onClick={() => onMove(index, 1)} disabled={busy || index === total - 1}>
            ↓
          </Button>
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
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setShowQuestions(true)}>
              + {t("teacher.addQuestion")}
            </Button>
          )}
        </div>
      )}
    </Card>
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
      <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
        + {t("teacher.addStep")}
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
      <div className="text-sm sm:col-span-2">
        <Label className="mb-1 text-muted-foreground">{t("teacher.stepTitle")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="text-sm">
        <Label className="mb-1 text-muted-foreground">{t("teacher.stepType")}</Label>
        <select value={type} onChange={(e) => setType(e.target.value as StepType)} className={SELECT_CLASS}>
          <option value="lesson">{t("stepType.lesson")}</option>
          <option value="quiz">{t("stepType.quiz")}</option>
          <option value="assignment">{t("stepType.assignment")}</option>
        </select>
      </div>
      <div className="text-sm">
        <Label className="mb-1 text-muted-foreground">{t("teacher.estimatedMinutes")}</Label>
        <Input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          required
        />
      </div>
      <div className="text-sm sm:col-span-2">
        <Label className="mb-1 text-muted-foreground">{t("teacher.stepDescription")}</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("teacher.saving") : t("teacher.save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {t("teacher.cancel")}
        </Button>
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
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
        placeholder={t("teacher.questionText")}
      />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct"
            checked={correct === i}
            onChange={() => setCorrect(i)}
            aria-label={t("teacher.correctAnswer")}
            className="accent-[var(--accent)]"
          />
          <Input
            value={opt}
            onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
            required
            placeholder={t("teacher.option", { n: i + 1 })}
            className="flex-1"
          />
        </div>
      ))}
      {options.length < 6 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto self-start p-0"
          onClick={() => setOptions((o) => [...o, ""])}
        >
          + {t("teacher.addOption")}
        </Button>
      )}
      <Textarea
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        required
        rows={2}
        placeholder={t("teacher.explanation")}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? t("teacher.saving") : t("teacher.save")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("teacher.cancel")}
        </Button>
      </div>
    </form>
  );
}
