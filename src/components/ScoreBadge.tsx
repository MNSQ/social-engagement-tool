import type { ReactNode } from "react";

interface ScoreDisplayProps {
  score: number;
}

/** Compact score badge shown in the top-right corner of an opportunity card. */
export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const isStrong = score >= 70;

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold tabular-nums ring-1 ${
        isStrong
          ? "bg-amber-500/10 text-amber-300 ring-amber-500/40"
          : "bg-slate-800/60 text-slate-300 ring-slate-700"
      }`}
    >
      {score}
    </span>
  );
}

type PillTone = "new" | "category";

const PILL_STYLES: Record<PillTone, string> = {
  new: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
  category: "bg-slate-800 text-slate-300 ring-slate-700",
};

interface PillProps {
  tone?: PillTone;
  children: ReactNode;
}

/** Small rounded badge used for category and NEW labels. */
export function Pill({ tone = "category", children }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${PILL_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
