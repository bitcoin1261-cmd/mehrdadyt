"use client";

import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`card p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100 sm:text-base">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "good" | "bad" | "info";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "text-slate-100",
    good: "text-emerald-400",
    bad: "text-rose-400",
    info: "text-sky-300",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        {icon && <span className="text-base opacity-80">{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "info" | "warn";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-700/40 text-slate-300 border-slate-600/60",
    good: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bad: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className={`card my-6 w-full ${wide ? "max-w-4xl" : "max-w-xl"} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="btn btn-ghost px-3 py-1 text-xs">
            بستن ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatRow({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 py-2 text-xs last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold tabular-nums ${tone ?? "text-slate-100"}`}>{value}</span>
    </div>
  );
}

export function ProgressBar({ value, tone = "sky" }: { value: number; tone?: "sky" | "emerald" | "rose" }) {
  const colors: Record<string, string> = {
    sky: "from-sky-400 to-cyan-300",
    emerald: "from-emerald-400 to-teal-300",
    rose: "from-rose-400 to-red-300",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full bg-gradient-to-l ${colors[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Empty({ text, icon = "📈" }: { text: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
