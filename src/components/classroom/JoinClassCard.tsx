"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getMyClassrooms, joinClassroom, type ApiStudentClassroom } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";

// Lets a student join a teacher's class with a short code, and shows the classes
// they're already in. Styled to match the student-dashboard handoff (blue rail
// card); logic (getMyClassrooms / joinClassroom) is unchanged.
const C = {
  text: "#111827",
  text2: "#374151",
  muted: "#6b7280",
  faint: "#9ca3af",
  border3: "#eef0f2",
  hair: "#f1f2f4",
  blue: "#2563eb",
  blueHover: "#1d4ed8",
  blueTint: "#eff6ff",
  blueBorder: "#dbeafe",
  danger: "#b91c1c",
};

export function JoinClassCard() {
  const t = useTranslations();
  const [classes, setClasses] = useState<ApiStudentClassroom[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyClassrooms()
      .then((res) => setClasses(res.classrooms))
      .catch(() => setClasses([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await joinClassroom(code.trim());
      toast.success(t("classroom.joinedToast", { teacher: res.teacher.name }));
      setCode("");
      const mine = await getMyClassrooms();
      setClasses(mine.classrooms);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  const joined = classes && classes.length > 0 ? classes[0] : null;

  return (
    <section style={{ border: `1px solid ${C.border3}`, borderRadius: 16, padding: 22, background: "#fff" }}>
      <h2 style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: C.faint, margin: 0 }}>
        {t("classroom.joinTitle")}
      </h2>

      {joined ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--font-noto-serif-armenian), Georgia, serif", fontSize: 17, fontWeight: 600, color: C.text }}>
            {joined.teacher.name}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{joined.name}</div>
          {classes && classes.length > 1 && (
            <div style={{ fontSize: 13, color: C.faint, marginTop: 6 }}>
              {classes.slice(1).map((c) => t("classroom.inClass", { teacher: c.teacher.name })).join(" · ")}
            </div>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>{t("classroom.joinSubtitle")}</p>
          <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("classroom.joinPlaceholder")}
              maxLength={16}
              autoCapitalize="characters"
              autoCorrect="off"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 14,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                padding: "11px 13px",
                borderRadius: 10,
                border: `1px solid ${C.blueBorder}`,
                outline: "none",
                color: C.text,
                background: "#fff",
              }}
            />
            <button
              type="submit"
              disabled={submitting || code.trim().length === 0}
              style={{
                background: "#fff",
                color: C.blueHover,
                border: `1px solid ${C.blueBorder}`,
                borderRadius: 10,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || code.trim().length === 0 ? "not-allowed" : "pointer",
                opacity: submitting || code.trim().length === 0 ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {submitting ? t("classroom.joining") : t("classroom.joinButton")}
            </button>
          </form>
          {error && <p style={{ marginTop: 8, fontSize: 13, color: C.danger }}>{error}</p>}
        </>
      )}
    </section>
  );
}
