import { cosineSimilarity } from "ai";
import mongoose from "mongoose";
import { getStoredAIProfile, type StoredAIProfile } from "@/lib/ai-profile";
import {
  COACH_EMBEDDING_DIMENSIONS,
  COACH_EMBEDDING_VERSION,
  COACH_VECTOR_INDEX_NAME,
  createCoachEmbedding,
  scheduleCoachEmbeddingBackfill,
  scheduleCoachVectorIndexEnsure,
} from "@/lib/coach-embeddings";
import {
  getDateKeyInTimezone,
  getWeekStartDateKey,
  type UserCategory,
} from "@/lib/logs";
import connectToDatabase from "@/lib/mongoose";
import Commitment from "@/models/Commitment";
import LogEntry from "@/models/LogEntry";
import User from "@/models/User";

const MAX_RECENT_LOGS = 8;
const MAX_HISTORICAL_MATCHES = 8;
const MAX_VECTOR_CANDIDATES = 80;
const MAX_STATS_EXAMPLES = 4;
const MIN_JOURNEY_MATCH_LIMIT = 6;

const HISTORY_QUERY_RE =
  /\b(journey|so far|history|historical|progress|pattern|patterns|learned|covered|struggle|struggled|breakthrough|topic|topics|when did|how many|count|total|analysis|analyze|review|recap|trend|over time|compare|vs\b)\b/i;
const DAILY_FOCUS_QUERY_RE =
  /\b(today|tonight|right now|next|focus on|how's my day|how is my day|quick daily insight|what should i do)\b/i;
const STRUCTURED_QUERY_RE =
  /\b(how many|count|total|when did|spend|enough time|trend|compare|vs\b|track|covered|topics|started)\b/i;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

type CoachIntentTag =
  | "journey"
  | "struggle"
  | "learning"
  | "compare"
  | "timeline"
  | "count";

interface ScopeGroup {
  aliases: string[];
  triggerTerms: string[];
  categoryHints: string[];
  topicTerms: string[];
}

const SCOPE_GROUPS: ScopeGroup[] = [
  {
    aliases: [
      "dsa",
      "leetcode",
      "problem solving",
      "coding interview",
      "interview coding",
    ],
    triggerTerms: [
      "dsa",
      "leetcode",
      "interview",
      "problem",
      "problems",
      "sliding window",
      "two pointers",
      "3sum",
      "trapping rain water",
      "hashing",
    ],
    categoryHints: ["interview", "prep", "coding", "leetcode"],
    topicTerms: [
      "leetcode",
      "problem",
      "subarray",
      "sliding window",
      "two pointers",
      "hashing",
      "dynamic programming",
      "accepted",
      "submitted",
    ],
  },
  {
    aliases: [
      "project",
      "projects",
      "product",
      "app",
      "building",
      "feature",
      "shipping",
    ],
    triggerTerms: [
      "project",
      "build",
      "building",
      "feature",
      "disciplog",
      "shipping",
      "ship",
      "ui",
      "ux",
      "app",
    ],
    categoryHints: ["project", "build", "ship", "product"],
    topicTerms: [
      "disciplog",
      "feature",
      "ui",
      "ux",
      "app",
      "build",
      "implement",
      "ship",
      "design",
    ],
  },
  {
    aliases: ["learning", "learn", "study", "research", "reading", "notes"],
    triggerTerms: ["learn", "learning", "study", "research", "read", "notes"],
    categoryHints: ["learn", "study", "research"],
    topicTerms: ["learn", "study", "research", "summary", "notes", "takeaway"],
  },
];

const INTENT_RULES: Array<{ tag: CoachIntentTag; pattern: RegExp }> = [
  {
    tag: "journey",
    pattern:
      /\b(journey|so far|history|historical|progress|recap|review|over time)\b/i,
  },
  {
    tag: "struggle",
    pattern:
      /\b(struggle|struggled|stuck|failed|failure|hardest|mistake|mistakes|issue|issues|hint|blank|edge cases?)\b/i,
  },
  {
    tag: "learning",
    pattern:
      /\b(learned|what have i learned|takeaway|takeaways|insight|insights|pattern|patterns|covered|topic|topics)\b/i,
  },
  {
    tag: "compare",
    pattern: /\b(compare|vs\b|versus|balance)\b/i,
  },
  {
    tag: "timeline",
    pattern: /\b(when did|started|first|last|timeline)\b/i,
  },
  {
    tag: "count",
    pattern: /\b(how many|count|total)\b/i,
  },
];

const INTENT_MARKERS: Partial<Record<CoachIntentTag, string[]>> = {
  struggle: [
    "stuck",
    "failed",
    "mistake",
    "mistakes",
    "hint",
    "blank",
    "tle",
    "edge case",
    "edge cases",
    "overcomplicated",
    "couldn't",
    "could not",
  ],
  learning: [
    "learned",
    "takeaway",
    "takeaways",
    "insight",
    "insights",
    "golden rule",
    "analysis",
    "pattern",
    "core idea",
    "key insight",
  ],
};

const KNOWN_QUERY_PHRASES = [
  "sliding window",
  "two pointers",
  "dynamic programming",
  "binary search",
  "system design",
  "trapping rain water",
  "container with most water",
  "fruit into baskets",
  "max consecutive ones",
  "character replacement",
  "minimum size subarray sum",
  "maximum average subarray",
  "longest substring without repeating characters",
  "next.js",
  "app router",
  "route group",
  "3sum",
  "two sum",
  "leetcode",
  "dsa",
  "disciplog",
  "ui",
  "ux",
];

const STOPWORDS = new Set([
  "a",
  "am",
  "an",
  "analysis",
  "analyze",
  "and",
  "are",
  "be",
  "brief",
  "compare",
  "covered",
  "daily",
  "did",
  "direct",
  "do",
  "enough",
  "far",
  "for",
  "from",
  "give",
  "going",
  "how",
  "i",
  "in",
  "insight",
  "is",
  "it",
  "journey",
  "learned",
  "looking",
  "me",
  "my",
  "of",
  "on",
  "or",
  "pattern",
  "patterns",
  "productivity",
  "progress",
  "progressed",
  "quick",
  "recap",
  "review",
  "so",
  "should",
  "started",
  "the",
  "this",
  "time",
  "today",
  "topic",
  "topics",
  "track",
  "to",
  "total",
  "week",
  "weeks",
  "what",
  "when",
  "which",
  "with",
]);

const GENERIC_QUERY_TERMS = new Set([
  "breakdown",
  "build",
  "building",
  "category",
  "coverage",
  "count",
  "daily",
  "history",
  "historical",
  "interview",
  "journey",
  "learn",
  "learning",
  "logs",
  "metrics",
  "monthly",
  "overview",
  "pattern",
  "patterns",
  "prep",
  "problem",
  "problems",
  "progress",
  "project",
  "projects",
  "snapshot",
  "shipping",
  "solve",
  "solved",
  "started",
  "stats",
  "status",
  "study",
  "summary",
  "topic",
  "topics",
  "weekly",
]);

interface CoachLogDocument {
  _id: mongoose.Types.ObjectId;
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string | null;
  coachEmbedding?: number[] | null;
  loggedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

interface UserCoachConfigDocument {
  categories?: UserCategory[];
  aiProfile?: unknown;
}

export interface CommitmentSummary {
  text: string;
  status: string;
  missedReason?: string;
}

export interface CoachContextLog {
  id: string;
  date: string;
  hours: number;
  category: string;
  aiSummary: string;
  rawTranscript: string;
  loggedAt?: string;
  createdAt?: string;
  score?: number;
}

export interface CoachOverviewStats {
  totalLogs: number;
  totalHours: number;
  activeDays: number;
  firstLogDate?: string;
  lastLogDate?: string;
}

export interface CoachCategoryStats {
  category: string;
  totalLogs: number;
  totalHours: number;
  firstLogDate?: string;
  lastLogDate?: string;
}

export interface CoachDateCoverage {
  firstDate?: string;
  lastDate?: string;
  activeDays: number;
  sampleDates: string[];
}

export interface CoachStructuredStats {
  overview: CoachOverviewStats;
  byCategory: CoachCategoryStats[];
  weeklyByCategory: CoachCategoryStats[];
  todayTotalHours: number;
}

export interface CoachQuerySignals {
  wantsHistorical: boolean;
  wantsStructuredStats: boolean;
  resolvedCategories: string[];
  advisoryLabels: string[];
  searchPhrases: string[];
  specificPhrases: string[];
  topicTerms: string[];
  intentTags: CoachIntentTag[];
}

export interface CoachStatsRange {
  startDate?: string;
  endDate?: string;
}

export interface BaselineCoachContext {
  recentLogs: CoachContextLog[];
  structuredStats: CoachStructuredStats;
  weeklyCommitments: CommitmentSummary[];
  memoryContext: string;
  aiProfile: StoredAIProfile;
  userCategories: UserCategory[];
  todayDateKey: string;
  weekStartDateKey: string;
}

export type HistoricalRetrievalMode = "none" | "vector" | "cosine" | "keyword";

export interface HistoricalSearchResult {
  query: string;
  resolvedCategories: string[];
  advisoryLabels: string[];
  searchPhrases: string[];
  topicTerms: string[];
  intentTags: CoachIntentTag[];
  dateCoverage: CoachDateCoverage;
  matches: CoachContextLog[];
  mode: HistoricalRetrievalMode;
}

export interface CoachStatsResult {
  label: string;
  query?: string;
  resolvedCategories: string[];
  advisoryLabels: string[];
  searchPhrases: string[];
  topicTerms: string[];
  intentTags: CoachIntentTag[];
  matchStrategy: "strict" | "category-range-fallback";
  range: CoachStatsRange;
  dateCoverage: CoachDateCoverage;
  overview: {
    matchedLogs: number;
    matchedHours: number;
    activeDays: number;
    firstLogDate?: string;
    lastLogDate?: string;
  };
  byCategory: CoachCategoryStats[];
  recentExamples: CoachContextLog[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function serializeTimestamp(value?: Date | string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toContextLog(log: CoachLogDocument & { score?: number }): CoachContextLog {
  return {
    id: String(log._id),
    date: log.date,
    hours: log.hours,
    category: log.category,
    aiSummary: typeof log.aiSummary === "string" ? log.aiSummary : "",
    rawTranscript: log.rawTranscript,
    loggedAt: serializeTimestamp(log.loggedAt),
    createdAt: serializeTimestamp(log.createdAt),
    score: typeof log.score === "number" ? log.score : undefined,
  };
}

function containsTerm(haystack: string, term: string): boolean {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedTerm = normalizeText(term);

  if (!normalizedHaystack || !normalizedTerm) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9+#])${escapeRegExp(normalizedTerm)}(?=$|[^a-z0-9+#])`,
    "i"
  );

  return pattern.test(normalizedHaystack);
}

function buildDateSample(dates: string[]): string[] {
  const uniqueSortedDates = uniqueStrings(
    dates.filter((value) => typeof value === "string" && value.length > 0)
  ).sort();

  if (uniqueSortedDates.length <= 6) {
    return uniqueSortedDates;
  }

  return uniqueStrings([
    ...uniqueSortedDates.slice(0, 3),
    ...uniqueSortedDates.slice(-3),
  ]);
}

function buildDateCoverageFromDates(input: {
  dates: string[];
  firstDate?: string;
  lastDate?: string;
}): CoachDateCoverage {
  const uniqueSortedDates = uniqueStrings(
    input.dates.filter((value) => typeof value === "string" && value.length > 0)
  ).sort();

  return {
    firstDate: input.firstDate ?? uniqueSortedDates[0],
    lastDate: input.lastDate ?? uniqueSortedDates.at(-1),
    activeDays: uniqueSortedDates.length,
    sampleDates: buildDateSample(uniqueSortedDates),
  };
}

function matchesScopeAlias(label: string, alias: string): boolean {
  return containsTerm(label, alias) || containsTerm(alias, label);
}

function resolveRequestedScope(
  requestedCategories: string[] | undefined,
  categories: UserCategory[]
): {
  resolvedCategories: string[];
  advisoryLabels: string[];
  topicTerms: string[];
} {
  if (!requestedCategories || requestedCategories.length === 0) {
    return {
      resolvedCategories: [],
      advisoryLabels: [],
      topicTerms: [],
    };
  }

  const resolvedCategories: string[] = [];
  const advisoryLabels: string[] = [];
  const topicTerms: string[] = [];

  for (const rawValue of requestedCategories) {
    const normalizedValue = normalizeText(rawValue);

    if (!normalizedValue) {
      continue;
    }

    const exactMatch = categories.find(
      (category) =>
        containsTerm(category.name, normalizedValue) ||
        containsTerm(normalizedValue, category.name)
    );

    if (exactMatch) {
      resolvedCategories.push(exactMatch.name);
      continue;
    }

    const matchingGroups = SCOPE_GROUPS.filter((group) =>
      group.aliases.some((alias) => matchesScopeAlias(normalizedValue, alias))
    );

    if (matchingGroups.length > 0) {
      advisoryLabels.push(rawValue.trim());

      for (const group of matchingGroups) {
        const hintedCategories = categories
          .map((category) => category.name)
          .filter((name) => {
            const normalizedName = normalizeText(name);
            return group.categoryHints.some((hint) =>
              normalizedName.includes(hint)
            );
          });

        resolvedCategories.push(...hintedCategories);
        topicTerms.push(rawValue.trim(), ...group.topicTerms);
      }

      continue;
    }

    advisoryLabels.push(rawValue.trim());
    topicTerms.push(rawValue.trim());
  }

  return {
    resolvedCategories: uniqueStrings(resolvedCategories),
    advisoryLabels: uniqueStrings(advisoryLabels),
    topicTerms: uniqueStrings(topicTerms),
  };
}

function detectRelevantCategories(
  message: string,
  categories: UserCategory[]
): string[] {
  const directMatches = categories
    .map((category) => category.name)
    .filter((name) => containsTerm(message, name));

  const hintedMatches = SCOPE_GROUPS.flatMap((group) => {
    const hasTrigger = group.triggerTerms.some((term) => containsTerm(message, term));

    if (!hasTrigger) {
      return [];
    }

    return categories
      .map((category) => category.name)
      .filter((name) => {
        const normalizedName = normalizeText(name);
        return group.categoryHints.some((hint) => normalizedName.includes(hint));
      });
  });

  return uniqueStrings([...directMatches, ...hintedMatches]);
}

function extractSearchPhrases(message: string): string[] {
  const normalizedMessage = normalizeText(message);
  const phrases = KNOWN_QUERY_PHRASES.filter((phrase) =>
    containsTerm(normalizedMessage, phrase)
  );
  const tokens =
    normalizedMessage.match(/[a-z0-9+#.-]+/g)?.filter((token) => {
      if (STOPWORDS.has(token)) {
        return false;
      }

      if (token.length >= 3) {
        return true;
      }

      return ["ui", "ux", "dp", "dsa"].includes(token);
    }) ?? [];

  return uniqueStrings([...phrases, ...tokens]).slice(0, 10);
}

function detectIntentTags(message: string): CoachIntentTag[] {
  return INTENT_RULES.filter((rule) => rule.pattern.test(message)).map(
    (rule) => rule.tag
  );
}

function pruneTermsCoveredByCategories(
  terms: string[],
  resolvedCategories: string[]
): string[] {
  return terms.filter(
    (term) =>
      !resolvedCategories.some(
        (category) =>
          containsTerm(category, term) || containsTerm(term, category)
      )
  );
}

function getContentTerms(signals: CoachQuerySignals): string[] {
  if (signals.topicTerms.length > 0) {
    return signals.topicTerms;
  }

  if (
    signals.resolvedCategories.length === 0 &&
    signals.specificPhrases.length > 0
  ) {
    return signals.specificPhrases;
  }

  if (signals.resolvedCategories.length === 0) {
    return signals.searchPhrases;
  }

  return [];
}

export function buildCoachQuerySignals(
  message: string,
  categories: UserCategory[],
  requestedCategories: string[] = []
): CoachQuerySignals {
  const wantsHistorical =
    HISTORY_QUERY_RE.test(message) && !DAILY_FOCUS_QUERY_RE.test(message);
  const wantsStructuredStats =
    STRUCTURED_QUERY_RE.test(message) || wantsHistorical;
  const requestedScope = resolveRequestedScope(requestedCategories, categories);
  const detectedCategories = detectRelevantCategories(message, categories);
  const resolvedCategories = uniqueStrings([
    ...requestedScope.resolvedCategories,
    ...detectedCategories,
  ]);
  const searchPhrases = extractSearchPhrases(message);
  const specificPhrases = searchPhrases.filter(
    (phrase) => !GENERIC_QUERY_TERMS.has(phrase)
  );
  const topicTerms = pruneTermsCoveredByCategories(
    uniqueStrings([...requestedScope.topicTerms, ...specificPhrases]),
    resolvedCategories
  ).slice(0, 12);

  return {
    wantsHistorical,
    wantsStructuredStats,
    resolvedCategories,
    advisoryLabels: requestedScope.advisoryLabels,
    searchPhrases,
    specificPhrases,
    topicTerms,
    intentTags: detectIntentTags(message),
  };
}

function buildKeywordRegexClauses(phrases: string[]): Array<Record<string, unknown>> {
  return phrases.flatMap((phrase) => {
    const regex = new RegExp(escapeRegExp(phrase), "i");
    return [{ category: regex }, { aiSummary: regex }, { rawTranscript: regex }];
  });
}

function buildCategoryOnlyFilter(
  signals: Pick<CoachQuerySignals, "resolvedCategories">
): Record<string, unknown> | null {
  if (signals.resolvedCategories.length === 0) {
    return null;
  }

  return {
    category: { $in: signals.resolvedCategories },
  };
}

function buildRelevantFilter(signals: CoachQuerySignals): Record<string, unknown> | null {
  const keywordClauses = buildKeywordRegexClauses(getContentTerms(signals));

  if (signals.resolvedCategories.length > 0 && keywordClauses.length > 0) {
    return {
      category: { $in: signals.resolvedCategories },
      $or: keywordClauses,
    };
  }

  if (signals.resolvedCategories.length > 0) {
    return {
      category: { $in: signals.resolvedCategories },
    };
  }

  if (keywordClauses.length > 0) {
    return {
      $or: keywordClauses,
    };
  }

  return null;
}

function getLogHaystack(
  log: Pick<CoachLogDocument, "category" | "aiSummary" | "rawTranscript">
): string {
  return normalizeText(
    `${log.category}\n${log.aiSummary || ""}\n${log.rawTranscript || ""}`
  );
}

function getContentTermAdjustment(
  haystack: string,
  resolvedCategoriesCount: number,
  terms: string[]
): number {
  if (terms.length === 0) {
    return 0;
  }

  const matches = terms.reduce((count, phrase) => {
    return count + (containsTerm(haystack, phrase) ? 1 : 0);
  }, 0);

  if (matches === 0 && resolvedCategoriesCount > 0) {
    return -0.12;
  }

  return matches * 0.06;
}

function getIntentAdjustment(
  haystack: string,
  intentTags: CoachIntentTag[]
): number {
  return intentTags.reduce((score, tag) => {
    const markers = INTENT_MARKERS[tag];

    if (!markers || markers.length === 0) {
      return score;
    }

    const markerMatches = markers.reduce((count, marker) => {
      return count + (containsTerm(haystack, marker) ? 1 : 0);
    }, 0);

    if (markerMatches === 0) {
      return score;
    }

    return score + markerMatches * 0.04;
  }, 0);
}

function getRankingAdjustment(
  log: Pick<CoachLogDocument, "category" | "aiSummary" | "rawTranscript">,
  signals: CoachQuerySignals
): number {
  const haystack = getLogHaystack(log);

  return (
    getContentTermAdjustment(
      haystack,
      signals.resolvedCategories.length,
      getContentTerms(signals)
    ) + getIntentAdjustment(haystack, signals.intentTags)
  );
}

function isScopeLikeTerm(term: string): boolean {
  return SCOPE_GROUPS.some((group) => {
    return (
      group.aliases.some(
        (alias) => containsTerm(alias, term) || containsTerm(term, alias)
      ) ||
      group.triggerTerms.some(
        (trigger) =>
          containsTerm(trigger, term) || containsTerm(term, trigger)
      ) ||
      group.categoryHints.some(
        (hint) => normalizeText(term).includes(hint) || hint.includes(normalizeText(term))
      )
    );
  });
}

function isBroadScopeTopicTerm(
  term: string,
  resolvedCategories: string[]
): boolean {
  const normalizedTerm = normalizeText(term);

  if (!normalizedTerm) {
    return true;
  }

  return (
    GENERIC_QUERY_TERMS.has(normalizedTerm) ||
    resolvedCategories.some(
      (category) =>
        containsTerm(category, normalizedTerm) ||
        containsTerm(normalizedTerm, category)
    ) ||
    isScopeLikeTerm(normalizedTerm)
  );
}

function shouldUseCategoryOnlyStatsFallback(
  signals: CoachQuerySignals,
  matchedLogs: number
): boolean {
  if (signals.resolvedCategories.length === 0 || signals.topicTerms.length === 0) {
    return false;
  }

  const allTopicTermsAreBroadScope = signals.topicTerms.every((term) =>
    isBroadScopeTopicTerm(term, signals.resolvedCategories)
  );

  if (!allTopicTermsAreBroadScope) {
    return false;
  }

  if (matchedLogs === 0) {
    return true;
  }

  if (signals.intentTags.includes("journey") && matchedLogs < 3) {
    return true;
  }

  if (
    (signals.intentTags.includes("timeline") ||
      signals.intentTags.includes("compare")) &&
    matchedLogs < 2
  ) {
    return true;
  }

  return false;
}

function clampHistoricalLimit(
  limit: number | undefined,
  signals: CoachQuerySignals
): number {
  const requestedLimit = limit
    ? Math.max(1, Math.min(limit, MAX_HISTORICAL_MATCHES))
    : MAX_HISTORICAL_MATCHES;

  if (signals.intentTags.includes("journey")) {
    return Math.max(requestedLimit, MIN_JOURNEY_MATCH_LIMIT);
  }

  return requestedLimit;
}

function sanitizeDateKey(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return DATE_KEY_RE.test(value) ? value : undefined;
}

function buildDateRangeMatch(range?: CoachStatsRange): Record<string, string> | null {
  const startDate = sanitizeDateKey(range?.startDate);
  const endDate = sanitizeDateKey(range?.endDate);

  if (!startDate && !endDate) {
    return null;
  }

  const dateMatch: Record<string, string> = {};

  if (startDate) {
    dateMatch.$gte = startDate;
  }

  if (endDate) {
    dateMatch.$lte = endDate;
  }

  return dateMatch;
}

function formatStatsLabel(
  query: string | undefined,
  signals: CoachQuerySignals,
  range: CoachStatsRange
): string {
  if (signals.topicTerms.length > 0) {
    return signals.topicTerms.join(", ");
  }

  if (signals.resolvedCategories.length > 0) {
    return signals.resolvedCategories.join(" vs ");
  }

  if (query && normalizeText(query)) {
    return normalizeText(query);
  }

  if (range.startDate || range.endDate) {
    return "date-range";
  }

  return "all-logs";
}

function buildRetrievalQueryText(
  query: string,
  signals: CoachQuerySignals
): string {
  const parts = [`Query: ${query}`];

  if (signals.intentTags.length > 0) {
    parts.push(`Intent: ${signals.intentTags.join(", ")}`);
  }

  if (signals.resolvedCategories.length > 0) {
    parts.push(`Resolved categories: ${signals.resolvedCategories.join(", ")}`);
  }

  if (signals.topicTerms.length > 0) {
    parts.push(`Topic terms: ${signals.topicTerms.join(", ")}`);
  }

  return parts.join("\n");
}

function scoreDescending<T extends { score?: number }>(a: T, b: T): number {
  return (b.score ?? 0) - (a.score ?? 0);
}

function dateAscending<T extends { date: string; score?: number }>(a: T, b: T): number {
  const dateComparison = a.date.localeCompare(b.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return scoreDescending(a, b);
}

function dateDescending<T extends { date: string; score?: number }>(
  a: T,
  b: T
): number {
  const dateComparison = b.date.localeCompare(a.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  return scoreDescending(a, b);
}

function selectHistoricalLogs(
  logs: Array<CoachLogDocument & { score?: number }>,
  limit: number,
  signals: CoachQuerySignals
): Array<CoachLogDocument & { score?: number }> {
  const byScore = [...logs].sort(scoreDescending);

  if (!signals.intentTags.includes("journey")) {
    return byScore.slice(0, limit);
  }

  const pool = byScore.slice(0, Math.max(limit * 2, MIN_JOURNEY_MATCH_LIMIT + 2));
  const selected: Array<CoachLogDocument & { score?: number }> = [];
  const selectedIds = new Set<string>();

  const earliest = [...pool].sort(dateAscending)[0];
  const latest = [...pool].sort(dateDescending)[0];

  for (const candidate of [earliest, latest]) {
    if (!candidate) {
      continue;
    }

    const id = String(candidate._id);
    if (selectedIds.has(id)) {
      continue;
    }

    selected.push(candidate);
    selectedIds.add(id);
  }

  for (const candidate of pool) {
    if (selected.length >= limit) {
      break;
    }

    const id = String(candidate._id);
    if (selectedIds.has(id)) {
      continue;
    }

    selected.push(candidate);
    selectedIds.add(id);
  }

  return selected.sort(dateAscending).slice(0, limit);
}

async function loadUserCoachConfig(
  userId: string
): Promise<{ userCategories: UserCategory[]; aiProfile: StoredAIProfile }> {
  const user = await User.findById(userId)
    .select("categories aiProfile")
    .lean<UserCoachConfigDocument | null>();

  return {
    userCategories: user?.categories ?? [],
    aiProfile: getStoredAIProfile(user?.aiProfile),
  };
}

async function loadUserCategories(userId: string): Promise<UserCategory[]> {
  const user = await User.findById(userId)
    .select("categories")
    .lean<{ categories?: UserCategory[] } | null>();

  return user?.categories ?? [];
}

async function getBaselineStructuredStats(input: {
  userId: string;
  weekStartDateKey: string;
  todayDateKey: string;
}): Promise<CoachStructuredStats> {
  const userObjectId = new mongoose.Types.ObjectId(input.userId);
  const [facetResult] = await LogEntry.aggregate<{
    overview: Array<{
      totalLogs: number;
      totalHours: number;
      activeDates: string[];
      firstLogDate?: string;
      lastLogDate?: string;
    }>;
    byCategory: CoachCategoryStats[];
    weeklyByCategory: CoachCategoryStats[];
    today: Array<{ totalHours: number }>;
  }>([
    { $match: { userId: userObjectId } },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalLogs: { $sum: 1 },
              totalHours: { $sum: "$hours" },
              activeDates: { $addToSet: "$date" },
              firstLogDate: { $min: "$date" },
              lastLogDate: { $max: "$date" },
            },
          },
        ],
        byCategory: [
          {
            $group: {
              _id: "$category",
              totalLogs: { $sum: 1 },
              totalHours: { $sum: "$hours" },
              firstLogDate: { $min: "$date" },
              lastLogDate: { $max: "$date" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              totalLogs: 1,
              totalHours: 1,
              firstLogDate: 1,
              lastLogDate: 1,
            },
          },
          { $sort: { totalHours: -1, totalLogs: -1, category: 1 } },
        ],
        weeklyByCategory: [
          { $match: { date: { $gte: input.weekStartDateKey } } },
          {
            $group: {
              _id: "$category",
              totalLogs: { $sum: 1 },
              totalHours: { $sum: "$hours" },
              firstLogDate: { $min: "$date" },
              lastLogDate: { $max: "$date" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              totalLogs: 1,
              totalHours: 1,
              firstLogDate: 1,
              lastLogDate: 1,
            },
          },
          { $sort: { totalHours: -1, totalLogs: -1, category: 1 } },
        ],
        today: [
          { $match: { date: input.todayDateKey } },
          {
            $group: {
              _id: null,
              totalHours: { $sum: "$hours" },
            },
          },
        ],
      },
    },
  ]);

  const overview = facetResult?.overview?.[0];

  return {
    overview: {
      totalLogs: overview?.totalLogs ?? 0,
      totalHours: roundHours(overview?.totalHours ?? 0),
      activeDays: overview?.activeDates?.length ?? 0,
      firstLogDate: overview?.firstLogDate,
      lastLogDate: overview?.lastLogDate,
    },
    byCategory: (facetResult?.byCategory ?? []).map((item) => ({
      ...item,
      totalHours: roundHours(item.totalHours),
    })),
    weeklyByCategory: (facetResult?.weeklyByCategory ?? []).map((item) => ({
      ...item,
      totalHours: roundHours(item.totalHours),
    })),
    todayTotalHours: roundHours(facetResult?.today?.[0]?.totalHours ?? 0),
  };
}

export async function getBaselineCoachContext(input: {
  userId: string;
  timezone: string;
}): Promise<BaselineCoachContext> {
  await connectToDatabase();
  scheduleCoachEmbeddingBackfill(input.userId);

  const todayDateKey = getDateKeyInTimezone(input.timezone);
  const weekStartDateKey = getWeekStartDateKey(input.timezone);
  const [{ userCategories, aiProfile }, recentLogsRaw, structuredStats, commitments] =
    await Promise.all([
      loadUserCoachConfig(input.userId),
      LogEntry.find({ userId: input.userId })
        .sort({ loggedAt: -1, createdAt: -1 })
        .limit(MAX_RECENT_LOGS)
        .select("date hours category aiSummary rawTranscript loggedAt createdAt")
        .lean<Array<CoachLogDocument>>(),
      getBaselineStructuredStats({
        userId: input.userId,
        weekStartDateKey,
        todayDateKey,
      }),
      Commitment.find({
        userId: input.userId,
        weekStart: weekStartDateKey,
      }).lean<CommitmentSummary[]>(),
    ]);

  return {
    recentLogs: recentLogsRaw.map(toContextLog),
    structuredStats,
    weeklyCommitments: commitments,
    memoryContext: aiProfile.implicitMemory,
    aiProfile,
    userCategories,
    todayDateKey,
    weekStartDateKey,
  };
}

export async function searchHistoricalLogs(input: {
  userId: string;
  query: string;
  categories?: string[];
  limit?: number;
  excludeLogIds?: string[];
  availableCategories?: UserCategory[];
}): Promise<HistoricalSearchResult> {
  await connectToDatabase();
  scheduleCoachEmbeddingBackfill(input.userId);
  scheduleCoachVectorIndexEnsure();

  const userCategories =
    input.availableCategories ?? (await loadUserCategories(input.userId));
  const signals = buildCoachQuerySignals(
    input.query,
    userCategories,
    input.categories ?? []
  );
  const recentLogIds = new Set(input.excludeLogIds ?? []);
  const includeRecentMatches =
    signals.intentTags.includes("journey") || signals.intentTags.includes("timeline");
  const limit = clampHistoricalLimit(input.limit, signals);

  let queryEmbedding: number[] | null = null;
  try {
    const normalizedQuery = input.query.trim();
    if (normalizedQuery) {
      queryEmbedding = await createCoachEmbedding(
        buildRetrievalQueryText(normalizedQuery, signals),
        input.userId
      );
    }
  } catch (error) {
    console.warn("[COACH_QUERY_EMBEDDING_ERROR]", error);
  }

  const userObjectId = new mongoose.Types.ObjectId(input.userId);

  if (queryEmbedding) {
    try {
      const vectorFilter: Record<string, unknown> = { userId: userObjectId };
      if (signals.resolvedCategories.length > 0) {
        vectorFilter.category = { $in: signals.resolvedCategories };
      }

      const vectorResults = await LogEntry.aggregate<
        CoachLogDocument & { score?: number }
      >([
        {
          $vectorSearch: {
            index: COACH_VECTOR_INDEX_NAME,
            path: "coachEmbedding",
            queryVector: queryEmbedding,
            numCandidates: MAX_VECTOR_CANDIDATES,
            limit: Math.min(MAX_VECTOR_CANDIDATES, limit + MAX_RECENT_LOGS + 6),
            filter: vectorFilter,
          },
        },
        {
          $project: {
            _id: 1,
            date: 1,
            hours: 1,
            category: 1,
            aiSummary: 1,
            rawTranscript: 1,
            loggedAt: 1,
            createdAt: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ]);

      const rerankedVectorResults = vectorResults
        .filter(
          (log) =>
            includeRecentMatches || !recentLogIds.has(String(log._id))
        )
        .map((log) => ({
          ...log,
          score: (log.score ?? 0) + getRankingAdjustment(log, signals),
        }));

      const selectedVectorLogs = selectHistoricalLogs(
        rerankedVectorResults,
        limit,
        signals
      );

      if (selectedVectorLogs.length > 0) {
        const matches = selectedVectorLogs.map(toContextLog);
        return {
          query: input.query,
          resolvedCategories: signals.resolvedCategories,
          advisoryLabels: signals.advisoryLabels,
          searchPhrases: signals.searchPhrases,
          topicTerms: signals.topicTerms,
          intentTags: signals.intentTags,
          dateCoverage: buildDateCoverageFromDates({
            dates: matches.map((log) => log.date),
          }),
          matches,
          mode: "vector",
        };
      }
    } catch (error) {
      console.warn("[COACH_VECTOR_SEARCH_ERROR]", error);
    }

    const cosineCandidates = await LogEntry.find({
      userId: userObjectId,
      coachEmbeddingVersion: COACH_EMBEDDING_VERSION,
      embeddingDimensions: COACH_EMBEDDING_DIMENSIONS,
      ...(signals.resolvedCategories.length > 0
        ? { category: { $in: signals.resolvedCategories } }
        : {}),
    })
      .select(
        "date hours category aiSummary rawTranscript loggedAt createdAt coachEmbedding"
      )
      .lean<Array<CoachLogDocument>>();

    const rerankedCosineResults = cosineCandidates
      .filter(
        (log) =>
          Array.isArray(log.coachEmbedding) &&
          log.coachEmbedding.length === queryEmbedding.length &&
          (includeRecentMatches || !recentLogIds.has(String(log._id)))
      )
      .map((log) => ({
        ...log,
        score:
          cosineSimilarity(queryEmbedding, log.coachEmbedding as number[]) +
          getRankingAdjustment(log, signals),
      }));

    const selectedCosineLogs = selectHistoricalLogs(
      rerankedCosineResults,
      limit,
      signals
    );

    if (selectedCosineLogs.length > 0) {
      const matches = selectedCosineLogs.map(toContextLog);
      return {
        query: input.query,
        resolvedCategories: signals.resolvedCategories,
        advisoryLabels: signals.advisoryLabels,
        searchPhrases: signals.searchPhrases,
        topicTerms: signals.topicTerms,
        intentTags: signals.intentTags,
        dateCoverage: buildDateCoverageFromDates({
          dates: matches.map((log) => log.date),
        }),
        matches,
        mode: "cosine",
      };
    }
  }

  const fallbackFilter = buildRelevantFilter(signals);
  const fallbackQuery =
    fallbackFilter === null
      ? { userId: userObjectId }
      : { userId: userObjectId, ...fallbackFilter };

  const fallbackResults = await LogEntry.find(fallbackQuery)
    .sort({ loggedAt: -1, createdAt: -1 })
    .limit(limit + MAX_RECENT_LOGS)
    .select("date hours category aiSummary rawTranscript loggedAt createdAt")
    .lean<Array<CoachLogDocument>>();

  const selectedFallbackLogs = selectHistoricalLogs(
    fallbackResults
      .filter(
        (log) => includeRecentMatches || !recentLogIds.has(String(log._id))
      )
      .map((log) => ({
        ...log,
        score: getRankingAdjustment(log, signals),
      })),
    limit,
    signals
  );

  const fallbackMatches = selectedFallbackLogs.map(toContextLog);

  return {
    query: input.query,
    resolvedCategories: signals.resolvedCategories,
    advisoryLabels: signals.advisoryLabels,
    searchPhrases: signals.searchPhrases,
    topicTerms: signals.topicTerms,
    intentTags: signals.intentTags,
    dateCoverage: buildDateCoverageFromDates({
      dates: fallbackMatches.map((log) => log.date),
    }),
    matches: fallbackMatches,
    mode: "keyword",
  };
}

export async function getCoachStats(input: {
  userId: string;
  query?: string;
  categories?: string[];
  range?: CoachStatsRange;
  includeExamples?: boolean;
  availableCategories?: UserCategory[];
}): Promise<CoachStatsResult> {
  await connectToDatabase();

  const userCategories =
    input.availableCategories ?? (await loadUserCategories(input.userId));
  const normalizedQuery = input.query?.trim();
  const signals = buildCoachQuerySignals(
    normalizedQuery ?? "",
    userCategories,
    input.categories ?? []
  );
  const dateRange = {
    startDate: sanitizeDateKey(input.range?.startDate),
    endDate: sanitizeDateKey(input.range?.endDate),
  };
  const dateMatch = buildDateRangeMatch(dateRange);
  const userObjectId = new mongoose.Types.ObjectId(input.userId);

  const runStatsAggregation = async (matchStage: Record<string, unknown>) =>
    LogEntry.aggregate<{
      summary: Array<{
        matchedLogs: number;
        matchedHours: number;
        activeDates: string[];
        firstLogDate?: string;
        lastLogDate?: string;
      }>;
      byCategory: CoachCategoryStats[];
    }>([
      { $match: matchStage },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                matchedLogs: { $sum: 1 },
                matchedHours: { $sum: "$hours" },
                activeDates: { $addToSet: "$date" },
                firstLogDate: { $min: "$date" },
                lastLogDate: { $max: "$date" },
              },
            },
          ],
          byCategory: [
            {
              $group: {
                _id: "$category",
                totalLogs: { $sum: 1 },
                totalHours: { $sum: "$hours" },
                firstLogDate: { $min: "$date" },
                lastLogDate: { $max: "$date" },
              },
            },
            {
              $project: {
                _id: 0,
                category: "$_id",
                totalLogs: 1,
                totalHours: 1,
                firstLogDate: 1,
                lastLogDate: 1,
              },
            },
            { $sort: { totalHours: -1, totalLogs: -1, category: 1 } },
          ],
        },
      },
    ]);

  const loadRecentExamples = async (matchStage: Record<string, unknown>) => {
    if (!input.includeExamples) {
      return [];
    }

    return LogEntry.find(matchStage)
      .sort({ loggedAt: -1, createdAt: -1 })
      .limit(MAX_STATS_EXAMPLES)
      .select("date hours category aiSummary rawTranscript loggedAt createdAt")
      .lean<Array<CoachLogDocument>>();
  };

  const buildMatchStage = (
    filter: Record<string, unknown> | null
  ): Record<string, unknown> => {
    const matchStage: Record<string, unknown> = { userId: userObjectId };

    if (dateMatch) {
      matchStage.date = dateMatch;
    }

    if (filter) {
      Object.assign(matchStage, filter);
    }

    return matchStage;
  };

  let matchStage = buildMatchStage(buildRelevantFilter(signals));
  let [facetResult] = await runStatsAggregation(matchStage);

  let summary = facetResult?.summary?.[0];
  let matchStrategy: CoachStatsResult["matchStrategy"] = "strict";

  if (
    shouldUseCategoryOnlyStatsFallback(signals, summary?.matchedLogs ?? 0)
  ) {
    const broadMatchStage = buildMatchStage(buildCategoryOnlyFilter(signals));
    const [broadFacetResult] = await runStatsAggregation(broadMatchStage);
    const broadSummary = broadFacetResult?.summary?.[0];

    if ((broadSummary?.matchedLogs ?? 0) > (summary?.matchedLogs ?? 0)) {
      matchStage = broadMatchStage;
      facetResult = broadFacetResult;
      summary = broadSummary;
      matchStrategy = "category-range-fallback";
    }
  }

  const recentExamples = await loadRecentExamples(matchStage);

  const dateCoverage = buildDateCoverageFromDates({
    dates: summary?.activeDates ?? [],
    firstDate: summary?.firstLogDate,
    lastDate: summary?.lastLogDate,
  });

  return {
    label: formatStatsLabel(normalizedQuery, signals, dateRange),
    query: normalizedQuery,
    resolvedCategories: signals.resolvedCategories,
    advisoryLabels: signals.advisoryLabels,
    searchPhrases: signals.searchPhrases,
    topicTerms: signals.topicTerms,
    intentTags: signals.intentTags,
    matchStrategy,
    range: dateRange,
    dateCoverage,
    overview: {
      matchedLogs: summary?.matchedLogs ?? 0,
      matchedHours: roundHours(summary?.matchedHours ?? 0),
      activeDays: dateCoverage.activeDays,
      firstLogDate: dateCoverage.firstDate,
      lastLogDate: dateCoverage.lastDate,
    },
    byCategory: (facetResult?.byCategory ?? []).map((item) => ({
      ...item,
      totalHours: roundHours(item.totalHours),
    })),
    recentExamples: recentExamples.map(toContextLog),
  };
}
