"use client";

import { ComponentProps, InputHTMLAttributes, ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

// Shared app primitives, now built on shadcn/ui underneath. Colors come from the
// CSS variables in globals.css (mapped to shadcn tokens) so the palette stays in
// one place and both light/dark themes work.

// Page container. Mobile-first single column that widens on desktop instead of
// staying a narrow phone-width strip. `size` picks the desktop max-width:
//   narrow  — forms / wizards (onboarding)
//   reading — long-form step content
//   wide    — the dashboard (uses the extra room for a two-column grid)
export function Screen({
  children,
  size = "narrow",
}: {
  children: ReactNode;
  size?: "narrow" | "reading" | "wide";
}) {
  const width =
    size === "wide"
      ? "max-w-md md:max-w-5xl"
      : size === "reading"
        ? "max-w-md md:max-w-2xl"
        : "max-w-md sm:max-w-lg";
  return (
    <main className={cn("mx-auto flex min-h-screen w-full flex-col px-6 pb-10 pt-8 md:px-8", width)}>
      {children}
    </main>
  );
}

// Desktop-responsive shell for the auth screens: a branded panel beside the
// form on large screens, a plain centered form on mobile.
export function AuthLayout({ children }: { children: ReactNode }) {
  const t = useTranslations();
  return (
    <main className="min-h-screen w-full md:grid md:grid-cols-2">
      <aside
        className="relative hidden flex-col justify-between p-12 text-white md:flex"
        style={{ background: "linear-gradient(160deg, var(--accent), var(--accent-hover))" }}
      >
        <div className="text-lg font-bold tracking-tight">LearnPath</div>
        <div>
          <p className="text-3xl font-bold leading-tight">{t("auth.welcomeTitle")}</p>
          <p className="mt-3 max-w-sm text-base text-white/80">{t("auth.welcomeSubtitle")}</p>
        </div>
        <div className="text-sm text-white/50">© LearnPath</div>
      </aside>
      <section className="flex min-h-screen flex-col px-6 py-8 md:px-12">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">{children}</div>
      </section>
    </main>
  );
}

// Full-width primary CTA, wrapping shadcn Button with a loading state.
export function PrimaryButton({
  children,
  loading,
  ...props
}: ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button
      {...props}
      disabled={props.disabled || loading}
      className="h-auto w-full rounded-xl py-4 text-base font-semibold"
    >
      {children}
    </Button>
  );
}

// Labelled text input, wrapping shadcn Input + Label. Password fields get a
// show/hide toggle so users can check what they typed.
export function TextField({
  label,
  hint,
  id,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const t = useTranslations();
  const [reveal, setReveal] = useState(false);
  const inputId = id ?? `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const isPassword = type === "password";
  const inputType = isPassword ? (reveal ? "text" : "password") : type;

  return (
    <div className="block">
      <Label htmlFor={inputId} className="mb-2 text-sm font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={inputId}
          type={inputType}
          {...props}
          className={cn("h-auto rounded-xl px-4 py-3.5 text-base", isPassword && "pr-12")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? t("auth.hidePassword") : t("auth.showPassword")}
            aria-pressed={reveal}
            title={reveal ? t("auth.hidePassword") : t("auth.showPassword")}
            className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
            tabIndex={-1}
          >
            {reveal ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// A large tappable option card — the core interaction of onboarding. Adds a
// tap/hover micro-interaction. Optional `description` supports two-line cards.
export function ChoiceCard({
  title,
  description,
  icon,
  selected,
  onClick,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-5 text-left transition-colors"
      style={{
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "var(--accent-soft)" : "var(--surface)",
      }}
    >
      {icon && <span className="text-2xl leading-none">{icon}</span>}
      <span className="flex-1">
        <span className="block text-base font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-sm" style={{ color: "var(--text-muted)" }}>
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm text-white"
        style={{
          borderColor: selected ? "var(--accent)" : "var(--border)",
          background: selected ? "var(--accent)" : "transparent",
        }}
      >
        {selected ? "✓" : ""}
      </span>
    </motion.button>
  );
}

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2 rounded-full transition-all"
          style={{
            width: i + 1 === current ? 28 : 8,
            background: i + 1 <= current ? "var(--accent)" : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-3 text-sm"
      style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
    >
      {message}
    </div>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium"
      style={{ color: "var(--text-muted)" }}
    >
      <span aria-hidden>←</span> {label}
    </button>
  );
}

export function FullScreenLoader({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center" style={{ color: "var(--text-muted)" }}>
      <p className="text-sm">{label}</p>
    </main>
  );
}

// A shimmering placeholder block for loading skeletons.
export function Skeleton({ className, radius = 12 }: { className?: string; radius?: number }) {
  return (
    <div
      className={`skeleton-shimmer ${className ?? ""}`}
      style={{ borderRadius: radius, background: "var(--surface-muted)" }}
      aria-hidden
    />
  );
}
