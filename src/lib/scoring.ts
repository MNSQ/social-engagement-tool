import {
  defaultKeywordGroups,
  riskKeywordSeverity,
  type RiskSeverity,
} from "./keywordConfig";
import type {
  AnalysisStats,
  KeywordGroups,
  Post,
  PriorityLabel,
  SafetyStatus,
  ScoreBreakdown,
  ScoredPost,
} from "./types";

const MS_PER_HOUR = 1000 * 60 * 60;

/** Patterns that suggest the post is making a strong claim or opinion. */
const STRONG_CLAIM_PATTERNS: RegExp[] = [
  /unpopular opinion/,
  /hot take/,
  /change my mind/,
  /\beveryone (is|thinks|says|wants)\b/,
  /\bnobody (is\s+)?talk/,
  /\bno one (is\s+)?talk/,
  /the (truth|reality) is/,
  /\bimpossible\b/,
  /\bguaranteed\b/,
  /\bnever\b/,
  /\balways\b/,
];

/**
 * Internal mapping from topic phrases to a "natural connection" reply angle.
 * Used for strategic value scoring (max 15) and to seed the suggested reply angle.
 * `short` is a one-sentence version used for the card's short opportunity explanation.
 * Not user-editable — these are the product's strategic talking points.
 */
const STRATEGIC_ANGLES: { keywords: string[]; angle: string; short: string }[] = [
  {
    keywords: ["expensive", "too expensive", "cost", "pricing", "afford", "priced out"],
    angle:
      "Point out how decentralized GPU marketplaces can offer meaningfully cheaper compute than traditional cloud pricing.",
    short: "Good opening to mention cheaper decentralized GPU compute as an alternative.",
  },
  {
    keywords: ["waitlist", "shortage", "sold out", "can't get", "cant get", "impossible to get", "gpu access", "access to gpus", "rate limit"],
    angle:
      "Mention global decentralized GPU supply as a way to get compute without hyperscaler waitlists or allocation limits.",
    short: "Strong opening to add context around alternative compute supply.",
  },
  {
    keywords: ["inference", "latency", "deploy", "production"],
    angle:
      "Highlight how distributed inference networks can cut latency and cost for production AI workloads.",
    short: "Good chance to bring up distributed inference for cost and latency.",
  },
  {
    keywords: ["hyperscaler", "aws", "azure", "google cloud", "gcp"],
    angle:
      "Offer perspective on reducing reliance on hyperscalers by tapping decentralized infrastructure for suitable workloads.",
    short: "Worth adding a point about reducing hyperscaler dependence.",
  },
  {
    keywords: ["depin", "decentralized", "ai agent", "ai agents"],
    angle:
      "Engage on how DePIN networks are maturing into real infrastructure for AI and agent workloads, not just token incentives.",
    short: "Good chance to note DePIN becoming real infrastructure for AI workloads.",
  },
  {
    keywords: ["nvidia", "h100", "a100", "gpu cluster", "gpu supply", "bottleneck"],
    angle:
      "Note how marketplace-based GPU access can complement constrained NVIDIA hardware supply.",
    short: "Worth mentioning how GPU marketplaces ease hardware supply constraints.",
  },
];

/**
 * Maps a matched topic keyword to a short, human-readable category label
 * shown as a badge on opportunity cards. Order of STRATEGIC topic matching
 * (core, then market) determines which category wins when several apply.
 */
const CATEGORY_BY_KEYWORD: Record<string, string> = {
  "decentralized compute": "DePIN",
  "decentralized infrastructure": "DePIN",
  "depin": "DePIN",
  "solana depin": "DePIN",
  "gpu marketplace": "DePIN",
  "compute marketplace": "DePIN",
  "distributed gpu": "DePIN",
  "gpu network": "DePIN",
  "render network": "DePIN",
  "akash": "DePIN",
  "bittensor": "DePIN",
  "aethir": "DePIN",
  "gensyn": "DePIN",
  "ai inference": "AI Inference",
  "inference": "AI Inference",
  "ai agents": "AI Agents",
  "ai agent": "AI Agents",
  "nvidia": "GPU Hardware",
  "h100": "GPU Hardware",
  "a100": "GPU Hardware",
  "cloud gpu": "Cloud & Hyperscalers",
  "hyperscaler": "Cloud & Hyperscalers",
  "aws": "Cloud & Hyperscalers",
  "azure": "Cloud & Hyperscalers",
  "google cloud": "Cloud & Hyperscalers",
  "gcp": "Cloud & Hyperscalers",
  "cloud computing": "Cloud & Hyperscalers",
  "data center": "Cloud & Hyperscalers",
  "ai infrastructure": "AI Infrastructure",
  "compute cost": "AI Infrastructure",
  "machine learning": "AI Infrastructure",
  "llm": "AI Infrastructure",
  "gpu": "GPU Hardware",
};

const GENERIC_AI_PATTERN = /\b(ai|artificial intelligence)\b/;

/** Picks a single display category from matched topic keywords, if any. */
function categorizeTopic(coreMatches: string[], marketMatches: string[], genericAi: boolean): string | undefined {
  for (const keyword of [...coreMatches, ...marketMatches]) {
    const category = CATEGORY_BY_KEYWORD[keyword];
    if (category) return category;
  }
  return genericAi ? "AI" : undefined;
}

/** Builds the opening sentence of the short opportunity explanation. */
function buildLeadIn(engagementPotential: number, replyOpportunity: number, category?: string): string {
  const topic = category ?? "AI infrastructure";
  if (engagementPotential >= 14) return `High-reach post about ${topic}.`;
  if (replyOpportunity >= 12) return `Active ${topic} discussion.`;
  if (engagementPotential >= 6) return `Relevant ${topic} post gaining traction.`;
  return `Relevant ${topic} post.`;
}

function findMatches(text: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => text.includes(keyword.toLowerCase())).map((k) => k.trim());
}

const SEVERITY_RANK: Record<RiskSeverity | "none", number> = {
  none: 0,
  minor: 1,
  token: 2,
  unsafe: 3,
};

const SEVERITY_PENALTY: Record<RiskSeverity | "none", number> = {
  none: 0,
  minor: 5,
  token: 15,
  unsafe: 30,
};

function getPriorityLabel(score: number): PriorityLabel {
  if (score >= 85) return "Top opportunity";
  if (score >= 70) return "Strong opportunity";
  if (score >= 50) return "Medium opportunity";
  if (score >= 30) return "Low priority";
  return "Ignore";
}

function getSafetyStatus(severity: RiskSeverity | "none"): SafetyStatus {
  if (severity === "unsafe") return "Avoid";
  if (severity === "token" || severity === "minor") return "Review first";
  return "Safe";
}

function formatAge(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (hours < 24) {
    const rounded = Math.round(hours * 10) / 10;
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Scores a single post across the six dimensions of the engagement model and
 * returns a fully explained result. Pure function — does not mutate input.
 * `now` (defaults to `Date.now()`) is the reference time for freshness —
 * pass an explicit value to keep results deterministic across renders.
 */
export function scorePost(
  post: Post,
  keywords: KeywordGroups = defaultKeywordGroups,
  now: number = Date.now(),
): ScoredPost {
  const text = post.text.toLowerCase();
  const explanation: string[] = [];
  const matchedKeywords = new Set<string>();

  // 1. Topic relevance (max 30) -------------------------------------------
  const coreMatches = findMatches(text, keywords.coreBrandKeywords);
  const marketMatches = findMatches(text, keywords.marketKeywords);
  coreMatches.forEach((m) => matchedKeywords.add(m));
  marketMatches.forEach((m) => matchedKeywords.add(m));

  const topicMatchCount = coreMatches.length + marketMatches.length;
  let topicRelevance: number;
  if (topicMatchCount > 0) {
    // Medium-high: AI compute / GPU / DePIN / inference / agents.
    topicRelevance = Math.min(30, 18 + (topicMatchCount - 1) * 3);
    explanation.push(
      `On-topic for AI compute / GPU infrastructure (matched: ${[...coreMatches, ...marketMatches].join(", ")}).`,
    );
  } else if (GENERIC_AI_PATTERN.test(text)) {
    // Low-medium: generic AI mention with no infrastructure angle.
    topicRelevance = 8;
    explanation.push("Generic AI mention with no specific compute/infrastructure angle.");
  } else {
    topicRelevance = 0;
    explanation.push("No clear connection to AI compute, GPUs, or DePIN topics.");
  }

  const genericAiMention = GENERIC_AI_PATTERN.test(text);
  const category = categorizeTopic(coreMatches, marketMatches, genericAiMention);

  // 2. Engagement potential (max 20) ---------------------------------------
  let engagementPotential = 0;
  if (post.views >= 100_000) engagementPotential += 8;
  else if (post.views >= 25_000) engagementPotential += 6;
  else if (post.views >= 5_000) engagementPotential += 4;
  else if (post.views >= 1_000) engagementPotential += 2;

  if (post.replies >= 50) engagementPotential += 6;
  else if (post.replies >= 20) engagementPotential += 4;
  else if (post.replies >= 5) engagementPotential += 2;
  else if (post.replies >= 1) engagementPotential += 1;

  const likesAndReposts = post.likes + post.reposts;
  if (likesAndReposts >= 500) engagementPotential += 4;
  else if (likesAndReposts >= 100) engagementPotential += 2;
  else if (likesAndReposts >= 20) engagementPotential += 1;

  if (post.followers !== undefined) {
    if (post.followers >= 50_000) engagementPotential += 2;
    else if (post.followers >= 10_000) engagementPotential += 1;
  }
  engagementPotential = Math.min(20, engagementPotential);
  explanation.push(
    `Engagement potential ${engagementPotential}/20 from ${post.views.toLocaleString()} views, ${post.replies} replies, ${likesAndReposts} likes+reposts.`,
  );

  // 3. Reply opportunity (max 20) ------------------------------------------
  let replyOpportunity = 0;
  const triggerMatches = findMatches(text, keywords.opportunityTriggerKeywords);
  triggerMatches.forEach((m) => matchedKeywords.add(m));
  replyOpportunity += Math.min(12, triggerMatches.length * 4);
  if (triggerMatches.length > 0) {
    explanation.push(`Mentions reply triggers: ${triggerMatches.join(", ")}.`);
  }

  const asksQuestion = text.includes("?");
  if (asksQuestion) {
    replyOpportunity += 4;
    explanation.push("Asks a question — natural opening for a reply.");
  }

  const makesStrongClaim = STRONG_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
  if (makesStrongClaim) {
    replyOpportunity += 4;
    explanation.push("Makes a strong claim or opinion that invites discussion.");
  }
  replyOpportunity = Math.min(20, replyOpportunity);

  // 4. Strategic value (max 15) ---------------------------------------------
  const matchedAngles = STRATEGIC_ANGLES.filter((angle) =>
    angle.keywords.some((keyword) => text.includes(keyword)),
  );
  const strategicValue = Math.min(15, matchedAngles.length * 5);
  if (matchedAngles.length > 0) {
    explanation.push("Naturally connects to decentralized compute / DePIN talking points.");
  }

  // 5. Freshness (max 10) -----------------------------------------------------
  const hoursOld = Math.max(0, (now - new Date(post.createdAt).getTime()) / MS_PER_HOUR);
  let freshness: number;
  if (hoursOld <= 2) freshness = 10;
  else if (hoursOld <= 8) freshness = 8;
  else if (hoursOld <= 24) freshness = 5;
  else if (hoursOld <= 72) freshness = 2;
  else freshness = 0;
  explanation.push(`Posted ${formatAge(hoursOld)} ago (${freshness}/10 freshness points).`);
  const isNew = hoursOld <= 2;

  // 6. Risk penalty (subtract up to 30) ---------------------------------------
  const riskFlags: string[] = [];
  let severity: RiskSeverity | "none" = "none";
  for (const riskKeyword of keywords.riskKeywords) {
    if (text.includes(riskKeyword.toLowerCase())) {
      riskFlags.push(riskKeyword);
      const keywordSeverity = riskKeywordSeverity[riskKeyword] ?? "minor";
      if (SEVERITY_RANK[keywordSeverity] > SEVERITY_RANK[severity]) {
        severity = keywordSeverity;
      }
    }
  }
  const riskPenalty = SEVERITY_PENALTY[severity];
  if (riskFlags.length > 0) {
    explanation.push(`Risk flags: ${riskFlags.join(", ")} (-${riskPenalty} points).`);
  }

  // Final score ----------------------------------------------------------------
  const rawScore =
    topicRelevance + engagementPotential + replyOpportunity + strategicValue + freshness - riskPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const priority = getPriorityLabel(score);
  const safetyStatus = getSafetyStatus(severity);

  let suggestedReplyAngle: string;
  if (safetyStatus === "Avoid") {
    suggestedReplyAngle = "Do not engage — this post is flagged as unsafe, political, or scam-related.";
  } else if (matchedAngles.length > 0) {
    suggestedReplyAngle = matchedAngles[0].angle;
  } else if (topicRelevance >= 18) {
    suggestedReplyAngle =
      "Add a specific, useful perspective on GPU/compute infrastructure — avoid generic replies.";
  } else if (topicRelevance > 0) {
    suggestedReplyAngle =
      "If relevant, add a useful data point or ask a clarifying question to join the conversation naturally.";
  } else {
    suggestedReplyAngle = "Low topical fit — likely not worth a manual reply from this account.";
  }

  let shortExplanation: string;
  if (safetyStatus === "Avoid") {
    shortExplanation = "Flagged for risk signals — review carefully before engaging, if at all.";
  } else {
    const leadIn = buildLeadIn(engagementPotential, replyOpportunity, category);
    if (matchedAngles.length > 0) {
      shortExplanation = `${leadIn} ${matchedAngles[0].short}`;
    } else if (topicRelevance >= 18) {
      shortExplanation = `${leadIn} Worth adding a specific, useful perspective rather than a generic reply.`;
    } else if (topicRelevance > 0) {
      shortExplanation = `${leadIn} Could be worth a quick reply if you have something useful to add.`;
    } else {
      shortExplanation = "Limited topical fit — likely not worth a manual reply from this account.";
    }
  }

  const breakdown: ScoreBreakdown = {
    topicRelevance,
    engagementPotential,
    replyOpportunity,
    strategicValue,
    freshness,
    riskPenalty,
  };

  return {
    post,
    score,
    priority,
    matchedKeywords: Array.from(matchedKeywords),
    riskFlags,
    explanation,
    suggestedReplyAngle,
    safetyStatus,
    breakdown,
    category,
    isNew,
    shortExplanation,
  };
}

/** Scores every post and returns results sorted by score, highest first. */
export function analyzePosts(
  posts: Post[],
  keywords: KeywordGroups = defaultKeywordGroups,
  now: number = Date.now(),
): ScoredPost[] {
  return posts.map((post) => scorePost(post, keywords, now)).sort((a, b) => b.score - a.score);
}

/**
 * Safety filter: a scored post is worth surfacing as an engagement opportunity
 * only if it isn't low-value ("Ignore") and isn't flagged as unsafe ("Avoid").
 * Posts that fail this stay scored internally but are hidden from the results list.
 */
export function isEngagementOpportunity(result: ScoredPost): boolean {
  return result.priority !== "Ignore" && result.safetyStatus !== "Avoid";
}

/** Filters scored results down to the curated list of engagement opportunities. */
export function filterOpportunities(scored: ScoredPost[]): ScoredPost[] {
  return scored.filter(isEngagementOpportunity);
}

/** Aggregates scored results into the summary stats shown on the dashboard. */
export function computeStats(scored: ScoredPost[], opportunities: ScoredPost[]): AnalysisStats {
  const totalAnalyzed = scored.length;
  const opportunitiesFound = opportunities.length;
  const topOpportunities = opportunities.filter((s) => s.score >= 70).length;
  const averageOpportunityScore =
    opportunitiesFound === 0
      ? 0
      : Math.round((opportunities.reduce((sum, s) => sum + s.score, 0) / opportunitiesFound) * 10) / 10;

  return { totalAnalyzed, opportunitiesFound, topOpportunities, averageOpportunityScore };
}
