import type { ScoredPost } from "@/lib/types";
import { Pill, ScoreDisplay } from "./ScoreBadge";

interface OpportunityCardProps {
  result: ScoredPost;
  now: number;
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toString();
}

const MS_PER_HOUR = 1000 * 60 * 60;

function formatRelativeDate(createdAt: string, now: number): string {
  const hours = Math.max(0, (now - new Date(createdAt).getTime()) / MS_PER_HOUR);
  if (hours < 1) return "Posted <1h ago";
  if (hours < 24) return `Posted ${Math.round(hours)}h ago`;
  return `Posted ${Math.round(hours / 24)}d ago`;
}

export function OpportunityCard({ result, now }: OpportunityCardProps) {
  const { post, score, category, isNew, shortExplanation } = result;
  const isStrong = score >= 70;

  return (
    <article
      className={`rounded-xl border bg-slate-900/60 p-5 shadow-sm ${
        isStrong ? "border-amber-500/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-base font-semibold tracking-tight text-slate-50">{post.authorName}</span>
            <span className="text-slate-600">·</span>
            <span className="text-sm font-medium text-slate-500">{post.handle}</span>
            {post.followers !== undefined && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-sm text-slate-500">{formatCompactNumber(post.followers)} followers</span>
              </>
            )}
          </div>

          {(category || isNew) && (
            <div className="flex items-center gap-1.5">
              {category && <Pill tone="category">{category}</Pill>}
              {isNew && <Pill tone="new">NEW</Pill>}
            </div>
          )}
        </div>

        <ScoreDisplay score={score} />
      </div>

      <blockquote className="mt-3 border-l-2 border-slate-700 pl-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">{post.text}</p>
      </blockquote>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-slate-200">{formatCompactNumber(post.views)}</span>
          <span className="text-slate-500">Views</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-slate-200">{formatCompactNumber(post.likes)}</span>
          <span className="text-slate-500">Likes</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-slate-200">{formatCompactNumber(post.reposts)}</span>
          <span className="text-slate-500">Reposts</span>
        </div>
        <span className="text-slate-500">{formatRelativeDate(post.createdAt, now)}</span>
      </div>

      <p className="mt-3 text-sm italic text-slate-400">{shortExplanation}</p>

      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
      >
        Open on X
      </a>
    </article>
  );
}
