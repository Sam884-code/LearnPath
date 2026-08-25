"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Target, TrendingUp, CheckCircle2, MessageCircleQuestion, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Eyebrow, StepNumber } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

// Marketing landing shown to logged-out visitors — LearnKata-inspired:
// serif headline, blue CTAs, a numbered learning-path explainer, feature
// cards, soft shadows and generous whitespace.
export function LandingPage({ memberTarget = null }: { memberTarget?: string | null }) {
  const t = useTranslations("landing");
  const app = useTranslations("app");
  const isMember = memberTarget !== null;

  const steps = [1, 2, 3, 4, 5].map((i) => ({
    n: i,
    label: t(`step${i}Label`),
    title: t(`step${i}Title`),
    desc: t(`step${i}Desc`),
  }));

  const features = [
    { icon: <Target className="h-5 w-5" />, title: t("feature1Title"), desc: t("feature1Desc") },
    { icon: <TrendingUp className="h-5 w-5" />, title: t("feature2Title"), desc: t("feature2Desc") },
    { icon: <CheckCircle2 className="h-5 w-5" />, title: t("feature3Title"), desc: t("feature3Desc") },
    {
      icon: <MessageCircleQuestion className="h-5 w-5" />,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Sticky translucent header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <span className="text-lg font-bold tracking-tight text-foreground">{app("name")}</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isMember ? (
              <Link
                href={memberTarget!}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-primary)]"
                style={{ background: "var(--accent)" }}
              >
                {t("goToApp")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("navSignIn")}
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-primary)]"
                  style={{ background: "var(--accent)" }}
                >
                  {t("navStart")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: "linear-gradient(180deg, var(--accent-soft), transparent)" }}
        />
        <div className="relative mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-serif text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-6xl"
          >
            {t("heroTitle")}{" "}
            <span style={{ color: "var(--accent)" }}>{t("heroHighlight")}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            {t("heroSubtitle")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href={isMember ? memberTarget! : "/register"}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--accent)" }}
            >
              {isMember ? t("goToApp") : t("heroCta")} <ArrowRight className="h-4 w-4" />
            </Link>
            {!isMember && (
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("heroSecondary")}
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Numbered learning path */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>{t("stepsEyebrow")}</Eyebrow>
          <h2 className="mt-3 font-serif text-3xl font-semibold leading-snug text-foreground sm:text-4xl">
            {t("stepsTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("stepsSubtitle")}</p>
        </div>

        <ol className="mt-12 flex flex-col gap-5">
          {steps.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Card className="flex items-start gap-5 p-6">
                <StepNumber n={s.n} className="shrink-0" />
                <div>
                  <Eyebrow>{s.label}</Eyebrow>
                  <h3 className="mt-1 font-serif text-xl font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </Card>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* Feature grid */}
      <section style={{ background: "var(--surface-muted)" }}>
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>{t("featuresEyebrow")}</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl font-semibold leading-snug text-foreground sm:text-4xl">
              {t("featuresTitle")}
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Card className="h-full p-6">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
                  >
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-2xl font-serif text-3xl font-semibold leading-snug text-foreground sm:text-4xl">
          {t("finalTitle")}
        </h2>
        <Link
          href={isMember ? memberTarget! : "/register"}
          className="mt-8 inline-flex items-center gap-2 rounded-lg px-7 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--accent)" }}
        >
          {isMember ? t("goToApp") : t("finalCta")} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="text-lg font-bold tracking-tight text-foreground">{app("name")}</span>
          <p className="text-sm text-muted-foreground">{t("footerTagline")}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            © 2026 {app("name")}. {t("footerRights")}
          </p>
        </div>
      </footer>
    </div>
  );
}

// Local lightweight card wrapper — white surface, 1px border, 16px radius,
// soft shadow (LearnKata feature-card style).
function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border shadow-[var(--shadow-md)] ${className ?? ""}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}
