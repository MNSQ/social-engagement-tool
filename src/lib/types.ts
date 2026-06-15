export interface Post {
  id: string;
  authorName: string;
  handle: string;
  text: string;
  url: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  followers?: number;
}

export type PriorityLabel =
  | "Top opportunity"
  | "Strong opportunity"
  | "Medium opportunity"
  | "Low priority"
  | "Ignore";

export type SafetyStatus = "Safe" | "Review first" | "Avoid";

export interface ScoreBreakdown {
  topicRelevance: number;
  engagementPotential: number;
  replyOpportunity: number;
  strategicValue: number;
  freshness: number;
  riskPenalty: number;
}

export interface ScoredPost {
  post: Post;
  score: number;
  priority: PriorityLabel;
  matchedKeywords: string[];
  riskFlags: string[];
  explanation: string[];
  suggestedReplyAngle: string;
  safetyStatus: SafetyStatus;
  breakdown: ScoreBreakdown;
  /** Short, human-readable topic category for the opportunity card badge, if one applies. */
  category?: string;
  /** True if the post is fresh enough to show a "NEW" badge. */
  isNew: boolean;
  /** One-sentence, human-written opportunity angle shown on the card (not a full reply). */
  shortExplanation: string;
}

export interface KeywordGroups {
  coreBrandKeywords: string[];
  marketKeywords: string[];
  opportunityTriggerKeywords: string[];
  riskKeywords: string[];
}

export interface AnalysisStats {
  totalAnalyzed: number;
  opportunitiesFound: number;
  topOpportunities: number;
  averageOpportunityScore: number;
}

/**
 * Required shape for a post pasted in as JSON. `id` is optional —
 * one is generated if missing so users can paste minimal objects.
 */
export type PostInput = Omit<Post, "id"> & { id?: string };

const REQUIRED_STRING_FIELDS: (keyof PostInput)[] = [
  "authorName",
  "handle",
  "text",
  "url",
  "createdAt",
];

const REQUIRED_NUMBER_FIELDS: (keyof PostInput)[] = [
  "likes",
  "replies",
  "reposts",
  "views",
];

/**
 * Validates and normalizes raw JSON input into Post objects.
 * Throws an Error with a human-readable message on the first problem found.
 */
export function parsePostsInput(raw: unknown): Post[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected a JSON array of post objects.");
  }

  return raw.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Post at index ${index} is not an object.`);
    }

    const obj = item as Record<string, unknown>;

    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof obj[field] !== "string" || obj[field] === "") {
        throw new Error(`Post at index ${index} is missing required text field "${field}".`);
      }
    }

    for (const field of REQUIRED_NUMBER_FIELDS) {
      if (typeof obj[field] !== "number" || Number.isNaN(obj[field] as number)) {
        throw new Error(`Post at index ${index} is missing required numeric field "${field}".`);
      }
    }

    if (obj.followers !== undefined && typeof obj.followers !== "number") {
      throw new Error(`Post at index ${index} has an invalid "followers" value (must be a number).`);
    }

    const id = typeof obj.id === "string" && obj.id ? obj.id : `pasted-${index}-${Date.now()}`;

    return {
      id,
      authorName: obj.authorName as string,
      handle: obj.handle as string,
      text: obj.text as string,
      url: obj.url as string,
      createdAt: obj.createdAt as string,
      likes: obj.likes as number,
      replies: obj.replies as number,
      reposts: obj.reposts as number,
      views: obj.views as number,
      followers: obj.followers as number | undefined,
    };
  });
}
