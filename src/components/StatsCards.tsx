import type { AnalysisStats } from "@/lib/types";

interface StatsCardsProps {
  stats: AnalysisStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: "Total posts analyzed", value: stats.totalAnalyzed.toString() },
    { label: "Opportunities found", value: stats.opportunitiesFound.toString() },
    { label: "Top opportunities", value: stats.topOpportunities.toString() },
    { label: "Average opportunity score", value: stats.averageOpportunityScore.toFixed(1) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 shadow-sm"
        >
          <p className="text-sm text-slate-400">{card.label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-100">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
