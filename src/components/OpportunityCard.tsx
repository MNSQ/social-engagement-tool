import type { ScoredPost } from "@/lib/types";
import { ArrowUpRightIcon, ClockIcon, EyeIcon, HeartIcon, RepeatIcon } from "./icons";
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_TONES = [
  "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20",
  "bg-violet-500/10 text-violet-300 ring-violet-500/20",
  "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20",
  "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  "bg-rose-500/10 text-rose-300 ring-rose-500/20",
  "bg-sky-500/10 text-sky-300 ring-sky-500/20",
];

function avatarTone(handle: string): string {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function OpportunityCard({ result, now }: OpportunityCardProps) {
  const { post, score, category, isNew, shortExplanation } = result;
  const isStrong = score >= 70;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-slate-900/60 p-5 shadow-sm transition-colors ${
        isStrong ? "border-amber-500/30 hover:border-amber-500/50" : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${isStrong ? "bg-amber-500/60" : "bg-slate-700/60"}`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${avatarTone(post.handle)}`}
          >
            {getInitials(post.authorName)}
          </span>

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
        </div>

        <ScoreDisplay score={score} />
      </div>

      <blockquote className="mt-3 border-l-2 border-slate-700 pl-3">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">{post.text}</p>
      </blockquote>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
        <span className="inline-flex items-center gap-1.5" title="Views">
          <EyeIcon className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-200">{formatCompactNumber(post.views)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5" title="Likes">
          <HeartIcon className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-200">{formatCompactNumber(post.likes)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5" title="Reposts">
          <RepeatIcon className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-200">{formatCompactNumber(post.reposts)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <ClockIcon className="h-3.5 w-3.5" />
          {formatRelativeDate(post.createdAt, now)}
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why this works</p>
        <p className="mt-0.5 text-sm leading-snug text-slate-300">{shortExplanation}</p>
      </div>

      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
      >
        Open on X
        <ArrowUpRightIcon className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}
