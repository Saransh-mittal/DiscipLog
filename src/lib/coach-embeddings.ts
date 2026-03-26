import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import type { SearchIndexDescription } from "mongodb";
import connectToDatabase from "@/lib/mongoose";
import LogEntry from "@/models/LogEntry";

export const COACH_EMBEDDING_MODEL = "text-embedding-3-small";
export const COACH_EMBEDDING_DIMENSIONS = 512;
export const COACH_EMBEDDING_VERSION = 1;
export const COACH_VECTOR_INDEX_NAME =
  process.env.MONGODB_COACH_VECTOR_INDEX_NAME || "coach_log_embedding_v1";

const MAX_SUMMARY_CHARS = 900;
const MAX_TRANSCRIPT_CHARS = 420;
const DEFAULT_BACKFILL_LIMIT = 24;
const INDEX_SETUP_COOLDOWN_MS = 60 * 1000;

interface EmbeddableLog {
  _id: unknown;
  userId: unknown;
  date?: string;
  hours?: number;
  category?: string;
  aiSummary?: string | null;
  rawTranscript?: string | null;
}

const queuedLogRefreshes = new Set<string>();
const queuedBackfills = new Set<string>();
let coachVectorIndexReady = false;
let coachVectorIndexPromise: Promise<void> | null = null;
let lastIndexSetupAttemptAt = 0;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxChars: number): string {
  return normalizeWhitespace(value).slice(0, maxChars);
}

export function buildCoachRetrievalText(log: EmbeddableLog): string {
  const summary =
    typeof log.aiSummary === "string" ? truncateText(log.aiSummary, MAX_SUMMARY_CHARS) : "";
  const transcript =
    typeof log.rawTranscript === "string"
      ? truncateText(log.rawTranscript, MAX_TRANSCRIPT_CHARS)
      : "";

  const details = [
    `Category: ${log.category || "Unknown"}`,
    `Date: ${log.date || "Unknown"}`,
    `Hours: ${typeof log.hours === "number" ? log.hours : "Unknown"}`,
  ];

  if (summary) {
    details.push(`Summary: ${summary}`);
  } else if (transcript) {
    details.push(`Transcript excerpt: ${transcript}`);
  } else {
    details.push("Summary: No summary available.");
  }

  return details.join("\n");
}

function getCoachVectorIndexDescription(): SearchIndexDescription {
  return {
    name: COACH_VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "coachEmbedding",
          numDimensions: COACH_EMBEDDING_DIMENSIONS,
          similarity: "cosine",
        },
        { type: "filter", path: "userId" },
        { type: "filter", path: "category" },
        { type: "filter", path: "date" },
      ],
    },
  };
}

export async function createCoachEmbedding(
  value: string,
  userId?: string
): Promise<number[]> {
  const result = await embed({
    model: openai.embedding(COACH_EMBEDDING_MODEL),
    value,
    providerOptions: {
      openai: {
        dimensions: COACH_EMBEDDING_DIMENSIONS,
        user: userId,
      },
    },
    maxRetries: 1,
  });

  return result.embedding;
}

async function ensureCoachVectorIndex(): Promise<void> {
  if (coachVectorIndexReady) {
    return;
  }

  const now = Date.now();
  if (coachVectorIndexPromise || now - lastIndexSetupAttemptAt < INDEX_SETUP_COOLDOWN_MS) {
    return coachVectorIndexPromise ?? Promise.resolve();
  }

  lastIndexSetupAttemptAt = now;
  coachVectorIndexPromise = (async () => {
    try {
      await connectToDatabase();

      const existingIndexes = (await LogEntry.listSearchIndexes()) as Array<{
        name?: string;
        type?: string;
      }>;
      const existingIndex = existingIndexes.find(
        (index) => index.name === COACH_VECTOR_INDEX_NAME
      );
      const description = getCoachVectorIndexDescription();

      if (!existingIndex) {
        await LogEntry.createSearchIndex(description);
      } else if (existingIndex.type !== "vectorSearch") {
        await LogEntry.updateSearchIndex(
          COACH_VECTOR_INDEX_NAME,
          description.definition
        );
      }

      coachVectorIndexReady = true;
    } catch (error) {
      console.warn("[COACH_VECTOR_INDEX_SETUP_ERROR]", error);
    } finally {
      coachVectorIndexPromise = null;
    }
  })();

  return coachVectorIndexPromise;
}

export async function refreshCoachEmbeddingForLog(logId: string): Promise<void> {
  try {
    await connectToDatabase();

    const log = await LogEntry.findById(logId)
      .select("userId date hours category aiSummary rawTranscript")
      .lean<EmbeddableLog | null>();

    if (!log) {
      return;
    }

    const embeddingText = buildCoachRetrievalText(log);
    const embedding = await createCoachEmbedding(embeddingText, String(log.userId));

    await LogEntry.findByIdAndUpdate(logId, {
      $set: {
        coachEmbedding: embedding,
        embeddingModel: COACH_EMBEDDING_MODEL,
        embeddingDimensions: COACH_EMBEDDING_DIMENSIONS,
        embeddingUpdatedAt: new Date(),
        coachEmbeddingVersion: COACH_EMBEDDING_VERSION,
      },
    });

    void ensureCoachVectorIndex();
  } catch (error) {
    console.error("[COACH_EMBEDDING_REFRESH_ERROR]", error);
  }
}

export async function backfillCoachEmbeddingsForUser(
  userId: string,
  limit = DEFAULT_BACKFILL_LIMIT
): Promise<void> {
  try {
    await connectToDatabase();

    const logsToBackfill = await LogEntry.find({
      userId,
      $or: [
        { coachEmbedding: { $exists: false } },
        { coachEmbeddingVersion: { $ne: COACH_EMBEDDING_VERSION } },
        { embeddingModel: { $ne: COACH_EMBEDDING_MODEL } },
        { embeddingDimensions: { $ne: COACH_EMBEDDING_DIMENSIONS } },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .select("_id")
      .lean<Array<{ _id: unknown }>>();

    if (logsToBackfill.length === 0) {
      void ensureCoachVectorIndex();
      return;
    }

    for (const log of logsToBackfill) {
      await refreshCoachEmbeddingForLog(String(log._id));
    }
  } catch (error) {
    console.error("[COACH_EMBEDDING_BACKFILL_ERROR]", error);
  }
}

export function scheduleCoachEmbeddingRefreshForLog(logId: string): void {
  if (queuedLogRefreshes.has(logId)) {
    return;
  }

  queuedLogRefreshes.add(logId);
  queueMicrotask(() => {
    void refreshCoachEmbeddingForLog(logId).finally(() => {
      queuedLogRefreshes.delete(logId);
    });
  });
}

export function scheduleCoachEmbeddingBackfill(userId: string): void {
  if (queuedBackfills.has(userId)) {
    return;
  }

  queuedBackfills.add(userId);
  queueMicrotask(() => {
    void backfillCoachEmbeddingsForUser(userId).finally(() => {
      queuedBackfills.delete(userId);
    });
  });
}

export function scheduleCoachVectorIndexEnsure(): void {
  void ensureCoachVectorIndex();
}
