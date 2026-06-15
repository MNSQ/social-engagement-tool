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
 * Not user-editable — these are the product's strategic talking points.
 */
const STRATEGIC_ANGLES: { keywords: string[]; angle: string }[] = [
  {
    keywords: ["expensive", "too expensive", "cost", "pricing", "afford", "priced out"],
    angle:
      "Point out how decentralized GPU marketplaces can offer meaningfully cheaper compute than traditional cloud pricing.",
  },
  {
    keywords: ["waitlist", "shortage", "sold out", "can't get", "cant get", "impossible to get", "gpu access", "access to gpus", "rate limit"],
    angle:
      "Mention global decentralized GPU supply as a way to get compute without hyperscaler waitlists or allocation limits.",
  },
  {
    keywords: ["inference", "latency", "deploy", "production"],
    angle:
      "Highlight how distributed inference networks can cut latency and cost for production AI workloads.",
  },
  {
    keywords: ["hyperscaler", "aws", "azure", "google cloud", "gcp"],
    angle:
      "Offer perspective on reducing reliance on hyperscalers by tapping decentralized infrastructure for suitable workloads.",
  },
  {
    keywords: ["depin", "decentralized", "ai agent", "ai agents"],
    angle:
      "Engage on how DePIN networks are maturing into real infrastructure for AI and agent workloads, not just token incentives.",
  },
  {
    keywords: ["nvidia", "h100", "a100", "gpu cluster", "gpu supply", "bottleneck"],
    angle:
      "Note how marketplace-based GPU access can complement constrained NVIDIA hardware supply.",
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

/** Maps a topic category to the noun phrase used in the short card explanation. */
const TOPIC_PHRASES: Record<string, string> = {
  DePIN: "decentralized compute",
  "AI Inference": "inference",
  "AI Agents": "AI agents",
  "GPU Hardware": "GPU hardware",
  "Cloud & Hyperscalers": "cloud GPU",
  "AI Infrastructure": "AI infrastructure",
  AI: "AI",
};

function topicPhrase(category?: string): string {
  return (category && TOPIC_PHRASES[category]) || "AI infrastructure";
}

/**
 * Small deterministic string hash, used to vary card explanation wording per
 * post without introducing randomness (renders must stay stable).
 */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Deterministically picks an item from `items`. `salt` lets independent picks for the same post diverge. */
function pick<T>(items: T[], seed: number, salt = 0): T {
  return items[(seed + salt) % items.length];
}

/** Formats large counts compactly, e.g. 12400 -> "12.4K". */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${value}`;
}

/** Named "why reply now" signals, derived from the opportunity trigger keywords. */
type TriggerKind = "pricing" | "shortage" | "comparison" | "painPoint" | "debate" | "question";

const PRICING_TERMS = ["expensive", "too expensive", "cost", "pricing", "priced out"];
const SHORTAGE_TERMS = [
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
  "gpu access",
  "access to gpus",
];
const COMPARISON_TERMS = ["compare", "vs", "alternative"];
const PAIN_POINT_TERMS = ["struggling", "pain point", "anyone else"];
const DEBATE_TERMS = ["debate", "unpopular opinion", "hot take"];

/** Picks the most actionable opportunity-trigger signals first (at most two are used). */
function detectTriggers(
  triggerMatches: string[],
  asksQuestion: boolean,
  makesStrongClaim: boolean,
): TriggerKind[] {
  const has = (terms: string[]) => triggerMatches.some((match) => terms.includes(match));
  const kinds: TriggerKind[] = [];

  if (has(PRICING_TERMS)) kinds.push("pricing");
  if (has(SHORTAGE_TERMS)) kinds.push("shortage");
  if (has(COMPARISON_TERMS)) kinds.push("comparison");
  if (has(PAIN_POINT_TERMS)) kinds.push("painPoint");
  if (makesStrongClaim || has(DEBATE_TERMS)) kinds.push("debate");
  if (asksQuestion) kinds.push("question");

  return kinds;
}

/** Picks "a" or "an" for a topic phrase based on its leading sound. */
function articleFor(topic: string): string {
  return /^[aeiou]/i.test(topic) ? "an" : "a";
}

/** Multiple phrasings per trigger, used after "the post" — picked by seed so repeated triggers don't read identically. */
const TRIGGER_PHRASE_VARIANTS: Record<TriggerKind, ((topic: string) => string)[]> = {
  pricing: [
    (topic) => `complains about ${topic} pricing`,
    (topic) => `calls out how expensive ${topic} has gotten`,
    (topic) => `pushes back on current ${topic} costs`,
  ],
  shortage: [
    (topic) => `flags ${articleFor(topic)} ${topic} supply or access bottleneck`,
    (topic) => `frames ${topic} availability as a real bottleneck`,
    (topic) => `points out how hard ${topic} access has become`,
  ],
  comparison: [
    (topic) => `compares ${topic} alternatives`,
    (topic) => `weighs different ${topic} options against each other`,
    (topic) => `asks how ${topic} options stack up against each other`,
  ],
  painPoint: [
    (topic) => `describes ${articleFor(topic)} ${topic} pain point`,
    (topic) => `lays out a real ${topic} struggle`,
    (topic) => `calls out a recurring ${topic} headache`,
  ],
  debate: [
    (topic) => `stakes out a strong take on ${topic}`,
    (topic) => `pushes a contrarian view on ${topic}`,
    (topic) => `makes a bold claim about ${topic} worth responding to`,
  ],
  question: [
    (topic) => `asks the community about ${topic}`,
    (topic) => `puts a direct ${topic} question to the replies`,
    (topic) => `opens the floor on ${topic} with a direct question`,
  ],
};

function triggerPhrase(trigger: TriggerKind, topic: string, seed: number, salt = 0): string {
  return pick(TRIGGER_PHRASE_VARIANTS[trigger], seed, salt)(topic);
}

/** Noun-phrase form of each trigger, used to combine two triggers in one sentence ("links X with Y"). */
const TRIGGER_NOUN_PHRASES: Record<TriggerKind, (topic: string) => string> = {
  pricing: (topic) => `${topic} pricing pressure`,
  shortage: (topic) => `${topic} supply pain`,
  comparison: (topic) => `${topic} alternatives`,
  painPoint: (topic) => `${topic} pain points`,
  debate: (topic) => `strong opinions on ${topic}`,
  question: (topic) => `open questions about ${topic}`,
};

/** Noun phrase for what a trigger "frames" the post as, used in the notable-term template. */
const TRIGGER_FRAMING_NOUNS: Record<TriggerKind, string[]> = {
  pricing: ["a cost problem worth addressing", "a budget pain point worth flagging"],
  shortage: ["a production-scale problem", "a real availability bottleneck"],
  comparison: ["an open comparison worth weighing in on", "a question about alternatives"],
  painPoint: ["a recurring pain point", "a frustration worth acknowledging"],
  debate: ["a debate worth joining", "a take worth responding to"],
  question: ["a question worth answering", "an open question worth jumping into"],
};

function triggerFramingNoun(trigger: TriggerKind, seed: number, salt = 51): string {
  return pick(TRIGGER_FRAMING_NOUNS[trigger], seed, salt);
}

/** Shorter, topic-agnostic version of a trigger, used as a second clause. */
const SECONDARY_TRIGGER_CLAUSE_VARIANTS: Record<TriggerKind, string[]> = {
  pricing: ["raises cost concerns", "puts a number on the pricing pain"],
  shortage: ["points to supply or access constraints", "underscores how tight access has become"],
  comparison: ["weighs alternatives", "puts the options side by side"],
  painPoint: ["mentions a pain point", "names a specific frustration"],
  debate: ["takes a strong stance", "isn't shy about its opinion"],
  question: ["invites discussion", "leaves an opening for replies"],
};

function secondaryTriggerClause(trigger: TriggerKind, seed: number, salt = 6): string {
  return pick(SECONDARY_TRIGGER_CLAUSE_VARIANTS[trigger], seed, salt);
}

/** Verb-phrase traction summary, e.g. "already has active replies". */
function tractionVerbPhrase(post: Post, engagementPotential: number, seed: number): string {
  if (post.replies >= 20) {
    return pick(["already has an active reply thread", "already has a busy reply thread going"], seed, 11);
  }
  if (post.replies >= 5) {
    return pick(["already has active replies", "already has people replying"], seed, 11);
  }
  if (engagementPotential >= 14) return pick(["has strong traction", "is pulling strong numbers"], seed, 11);
  if (engagementPotential >= 8) return pick(["has solid traction", "is getting solid engagement"], seed, 11);
  if (engagementPotential >= 3) {
    return pick(["has some early traction", "is picking up some early engagement"], seed, 11);
  }
  return "has only weak engagement so far";
}

/** Noun-phrase traction summary, e.g. "solid traction". */
function tractionNounPhrase(post: Post, engagementPotential: number, seed: number): string {
  if (post.replies >= 20) return pick(["an active reply thread", "a busy reply thread"], seed, 12);
  if (post.replies >= 5) return pick(["active replies already", "people already replying"], seed, 12);
  if (engagementPotential >= 14) return pick(["strong traction", "strong numbers"], seed, 12);
  if (engagementPotential >= 8) return pick(["solid traction", "solid engagement"], seed, 12);
  if (engagementPotential >= 3) return pick(["some early traction", "some early engagement"], seed, 12);
  return "limited traction so far";
}

/** How confidently a reply here would get seen, based on current engagement. */
function visibilityClause(engagementPotential: number, post: Post): string {
  if (post.replies >= 5 || engagementPotential >= 8) {
    return "the engagement is already strong enough to get visibility";
  }
  if (engagementPotential >= 3) {
    return "there's enough early traction to make a reply worth it";
  }
  return "it's early, but worth getting ahead of";
}

/** A concrete metric callout (real numbers), when the post has notable traction. */
function metricPhrase(post: Post, seed: number): string | undefined {
  const candidates: string[] = [];
  if (post.views >= 5_000) {
    candidates.push(pick([`${formatCompact(post.views)} views`, `${formatCompact(post.views)} views already`], seed, 21));
  }
  if (post.replies >= 5) {
    candidates.push(pick([`${post.replies} replies`, `${post.replies} replies already`], seed, 22));
  }
  const likesAndReposts = post.likes + post.reposts;
  if (likesAndReposts >= 100) {
    candidates.push(
      pick(
        [`${formatCompact(likesAndReposts)} likes and reposts`, `${formatCompact(likesAndReposts)} combined likes and reposts`],
        seed,
        23,
      ),
    );
  }
  if (candidates.length === 0) return undefined;
  return pick(candidates, seed, 24);
}

/** Freshness phrasing in a handful of buckets, each with multiple variants. */
const FRESHNESS_PHRASES: { maxHours: number; variants: string[] }[] = [
  { maxHours: 2, variants: ["posted within the last couple hours", "just went up", "fresh off the timeline"] },
  { maxHours: 8, variants: ["posted earlier today", "went up a few hours ago", "still fresh from today"] },
  { maxHours: 24, variants: ["posted within the last day", "went up in the last 24 hours", "from earlier today"] },
  { maxHours: 72, variants: ["posted a day or two ago", "a couple days old", "from earlier this week"] },
  { maxHours: Infinity, variants: ["an older post at this point", "posted a while back", "no longer a fresh post"] },
];

function freshnessPhrase(hoursOld: number, seed: number, salt = 31): string {
  const bucket = FRESHNESS_PHRASES.find((b) => hoursOld <= b.maxHours) ?? FRESHNESS_PHRASES[FRESHNESS_PHRASES.length - 1];
  return pick(bucket.variants, seed, salt);
}

/** Literal terms worth naming directly in an explanation, checked in priority order. */
const NOTABLE_TERM_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bh100s?\b/i, label: "H100" },
  { pattern: /\ba100s?\b/i, label: "A100" },
  { pattern: /\bh200s?\b/i, label: "H200" },
  { pattern: /\bb200s?\b/i, label: "B200" },
  { pattern: /\bnvidia\b/i, label: "NVIDIA" },
  { pattern: /\bwaitlists?\b/i, label: "waitlist" },
  { pattern: /\binference\b/i, label: "inference" },
  { pattern: /\bgpus?\b/i, label: "GPU" },
  { pattern: /\bllms?\b/i, label: "LLM" },
  { pattern: /\bdepin\b/i, label: "DePIN" },
];

function extractNotableTerm(text: string): string | undefined {
  for (const { pattern, label } of NOTABLE_TERM_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return undefined;
}

/** What a reply could pivot to, tied to the post's topic category. */
const STRATEGIC_TIE_INS: Record<string, string[]> = {
  DePIN: ["decentralized GPU supply", "DePIN compute networks", "distributed GPU marketplaces"],
  "AI Inference": ["distributed inference capacity", "an alternative compute angle for inference", "cheaper inference infrastructure"],
  "AI Agents": ["compute built for AI agent workloads", "infrastructure suited to agent workloads"],
  "GPU Hardware": ["marketplace-based GPU access", "an alternative to scarce GPU hardware"],
  "Cloud & Hyperscalers": ["decentralized alternatives to hyperscaler pricing", "cloud GPU options outside the usual hyperscalers"],
  "AI Infrastructure": ["more flexible AI infrastructure options", "decentralized compute as an alternative"],
  AI: ["a compute infrastructure angle", "an alternative compute perspective"],
};

function strategicTieIn(category: string | undefined, seed: number, salt = 41): string {
  const options = (category && STRATEGIC_TIE_INS[category]) || STRATEGIC_TIE_INS.AI;
  return pick(options, seed, salt);
}

/** Explains why a topically-relevant post is still lower priority. */
function weaknessClause(post: Post, engagementPotential: number, hoursOld: number, seed: number): string {
  const weakEngagement = engagementPotential < 6 && post.replies < 5;
  const older = hoursOld > 24;
  if (weakEngagement && older) {
    return pick(["engagement is weak and the post is already older", "it hasn't picked up traction and is no longer fresh"], seed, 61);
  }
  if (weakEngagement) {
    return pick(["engagement is still weak right now", "it hasn't picked up much traction yet"], seed, 61);
  }
  if (older) {
    return pick(["the post is already a bit older", "the moment for this one has mostly passed"], seed, 61);
  }
  return pick(
    ["it doesn't stand out enough on traction or freshness yet", "there's nothing distinctive enough here yet to prioritize"],
    seed,
    61,
  );
}

const WALLET_BAIT_RISK_FLAGS = new Set(["dm me", "send wallet", "seed phrase"]);
const HYPE_RISK_FLAGS = new Set([
  "giveaway",
  "airdrop",
  "free token",
  "pump",
  "dump",
  "price prediction",
  "100x",
  "moon",
  "scam",
]);

/** Short, specific reason to skip a post flagged as unsafe. */
function buildAvoidExplanation(riskFlags: string[], seed: number): string {
  if (riskFlags.some((flag) => WALLET_BAIT_RISK_FLAGS.has(flag))) {
    return pick(
      ["Skip — reads like wallet or DM bait, not a real conversation to join.", "Skip — this is wallet or DM-bait phrasing, not worth a reply."],
      seed,
      71,
    );
  }
  if (riskFlags.some((flag) => HYPE_RISK_FLAGS.has(flag))) {
    return pick(
      [
        "Skip — token hype, giveaway, or scam language, not a genuine opportunity.",
        "Skip — reads as hype or giveaway bait rather than a real discussion.",
      ],
      seed,
      71,
    );
  }
  return pick(
    [
      "Skip — touches on politics or unsafe content, outside this account's lane.",
      "Skip — strays into politics or unsafe territory, outside this account's lane.",
    ],
    seed,
    71,
  );
}

/**
 * Builds the one- or two-sentence "why this post" explanation shown on each
 * opportunity card, using the same topic, trigger, traction, freshness, and
 * risk signals that drive the score itself. Several phrasing variants per
 * signal are selected deterministically from the post's id/text, so posts
 * that land in the same scoring bucket don't all read identically.
 */
function buildShortExplanation(params: {
  post: Post;
  score: number;
  safetyStatus: SafetyStatus;
  severity: RiskSeverity | "none";
  riskFlags: string[];
  category?: string;
  topicRelevance: number;
  triggerMatches: string[];
  asksQuestion: boolean;
  makesStrongClaim: boolean;
  engagementPotential: number;
  isNew: boolean;
  hoursOld: number;
}): string {
  const {
    post,
    score,
    safetyStatus,
    severity,
    riskFlags,
    category,
    topicRelevance,
    triggerMatches,
    asksQuestion,
    makesStrongClaim,
    engagementPotential,
    isNew,
    hoursOld,
  } = params;

  const seed = hashString(`${post.id}::${post.text}`);

  if (safetyStatus === "Avoid") {
    return buildAvoidExplanation(riskFlags, seed);
  }
  if (topicRelevance === 0) {
    return pick(
      [
        "Skip — no link to GPU compute, inference, or DePIN, so a reply would feel forced.",
        "Skip — nothing here connects to GPU compute, inference, or DePIN.",
      ],
      seed,
      72,
    );
  }

  const topic = topicPhrase(category);
  const [primaryTrigger, secondaryTrigger] = detectTriggers(triggerMatches, asksQuestion, makesStrongClaim);
  const tractionVerb = tractionVerbPhrase(post, engagementPotential, seed);
  const tractionNoun = tractionNounPhrase(post, engagementPotential, seed);
  const freshness = freshnessPhrase(hoursOld, seed);
  const metric = metricPhrase(post, seed);
  const notableTerm = extractNotableTerm(post.text);
  const notableTermEchoesTopic = notableTerm ? topic.toLowerCase().includes(notableTerm.toLowerCase()) : true;
  const riskSuffix = severity === "none" ? "" : ", though it's worth a quick safety check first";

  if (score >= 70) {
    const opener =
      score >= 85 ? pick(["Top pick", "Top opportunity"], seed, 1) : pick(["Strong fit", "Strong opportunity"], seed, 1);

    const templates: (string | undefined)[] = [];

    if (primaryTrigger && secondaryTrigger) {
      templates.push(
        `${opener}: the post links ${TRIGGER_NOUN_PHRASES[primaryTrigger](topic)} with ${TRIGGER_NOUN_PHRASES[secondaryTrigger](topic)}, and ${visibilityClause(engagementPotential, post)}${riskSuffix}.`,
      );
    }

    if (notableTerm && primaryTrigger) {
      const termPhrase =
        primaryTrigger === "shortage"
          ? `${notableTerm} waitlists`
          : primaryTrigger === "pricing"
            ? `${notableTerm} pricing`
            : notableTerm;
      templates.push(
        `Worth opening because it frames ${termPhrase} as ${triggerFramingNoun(primaryTrigger, seed)}, which creates a clean entry point for ${strategicTieIn(category, seed)}.`,
      );
    }

    if (metric && primaryTrigger) {
      templates.push(
        `${opener} because the post ${triggerPhrase(primaryTrigger, topic, seed, 2)}, and it's already pulling in ${metric}${riskSuffix}.`,
      );
    }

    templates.push(
      `Fresh ${topic} discussion with ${tractionNoun}, ${freshness}. Good place to add context${severity === "none" ? "" : " after a quick safety check"}.`,
    );

    if (primaryTrigger) {
      templates.push(`${opener} because the post ${triggerPhrase(primaryTrigger, topic, seed, 3)} and ${tractionVerb}${riskSuffix}.`);
    } else {
      templates.push(`${opener} — ${articleFor(topic)} ${topic} post with ${tractionNoun}, ${freshness}${riskSuffix}.`);
    }

    const valid = templates.filter((candidate): candidate is string => Boolean(candidate));
    return pick(valid, seed, 100);
  }

  if (score >= 50) {
    const templates: (string | undefined)[] = [];

    if (isNew && engagementPotential >= 6) {
      const tail =
        severity === "none" ? `${tractionNoun} and no obvious risk flags` : `${tractionNoun}, though it's worth a quick safety check first`;
      templates.push(`Good opening because this is a fresh ${topic} discussion with ${tail}.`);
      templates.push(
        `Fresh discussion with ${tractionNoun} around ${topic}${notableTerm && !notableTermEchoesTopic ? `, not just ${notableTerm}` : ""}. Good place to add context.`,
      );
    }

    if (primaryTrigger === "question" || secondaryTrigger === "question") {
      templates.push(
        `Good target because it ${triggerPhrase("question", topic, seed, 5)}, making it easy to bring up ${strategicTieIn(category, seed, 43)}.`,
      );
    }

    if (notableTerm && !notableTermEchoesTopic && primaryTrigger) {
      const extra = secondaryTrigger ? `, and ${TRIGGER_NOUN_PHRASES[secondaryTrigger](topic)}` : "";
      templates.push(
        `Useful opening because the post touches on ${notableTerm}, ${TRIGGER_NOUN_PHRASES[primaryTrigger](topic)}${extra} in one thread.`,
      );
    }

    if (primaryTrigger) {
      const second = secondaryTrigger ? secondaryTriggerClause(secondaryTrigger, seed) : tractionVerb;
      templates.push(`Worth reviewing because the post ${triggerPhrase(primaryTrigger, topic, seed, 7)} and ${second}.`);
    }

    templates.push(`Worth reviewing — a relevant ${topic} post that ${tractionVerb}, ${freshness}.`);

    const valid = templates.filter((candidate): candidate is string => Boolean(candidate));
    return pick(valid, seed, 101);
  }

  if (score >= 30) {
    return pick(
      [
        `Lower priority because the topic is relevant, but ${weaknessClause(post, engagementPotential, hoursOld, seed)}.`,
        `Topically relevant${notableTerm ? ` (mentions ${notableTerm})` : ""}, but ${weaknessClause(post, engagementPotential, hoursOld, seed)} — fine to revisit later.`,
      ],
      seed,
      102,
    );
  }

  return pick(
    [
      `Low priority — only a loose ${topic} connection here, without enough traction or freshness to prioritize a reply.`,
      `Skip for now — the ${topic} link is thin and there's little traction or freshness to justify a reply.`,
    ],
    seed,
    103,
  );
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

  const shortExplanation = buildShortExplanation({
    post,
    score,
    safetyStatus,
    severity,
    riskFlags,
    category,
    topicRelevance,
    triggerMatches,
    asksQuestion,
    makesStrongClaim,
    engagementPotential,
    isNew,
    hoursOld,
  });

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
