import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function run() {
  const { default: connectToDatabase } = await import("../src/lib/mongoose");
  const { default: LogEntry } = await import("../src/models/LogEntry");
  const { refreshCoachEmbeddingForLog } = await import("../src/lib/coach-embeddings");

  console.log("Connecting to database...");
  await connectToDatabase();

  console.log("Finding all logs that need tags backfilled...");
  // Find logs that either don't have the tags array, or have it empty
  const logsToUpdate = await LogEntry.find({
    $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }],
  })
    .select("_id")
    .lean<{ _id: string }[]>();

  console.log(`Found ${logsToUpdate.length} logs to tag and re-embed.`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < logsToUpdate.length; i++) {
    const logId = String(logsToUpdate[i]._id);
    console.log(`[${i + 1}/${logsToUpdate.length}] Processing log: ${logId}`);
    try {
      await refreshCoachEmbeddingForLog(logId);
      successCount++;
    } catch (error) {
      console.error(`Failed to process log ${logId}:`, error);
      failureCount++;
    }
    
    // Add a slight delay to respect OpenAI rate limits (generates tags and embeddings)
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  console.log("--- Backfill Complete ---");
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  
  process.exit(0);
}

run().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
