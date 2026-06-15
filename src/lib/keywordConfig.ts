import type { KeywordGroups } from "./types";

/**
 * Default keyword groups used for topic matching and risk detection.
 * These are shown (and can be edited) in the Keyword Settings panel.
 */
export const defaultKeywordGroups: KeywordGroups = {
  // Directly describes the decentralized / DePIN compute space.
  coreBrandKeywords: [
    "decentralized compute",
    "decentralized infrastructure",
    "depin",
    "gpu marketplace",
    "compute marketplace",
    "distributed gpu",
    "gpu network",
    "ai inference",
    "inference",
    "ai agents",
    "ai agent",
    "render network",
    "akash",
    "bittensor",
    "aethir",
    "gensyn",
    "solana depin",
  ],

  // Broader AI / cloud / GPU infrastructure market terms.
  marketKeywords: [
    "gpu",
    "nvidia",
    "h100",
    "a100",
    "cloud gpu",
    "hyperscaler",
    "aws",
    "azure",
    "google cloud",
    "gcp",
    "data center",
    "ai infrastructure",
    "compute cost",
    "machine learning",
    "llm",
    "cloud computing",
  ],

  // Signals that a post invites a reply: pain points, debates, comparisons, questions.
  opportunityTriggerKeywords: [
    "expensive",
    "too expensive",
    "cost",
    "pricing",
    "waitlist",
    "shortage",
    "bottleneck",
    "sold out",
    "rate limit",
    "rate limited",
    "throttle",
    "can't get",
    "cant get",
    "impossible to get",
    "priced out",
    "compare",
    " vs ",
    "alternative",
    "debate",
    "unpopular opinion",
    "hot take",
    "thoughts?",
    "anyone else",
    "struggling",
    "pain point",
    "gpu access",
    "access to gpus",
  ],

  // Keywords that indicate spam, hype, or unsafe content.
  riskKeywords: [
    "giveaway",
    "airdrop",
    "free token",
    "pump",
    "dump",
    "scam",
    "dm me",
    "send wallet",
    "seed phrase",
    "politics",
    "war",
    "hate",
    "nsfw",
    "racist",
    "harassment",
    "price prediction",
    "100x",
    "moon",
  ],
};

export type RiskSeverity = "minor" | "token" | "unsafe";

/**
 * Maps each risk keyword to a severity tier used by the scoring engine:
 * - minor: small spam-style signal (-5)
 * - token: token price / airdrop / pump hype (-15)
 * - unsafe: unsafe, political, or scam content (-30)
 */
export const riskKeywordSeverity: Record<string, RiskSeverity> = {
  "giveaway": "token",
  "airdrop": "token",
  "free token": "token",
  "pump": "token",
  "dump": "token",
  "price prediction": "token",
  "100x": "token",
  "moon": "token",
  "dm me": "minor",
  "scam": "unsafe",
  "send wallet": "unsafe",
  "seed phrase": "unsafe",
  "politics": "unsafe",
  "war": "unsafe",
  "hate": "unsafe",
  "nsfw": "unsafe",
  "racist": "unsafe",
  "harassment": "unsafe",
};
