"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// Shared primitives for the student UI. Calm and generously spaced by default;
// colors come from the CSS variables in globals.css so the palette stays in
// one place.

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8">
      {children}
    </main>
  );
}

export function PrimaryButton({
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className="w-full rounded-2xl px-5 py-4 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      style={{ background: "var(--accent)" }}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-current"
        style={{ borderColor: "var(--border)", color: "var(--text)" }}
      />
      {hint && (
        <span className="mt-1.5 block text-xs" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

// A large tappable option card — the core interaction of onboarding. Optional
// `description` supports Q2's two-line choice cards.
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
    <button
      onClick={onClick}
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
    </button>
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
