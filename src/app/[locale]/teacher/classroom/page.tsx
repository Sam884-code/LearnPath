"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { teacherGetClassroom, teacherRegenerateJoinCode, type ApiClassroom } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import { TeacherShell } from "@/components/teacher/TeacherShell";
import { ListSkeleton } from "@/components/teacher/ListSkeleton";
import { ErrorBanner } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TeacherClassroomPage() {
  const t = useTranslations();
  const [classroom, setClassroom] = useState<ApiClassroom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    teacherGetClassroom()
      .then((res) => setClassroom(res.classroom))
      .catch((err) => setError(errorMessage(t, err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyCode() {
    if (!classroom) return;
    try {
      await navigator.clipboard.writeText(classroom.join_code);
      toast.success(t("teacher.codeCopied"));
    } catch {
      // Clipboard can be blocked; the code is on screen anyway.
    }
  }

  async function regenerate() {
    setError(null);
    setRegenerating(true);
    try {
      const res = await teacherRegenerateJoinCode();
      setClassroom(res.classroom);
      toast.success(t("teacher.codeRegenerated"));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <TeacherShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t("teacher.classroomTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("teacher.classroomSubtitle")}</p>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {classroom === null ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Join code */}
          <Card className="gap-0 rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>
              {t("teacher.joinCodeLabel")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className="rounded-xl px-5 py-3 font-mono text-3xl font-bold tracking-[0.3em]"
                style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
              >
                {classroom.join_code}
              </span>
              <Button variant="outline" size="sm" onClick={copyCode}>
                <Copy className="h-4 w-4" /> {t("teacher.copyCode")}
              </Button>
              <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
                <RefreshCw className="h-4 w-4" /> {regenerating ? t("teacher.regenerating") : t("teacher.regenerateCode")}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t("teacher.joinCodeHint")}</p>
          </Card>

          {/* Members */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("teacher.membersTitle")}</h2>
              <Badge variant="secondary">{t("teacher.membersCount", { n: classroom.members.length })}</Badge>
            </div>
            {classroom.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("teacher.noMembers")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {classroom.members.map((m) => (
                  <li key={m.id}>
                    <Card className="flex flex-row items-center justify-between gap-3 rounded-2xl px-4 py-3">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </TeacherShell>
  );
}
