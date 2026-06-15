import type { ReactNode } from "react";

interface ScoreDisplayProps {
  score: number;
}

const SCORE_TIERS: { min: number; classes: string }[] = [
  { min: 85, classes: "bg-amber-500/10 text-amber-300 ring-amber-500/40" },
  { min: 70, classes: "bg-orange-500/10 text-orange-300 ring-orange-500/30" },
  { min: 50, classes: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/25" },
  { min: 0, classes: "bg-slate-800/60 text-slate-300 ring-slate-700" },
];

function scoreTone(score: number): string {
  const tier = SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1];
  return tier.classes;
}

/** Compact score badge shown in the top-right corner of an opportunity card. */
export function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <span
      className={`inline-flex min-w-11 items-center justify-center rounded-lg px-2.5 py-1.5 text-base font-semibold tabular-nums ring-1 ${scoreTone(score)}`}
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
