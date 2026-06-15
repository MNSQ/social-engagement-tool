import type { AnalysisStats } from "@/lib/types";
import { ChartBarIcon, CheckCircleIcon, ListBulletIcon, StarIcon } from "./icons";

interface StatsCardsProps {
  stats: AnalysisStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Total posts analyzed",
      value: stats.totalAnalyzed.toString(),
      icon: ListBulletIcon,
      accent: false,
    },
    {
      label: "Opportunities found",
      value: stats.opportunitiesFound.toString(),
      icon: CheckCircleIcon,
      accent: false,
    },
    {
      label: "Top opportunities",
      value: stats.topOpportunities.toString(),
      icon: StarIcon,
      accent: true,
    },
    {
      label: "Average opportunity score",
      value: stats.averageOpportunityScore.toFixed(1),
      icon: ChartBarIcon,
      accent: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 shadow-sm transition-colors hover:border-slate-700"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${
                  card.accent
                    ? "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                    : "bg-slate-800/60 text-slate-400 ring-slate-700/60"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm text-slate-400">{card.label}</p>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-100">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
