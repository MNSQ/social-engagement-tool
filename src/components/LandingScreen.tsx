"use client";

import type { ReactNode } from "react";
import { BoltIcon } from "./icons";

interface LandingScreenProps {
  onGuestAccess: () => void;
  adminLoginSlot: ReactNode;
}

export function LandingScreen({ onGuestAccess, adminLoginSlot }: LandingScreenProps) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-10 px-6 py-20 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/30">
          <BoltIcon className="h-7 w-7 text-cyan-300" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Social Media Engagement Tool
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-100">
            Engagement Opportunities
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-slate-400">
            Find high-value X posts worth engaging with — ranked by reach, relevance, and timing.
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <button
          onClick={onGuestAccess}
          className="w-full rounded-lg bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
        >
          View demo as guest
        </button>
        <div className="flex w-full items-center gap-3 text-xs text-slate-600">
          <span className="h-px flex-1 bg-slate-800" />
          or
          <span className="h-px flex-1 bg-slate-800" />
        </div>
        {adminLoginSlot}
      </div>
    </div>
  );
}
