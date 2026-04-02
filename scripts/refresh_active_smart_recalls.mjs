import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ACTIVE_STATUSES = ["due", "snoozed"];
const SMART_RECALL_ELIGIBILITY_VERSION = 1;
const SMART_RECALL_MIN_CHARS = 45;
const SMART_RECALL_MIN_WORDS = 8;
const SMART_RECALL_PAYLOAD_SUMMARY_CHARS = 520;
const SMART_RECALL_PAYLOAD_TRANSCRIPT_CHARS = 680;
const SMART_RECALL_PROMPT_MAX_CHARS = 320;
const SMART_RECALL_ANSWER_MAX_CHARS = 720;
const SMART_RECALL_WHY_MAX_CHARS = 220;
const GENERATION_BATCH_SIZE = 6;
const ROUTINE_STATUS_ONLY_RE =
  /\b(accepted|submitted|completed|continued|done|finished|wrapped up|practiced|attempted|reviewed|revised)\b/i;
const DURABLE_DETAIL_RE =
  /\b(because|so that|fixed|debug|bug|issue|root cause|learned|lesson|pattern|tradeoff|decision|approach|insight|heuristic|architecture|designed|implemented|refactor|optimized|why|how|using|with)\b/i;
const UNUSABLE_CARD_RE =
  /\b(no summary available|not enough information|insufficient detail|unclear|unknown)\b/i;

const generatedCardSchema = z.object({
  sourceLogId: z.string().min(1),
  title: z.string().min(3).max(80),
  prompt: z.string().min(8).max(SMART_RECALL_PROMPT_MAX_CHARS),
  answer: z.string().min(8).max(SMART_RECALL_ANSWER_MAX_CHARS),
  why: z.string().min(8).max(SMART_RECALL_WHY_MAX_CHARS),
  category: z.string().min(1).max(80),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rarity: z.enum(["spark", "forge", "boss"]),
});

const generatedResponseSchema = z.object({
  cards: z.array(generatedCardSchema),
});

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value, maxChars) {
  return normalizeWhitespace(value).slice(0, maxChars);
}

function roundHours(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getWordCount(value) {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function cleanJsonResponse(text) {
  return text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
}

function chunk(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

function getRecallSourceText(log) {
  const summary = normalizeWhitespace(log.aiSummary);
  const transcript = normalizeWhitespace(log.rawTranscript);

  if (summary && transcript) {
    if (summary === transcript) {
      return summary;
    }

    return normalizeWhitespace(`${summary}\n${transcript}`);
  }

  return summary || transcript;
}

function getHardRejectReason(log) {
  const sourceText = getRecallSourceText(log);

  if (!sourceText) {
    return "Log is empty, so there is nothing useful to recall.";
  }

  if (
    sourceText.length < SMART_RECALL_MIN_CHARS ||
    getWordCount(sourceText) < SMART_RECALL_MIN_WORDS
  ) {
    return "Log is too short to support a useful recall card.";
  }

  if (
    ROUTINE_STATUS_ONLY_RE.test(sourceText) &&
    !DURABLE_DETAIL_RE.test(sourceText)
  ) {
    return "Log is mostly a routine status update without reusable learning.";
  }

  return null;
}

function getRarityFromText(text) {
  if (/accepted|solved|fixed|shipped|completed|merged/i.test(text)) {
    return "boss";
  }

  if (/pattern|rule|heuristic|tradeoff|architecture|debug|lesson/i.test(text)) {
    return "forge";
  }

  return "spark";
}

function buildLogLabel(log) {
  const timestamp = log.loggedAt || log.createdAt;

  if (!timestamp) {
    return log.date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function buildPromptPayload(logs) {
  return logs
    .map((log, index) => {
      const summary =
        typeof log.aiSummary === "string" && log.aiSummary.trim()
          ? truncateText(log.aiSummary, SMART_RECALL_PAYLOAD_SUMMARY_CHARS)
          : "";
      const transcriptExcerpt =
        typeof log.rawTranscript === "string" && log.rawTranscript.trim()
          ? truncateText(log.rawTranscript, SMART_RECALL_PAYLOAD_TRANSCRIPT_CHARS)
          : "";

      return [
        `Log ${index + 1}`,
        `- sourceLogId: ${String(log._id)}`,
        `- date: ${log.date}`,
        `- label: ${buildLogLabel(log)}`,
        `- category: ${log.category}`,
        `- duration: ${roundHours(log.hours)}h`,
        `- aiSummary: ${summary || "No AI summary available."}`,
        `- transcriptExcerpt: ${transcriptExcerpt || "No transcript available."}`,
      ].join("\n");
    })
    .join("\n\n");
}

function isGeneratedCardUsable(card) {
  return !UNUSABLE_CARD_RE.test(`${card.answer} ${card.why}`);
}

async function generateReplacementCards(logs) {
  if (logs.length === 0) {
    return [];
  }

  const result = await generateText({
    model: openai("gpt-5-nano"),
    system: `You create smart recall cards for a productivity app.

Return ONLY valid JSON with this shape:
{"cards":[{"sourceLogId":"","title":"","prompt":"","answer":"","why":"","category":"","sourceDate":"YYYY-MM-DD","rarity":"spark|forge|boss"}]}

Rules:
- Create at most one card per sourceLogId.
- It is okay to omit a log entirely if it does not support a strong recall card.
- Use ONLY the provided log details. Do not invent facts.
- Skip routine status updates, thin progress blurbs, generic accepted/submitted notes, or anything without durable learning.
- Make prompts feel like active recall, not passive summaries.
- Prefer durable lessons: patterns, rules, fixes, tradeoffs, architecture moves, debugging lessons, or meaningful shipped outcomes.
- For dense logs, make the recall prompt correspondingly deeper. Ask about the full idea, approach, key decision, and outcome, not just a single isolated detail.
- Answers should feel complete. Cover the main understanding from the log in 2-5 crisp sentences, including the approach, important detail, and outcome when present.
- If the log spans multiple important points, synthesize them into one cohesive answer instead of a one-line fragment.
- "why" should explain why recalling this matters right now.
- Keep the tone sharp, useful, and lightly game-like, not cheesy.`,
    prompt: `Logs:
${buildPromptPayload(logs)}

Create strong smart recall cards now. JSON only.`,
  });

  const parsed = generatedResponseSchema.parse(
    JSON.parse(cleanJsonResponse(result.text))
  );
  const logsById = new Map(logs.map((log) => [String(log._id), log]));
  const seen = new Set();

  return parsed.cards.flatMap((card) => {
    if (seen.has(card.sourceLogId) || !isGeneratedCardUsable(card)) {
      return [];
    }

    const sourceLog = logsById.get(card.sourceLogId);

    if (!sourceLog) {
      return [];
    }

    seen.add(card.sourceLogId);

    return [
      {
        sourceLogId: card.sourceLogId,
        title: truncateText(card.title, 80),
        prompt: truncateText(card.prompt, SMART_RECALL_PROMPT_MAX_CHARS),
        answer: truncateText(card.answer, SMART_RECALL_ANSWER_MAX_CHARS),
        why: truncateText(card.why, SMART_RECALL_WHY_MAX_CHARS),
        category: sourceLog.category,
        sourceDate: sourceLog.date,
        rarity: card.rarity || getRarityFromText(card.answer),
      },
    ];
  });
}

async function run() {
  const apply = process.argv.includes("--apply");

  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI in .env.local");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const smartRecallCards = mongoose.connection.collection("smartrecallcards");
  const logEntries = mongoose.connection.collection("logentries");

  const activeCards = await smartRecallCards
    .find(
      { status: { $in: ACTIVE_STATUSES } },
      {
        projection: {
          _id: 1,
          userId: 1,
          sourceLogId: 1,
          title: 1,
          status: 1,
          dueAt: 1,
        },
      }
    )
    .toArray();

  if (activeCards.length === 0) {
    console.log("No active Smart Recall cards found.");
    process.exit(0);
  }

  const sourceLogIds = Array.from(
    new Set(
      activeCards
        .map((card) => String(card.sourceLogId))
        .filter((id) => mongoose.isValidObjectId(id))
    )
  );
  const logsById = new Map();

  for (const ids of chunk(sourceLogIds, 200)) {
    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    const logs = await logEntries
      .find(
        { _id: { $in: objectIds } },
        {
          projection: {
            _id: 1,
            userId: 1,
            date: 1,
            hours: 1,
            category: 1,
            rawTranscript: 1,
            aiSummary: 1,
            loggedAt: 1,
            createdAt: 1,
            smartRecallEligibility: 1,
          },
        }
      )
      .toArray();

    for (const log of logs) {
      logsById.set(String(log._id), log);
    }
  }

  const cardIdsToDelete = [];
  const logsToMarkIneligible = new Map();
  const validLogsToRegenerate = [];
  const sourceIdToCardId = new Map();
  const sampleDeletes = [];

  for (const card of activeCards) {
    const sourceLogId = String(card.sourceLogId);
    const log = logsById.get(sourceLogId);

    if (!log) {
      cardIdsToDelete.push(card._id);
      if (sampleDeletes.length < 8) {
        sampleDeletes.push({
          title: card.title,
          reason: "Source log is missing.",
        });
      }
      continue;
    }

    const eligibility = log.smartRecallEligibility || null;
    const explicitIneligible =
      eligibility &&
      eligibility.status === "ineligible" &&
      eligibility.version === SMART_RECALL_ELIGIBILITY_VERSION;

    if (explicitIneligible) {
      cardIdsToDelete.push(card._id);
      if (sampleDeletes.length < 8) {
        sampleDeletes.push({
          title: card.title,
          reason:
            eligibility.reason || "Source log is already marked ineligible.",
        });
      }
      continue;
    }

    const hardRejectReason = getHardRejectReason(log);

    if (hardRejectReason) {
      cardIdsToDelete.push(card._id);
      logsToMarkIneligible.set(sourceLogId, hardRejectReason);
      if (sampleDeletes.length < 8) {
        sampleDeletes.push({
          title: card.title,
          reason: hardRejectReason,
        });
      }
      continue;
    }

    validLogsToRegenerate.push(log);
    sourceIdToCardId.set(sourceLogId, card._id);
  }

  const replacementCards = [];
  const generationFailures = [];

  for (const batch of chunk(validLogsToRegenerate, GENERATION_BATCH_SIZE)) {
    try {
      const generated = await generateReplacementCards(batch);
      const generatedIds = new Set(generated.map((card) => card.sourceLogId));

      replacementCards.push(...generated);

      for (const log of batch) {
        const sourceLogId = String(log._id);
        if (!generatedIds.has(sourceLogId)) {
          generationFailures.push(sourceLogId);
        }
      }
    } catch (error) {
      for (const log of batch) {
        generationFailures.push(String(log._id));
      }
      console.warn("[REFRESH_ACTIVE_SMART_RECALLS_BATCH_ERROR]", error);
    }
  }

  const cardsToUpdate = replacementCards.filter((card) =>
    sourceIdToCardId.has(card.sourceLogId)
  );

  console.log(`Scanned ${activeCards.length} active Smart Recall cards.`);
  console.log(`Will update ${cardsToUpdate.length} active cards with deeper content.`);
  console.log(`Will delete ${cardIdsToDelete.length} weak or invalid active cards.`);
  console.log(`Will mark ${logsToMarkIneligible.size} logs as ineligible.`);
  console.log(
    `${generationFailures.length} active cards could not be regenerated and will be left unchanged.`
  );

  if (sampleDeletes.length > 0) {
    console.log("Sample removals:");
    for (const entry of sampleDeletes) {
      console.log(`- ${entry.title}: ${entry.reason}`);
    }
  }

  if (!apply) {
    console.log(
      "Dry run only. Re-run with --apply to update active cards and remove weak ones."
    );
    process.exit(0);
  }

  if (logsToMarkIneligible.size > 0) {
    await logEntries.bulkWrite(
      Array.from(logsToMarkIneligible.entries())
        .filter(([logId]) => mongoose.isValidObjectId(logId))
        .map(([logId, reason]) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(logId) },
            update: {
              $set: {
                smartRecallEligibility: {
                  status: "ineligible",
                  reason,
                  evaluatedAt: new Date(),
                  version: SMART_RECALL_ELIGIBILITY_VERSION,
                },
              },
            },
          },
        }))
    );
  }

  if (cardsToUpdate.length > 0) {
    await smartRecallCards.bulkWrite(
      cardsToUpdate.map((card) => ({
        updateOne: {
          filter: { _id: sourceIdToCardId.get(card.sourceLogId) },
          update: {
            $set: {
              title: card.title,
              prompt: card.prompt,
              answer: card.answer,
              why: card.why,
              category: card.category,
              sourceDate: card.sourceDate,
              rarity: card.rarity,
            },
          },
        },
      }))
    );
  }

  if (cardIdsToDelete.length > 0) {
    await smartRecallCards.deleteMany({
      _id: { $in: cardIdsToDelete },
    });
  }

  console.log("Applied active Smart Recall refresh.");
  process.exit(0);
}

run().catch((error) => {
  console.error("[REFRESH_ACTIVE_SMART_RECALLS_ERROR]", error);
  process.exit(1);
});
