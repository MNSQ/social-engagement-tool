"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { defaultKeywordGroups } from "@/lib/keywordConfig";
import { analyzePosts, computeStats, filterOpportunities } from "@/lib/scoring";
import { SAMPLE_DATA_REFERENCE_TIME, samplePosts } from "@/lib/samplePosts";
import type { KeywordGroups, Post } from "@/lib/types";
import { parsePostsInput } from "@/lib/types";
import { BoltIcon, ChevronDownIcon } from "./icons";
import { KeywordSettings } from "./KeywordSettings";
import { OpportunityCard } from "./OpportunityCard";
import { PostInput } from "./PostInput";
import { StatsCards } from "./StatsCards";

const MAX_RESULTS = 10;

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
  /** Whether the signed-in user can see the import/admin settings panels. */
  isAdmin?: boolean;
  /** True when the visitor has not signed in — hides admin sections and gates X links. */
  isGuest?: boolean;
  /** Email of the signed-in user, shown in the header. */
  userEmail?: string;
  /** Sign-out button, rendered by a parent Server Component. */
  signOutSlot?: ReactNode;
}

export function Dashboard({ initialPosts, isAdmin = false, isGuest = false, userEmail, signOutSlot }: DashboardProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts ?? samplePosts);
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(samplePosts, null, 2));
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroups>(defaultKeywordGroups);
  const [error, setError] = useState<string | null>(null);

  const now = useSyncExternalStore(subscribeToNow, getClientNow, getServerNow);

  const scored = useMemo(() => analyzePosts(posts, keywordGroups, now), [posts, keywordGroups, now]);
  const opportunities = useMemo(() => filterOpportunities(scored), [scored]);
  const stats = useMemo(() => computeStats(scored, opportunities), [scored, opportunities]);
  const ranked = useMemo(() => opportunities.slice(0, MAX_RESULTS), [opportunities]);

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
      <header className="flex flex-col gap-4 border-b border-slate-800/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30">
            <BoltIcon className="h-5 w-5 text-cyan-300" />
          </span>
          <div>
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
          </div>
        </div>
        {(userEmail || signOutSlot) && (
          <div className="flex items-center gap-3 text-sm text-slate-400">
            {userEmail && (
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 py-1 pl-1 pr-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-300">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
                {userEmail}
              </span>
            )}
            {signOutSlot}
          </div>
        )}
      </header>

      <StatsCards stats={stats} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Engagement Opportunities
        </h2>
        {scored.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            {isGuest
              ? "No demo posts loaded."
              : "No posts analyzed yet. Load sample posts or paste JSON below to get started."}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            {isGuest
              ? "No strong engagement opportunities were found in the demo dataset."
              : "No strong engagement opportunities were found in this batch. Try different posts or adjust the keyword settings in Admin settings."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {ranked.map((result) => (
              <OpportunityCard key={result.post.id} result={result} now={now} isGuest={isGuest} />
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <>
          <details className="group rounded-2xl border border-slate-800/60 bg-slate-900/30 px-4 py-3 transition-colors open:border-slate-700">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 [&::-webkit-details-marker]:hidden">
              Import test posts
              <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <PostInput
              value={jsonInput}
              onChange={setJsonInput}
              onAnalyze={handleAnalyze}
              onLoadSample={handleLoadSample}
              error={error}
            />
          </details>

          <details className="group rounded-2xl border border-slate-800/60 bg-slate-900/30 px-4 py-3 transition-colors open:border-slate-700">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 [&::-webkit-details-marker]:hidden">
              Admin settings
              <ChevronDownIcon className="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <KeywordSettings keywordGroups={keywordGroups} onChange={setKeywordGroups} />
          </details>
        </>
      )}
    </div>
  );
}
