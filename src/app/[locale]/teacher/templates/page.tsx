"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getSubjects,
  teacherCreateTemplate,
  teacherListTemplates,
  type ApiSubject,
  type ApiTemplateSummary,
} from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ErrorBanner } from "@/components/ui";

export default function TeacherTemplatesPage() {
  const t = useTranslations();
  const router = useRouter();
  const [templates, setTemplates] = useState<ApiTemplateSummary[] | null>(null);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const [tpl, subj] = await Promise.all([teacherListTemplates(), getSubjects()]);
      setTemplates(tpl.templates);
      setSubjects(subj.subjects);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TeacherShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          {t("teacher.templatesTitle")}
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          {t("teacher.newTemplate")}
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <CreateTemplateForm
          t={t}
          subjects={subjects}
          onCreated={(id) => router.push(`/teacher/templates/${id}`)}
          onError={setError}
        />
      )}

      {templates === null ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.loading")}
        </p>
      ) : templates.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("teacher.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((tpl) => (
            <li key={tpl.id}>
              <Link
                href={`/teacher/templates/${tpl.id}`}
                className="flex items-center gap-4 rounded-lg border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <span className="flex-1">
                  <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {tpl.title}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {tpl.subject.title} · {t(tpl.track === "exam" ? "teacher.trackExam" : "teacher.trackDepth")} ·{" "}
                    {t("teacher.stepsCount", { n: tpl.steps.length })}
                  </span>
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    background: tpl.isPublished ? "var(--accent-soft)" : "var(--surface-muted)",
                    color: tpl.isPublished ? "var(--accent-text)" : "var(--text-muted)",
                  }}
                >
                  {tpl.isPublished ? t("teacher.published") : t("teacher.draft")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TeacherShell>
  );
}

type T = ReturnType<typeof useTranslations>;

function CreateTemplateForm({
  t,
  subjects,
  onCreated,
  onError,
}: {
  t: T;
  subjects: ApiSubject[];
  onCreated: (id: string) => void;
  onError: (m: string) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [track, setTrack] = useState<"exam" | "depth">("exam");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subjectId) return;
    setSubmitting(true);
    try {
      const res = await teacherCreateTemplate({ subject_id: subjectId, track, title, description });
      onCreated(res.template.id);
    } catch (err) {
      onError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.subject")}
        </span>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="">—</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.track")}
        </span>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value as "exam" | "depth")}
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="exam">{t("teacher.trackExam")}</option>
          <option value="depth">{t("teacher.trackDepth")}</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.templateTitle")}
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block" style={{ color: "var(--text-muted)" }}>
          {t("teacher.templateDescription")}
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
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting || !subjectId}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {submitting ? t("teacher.saving") : t("teacher.createTemplate")}
        </button>
      </div>
    </form>
  );
}
