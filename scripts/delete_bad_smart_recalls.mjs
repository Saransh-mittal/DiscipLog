import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SMART_RECALL_ELIGIBILITY_VERSION = 1;
const SMART_RECALL_MIN_CHARS = 45;
const SMART_RECALL_MIN_WORDS = 8;
const ROUTINE_STATUS_ONLY_RE =
  /\b(accepted|submitted|completed|continued|done|finished|wrapped up|practiced|attempted|reviewed|revised)\b/i;
const DURABLE_DETAIL_RE =
  /\b(because|so that|fixed|debug|bug|issue|root cause|learned|lesson|pattern|tradeoff|decision|approach|insight|heuristic|architecture|designed|implemented|refactor|optimized|why|how|using|with)\b/i;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getSourceText(log) {
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

function getWordCount(value) {
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

function getHardRejectReason(log) {
  const sourceText = getSourceText(log);

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

function chunk(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
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

  const cards = await smartRecallCards
    .find({}, { projection: { _id: 1, sourceLogId: 1, title: 1, status: 1 } })
    .toArray();

  if (cards.length === 0) {
    console.log("No Smart Recall cards found.");
    process.exit(0);
  }

  const sourceLogIds = Array.from(
    new Set(cards.map((card) => String(card.sourceLogId)))
  );
  const logsById = new Map();

  for (const ids of chunk(sourceLogIds, 200)) {
    const objectIds = ids
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (objectIds.length === 0) {
      continue;
    }

    const logs = await logEntries
      .find(
        { _id: { $in: objectIds } },
        {
          projection: {
            _id: 1,
            rawTranscript: 1,
            aiSummary: 1,
            category: 1,
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
  const sampleFindings = [];

  for (const card of cards) {
    const sourceLogId = String(card.sourceLogId);
    const log = logsById.get(sourceLogId);

    if (!log) {
      cardIdsToDelete.push(card._id);
      if (sampleFindings.length < 12) {
        sampleFindings.push({
          cardId: String(card._id),
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
      if (sampleFindings.length < 12) {
        sampleFindings.push({
          cardId: String(card._id),
          title: card.title,
          reason:
            eligibility.reason || "Source log is already marked ineligible.",
        });
      }
      continue;
    }

    const hardRejectReason = getHardRejectReason(log);

    if (!hardRejectReason) {
      continue;
    }

    cardIdsToDelete.push(card._id);
    logsToMarkIneligible.set(sourceLogId, hardRejectReason);

    if (sampleFindings.length < 12) {
      sampleFindings.push({
        cardId: String(card._id),
        title: card.title,
        reason: hardRejectReason,
      });
    }
  }

  console.log(`Scanned ${cards.length} Smart Recall cards.`);
  console.log(`Flagged ${cardIdsToDelete.length} cards for removal.`);
  console.log(`Flagged ${logsToMarkIneligible.size} logs for ineligible marking.`);

  if (sampleFindings.length > 0) {
    console.log("Sample findings:");
    for (const finding of sampleFindings) {
      console.log(`- ${finding.title} (${finding.cardId}): ${finding.reason}`);
    }
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete the flagged cards.");
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

  if (cardIdsToDelete.length > 0) {
    await smartRecallCards.deleteMany({
      _id: { $in: cardIdsToDelete },
    });
  }

  console.log("Applied Smart Recall cleanup.");
  process.exit(0);
}

run().catch((error) => {
  console.error("[DELETE_BAD_SMART_RECALLS_ERROR]", error);
  process.exit(1);
});
