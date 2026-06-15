"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { defaultKeywordGroups } from "@/lib/keywordConfig";
import { analyzePosts, computeStats, filterOpportunities } from "@/lib/scoring";
import { SAMPLE_DATA_REFERENCE_TIME, samplePosts } from "@/lib/samplePosts";
import type { KeywordGroups, Post, ScoredPost } from "@/lib/types";
import { parsePostsInput } from "@/lib/types";
import { KeywordSettings } from "./KeywordSettings";
import { OpportunityCard } from "./OpportunityCard";
import { PostInput } from "./PostInput";
import { StatsCards } from "./StatsCards";

type FilterKey = "all" | "new" | "top";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "top", label: "Top opportunities" },
];

const MAX_RESULTS = 10;

function matchesFilter(result: ScoredPost, filter: FilterKey): boolean {
  switch (filter) {
    case "new":
      return result.isNew;
    case "top":
      return result.score >= 70;
    default:
      return true;
  }
}

// "Now" as a synced external value: the server (and the initial client render,
// to match it for hydration) use a fixed reference time, then the client
// switches to the real current time — captured once — after mount.
let clientNow: number | null = null;

function subscribeToNow() {
  return () => {};
}

function getServerNow() {
  return SAMPLE_DATA_REFERENCE_TIME;
}

function getClientNow() {
  if (clientNow === null) {
    clientNow = Date.now();
  }
  return clientNow;
}

interface DashboardProps {
  /** Posts to analyze on initial load — falls back to `samplePosts` if omitted. */
  initialPosts?: Post[];
}

export function Dashboard({ initialPosts }: DashboardProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts ?? samplePosts);
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(samplePosts, null, 2));
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroups>(defaultKeywordGroups);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const now = useSyncExternalStore(subscribeToNow, getClientNow, getServerNow);

  const scored = useMemo(() => analyzePosts(posts, keywordGroups, now), [posts, keywordGroups, now]);
  const opportunities = useMemo(() => filterOpportunities(scored), [scored]);
  const stats = useMemo(() => computeStats(scored, opportunities), [scored, opportunities]);
  const ranked = useMemo(
    () => opportunities.filter((result) => matchesFilter(result, filter)).slice(0, MAX_RESULTS),
    [opportunities, filter],
  );

  function handleAnalyze() {
    try {
      const parsed = parsePostsInput(JSON.parse(jsonInput));
      setPosts(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse the pasted JSON.");
    }
  }

  function handleLoadSample() {
    setPosts(samplePosts);
    setJsonInput(JSON.stringify(samplePosts, null, 2));
    setError(null);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Social Media Engagement Tool
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          Engagement Opportunities
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Tweets worth engaging with — curated and ranked by reach, recency, and relevance. Write
          your own reply — your voice carries further than a template.
        </p>
      </header>

      <StatsCards stats={stats} />

      <section>
        {opportunities.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === key
                      ? "bg-slate-200 text-slate-900"
                      : "border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500">
              {ranked.length} {ranked.length === 1 ? "opportunity" : "opportunities"}
            </span>
          </div>
        )}

        {scored.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No posts analyzed yet. Load sample posts or paste JSON below to get started.
          </div>
        ) : opportunities.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No strong engagement opportunities were found in this batch. Try different posts or
            adjust the keyword settings in Admin settings.
          </div>
        ) : ranked.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No opportunities match this filter right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {ranked.map((result) => (
              <OpportunityCard key={result.post.id} result={result} now={now} />
            ))}
          </div>
        )}
      </section>

      <details className="rounded-lg border border-slate-800/60 bg-slate-900/20 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-300">
          Import test posts
        </summary>
        <PostInput
          value={jsonInput}
          onChange={setJsonInput}
          onAnalyze={handleAnalyze}
          onLoadSample={handleLoadSample}
          error={error}
        />
      </details>

      <details className="rounded-lg border border-slate-800/60 bg-slate-900/20 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-300">
          Admin settings
        </summary>
        <KeywordSettings keywordGroups={keywordGroups} onChange={setKeywordGroups} />
      </details>
    </div>
  );
}
