"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ClientApiError, createEnrollment, getSubjects, type ApiSubject } from "@/lib/api-client";
import { errorMessage } from "@/lib/errorMessages";
import {
  BackButton,
  ChoiceCard,
  ErrorBanner,
  FullScreenLoader,
  PrimaryButton,
  ProgressDots,
  Screen,
} from "@/components/ui";

type Track = "exam" | "depth";
type DailyHours = "lt1" | "1to2" | "gt3";

const TOTAL = 4;

// A small icon per subject slug; falls back to a book. Icons are decorative,
// so they stay out of the translation files.
function subjectIcon(subject: ApiSubject): string {
  switch (subject.icon ?? subject.slug) {
    case "math":
    case "mathematics":
      return "📐";
    case "physics":
      return "🔬";
    default:
      return "📘";
  }
}

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState<ApiSubject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Answers, held entirely client-side until the final submit.
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [dailyHours, setDailyHours] = useState<DailyHours | null>(null);
  const [wantsMentorQa, setWantsMentorQa] = useState<boolean | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSubjects()
      .then((res) => {
        if (!cancelled) setSubjects(res.subjects);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ClientApiError && err.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setLoadError(errorMessage(t, err));
      });
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  async function finish() {
    if (!subjectId || !track || !dailyHours || wantsMentorQa === null) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createEnrollment({
        subject_id: subjectId,
        track,
        daily_hours: dailyHours,
        wants_mentor_qa: wantsMentorQa,
      });
      router.replace("/dashboard");
    } catch (err) {
      // If they somehow already have a live enrollment, the dashboard is the
      // right place to land, not an error screen.
      if (err instanceof ClientApiError && err.code === "ALREADY_ENROLLED") {
        router.replace("/dashboard");
        return;
      }
      setSubmitError(errorMessage(t, err));
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <ErrorBanner message={loadError} />
        </div>
      </Screen>
    );
  }

  if (!subjects) {
    return <FullScreenLoader label={t("common.loading")} />;
  }

  return (
    <Screen>
      <div className="mb-8 flex items-center gap-4">
        <div className="w-16">
          {step > 1 && <BackButton onClick={() => setStep((s) => s - 1)} label={t("common.back")} />}
        </div>
        <div className="flex-1">
          <ProgressDots total={TOTAL} current={step} />
        </div>
        <div className="w-16 text-right text-xs" style={{ color: "var(--text-muted)" }}>
          {t("onboarding.progress", { current: step, total: TOTAL })}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {step === 1 && (
          <Question title={t("onboarding.q1Title")}>
            {subjects.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("onboarding.q1Empty")}
              </p>
            ) : (
              subjects.map((s) => (
                <ChoiceCard
                  key={s.id}
                  title={s.title}
                  icon={subjectIcon(s)}
                  selected={subjectId === s.id}
                  onClick={() => {
                    setSubjectId(s.id);
                    setStep(2);
                  }}
                />
              ))
            )}
          </Question>
        )}

        {step === 2 && (
          <Question title={t("onboarding.q2Title")}>
            <ChoiceCard
              title={t("onboarding.q2ExamTitle")}
              description={t("onboarding.q2ExamDesc")}
              selected={track === "exam"}
              onClick={() => {
                setTrack("exam");
                setStep(3);
              }}
            />
            <ChoiceCard
              title={t("onboarding.q2DepthTitle")}
              description={t("onboarding.q2DepthDesc")}
              selected={track === "depth"}
              onClick={() => {
                setTrack("depth");
                setStep(3);
              }}
            />
          </Question>
        )}

        {step === 3 && (
          <Question title={t("onboarding.q3Title")}>
            <ChoiceCard
              title={t("onboarding.q3Lt1")}
              selected={dailyHours === "lt1"}
              onClick={() => {
                setDailyHours("lt1");
                setStep(4);
              }}
            />
            <ChoiceCard
              title={t("onboarding.q3_1to2")}
              selected={dailyHours === "1to2"}
              onClick={() => {
                setDailyHours("1to2");
                setStep(4);
              }}
            />
            <ChoiceCard
              title={t("onboarding.q3Gt3")}
              selected={dailyHours === "gt3"}
              onClick={() => {
                setDailyHours("gt3");
                setStep(4);
              }}
            />
          </Question>
        )}

        {step === 4 && (
          <Question title={t("onboarding.q4Title")}>
            <ChoiceCard
              title={t("onboarding.q4Yes")}
              selected={wantsMentorQa === true}
              onClick={() => setWantsMentorQa(true)}
            />
            <ChoiceCard
              title={t("onboarding.q4No")}
              selected={wantsMentorQa === false}
              onClick={() => setWantsMentorQa(false)}
            />
            {submitError && <ErrorBanner message={submitError} />}
            <div className="mt-4">
              <PrimaryButton onClick={finish} loading={submitting} disabled={wantsMentorQa === null}>
                {submitting ? t("onboarding.creating") : t("onboarding.finish")}
              </PrimaryButton>
            </div>
          </Question>
        )}
      </div>
    </Screen>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <h1 className="mb-6 text-xl font-bold leading-snug" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
