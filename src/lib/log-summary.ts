import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

interface GenerateLogSummaryInput {
  text: string;
  category: string;
}

export async function generateLogSummary({
  text,
  category,
}: GenerateLogSummaryInput): Promise<string> {
  if (!text.trim()) {
    throw new Error("Missing text");
  }

  if (!category || !category.trim()) {
    throw new Error("Invalid category");
  }

  const prompt = `Transcript: "${text}"`;
  const system = `You are a productivity assistant summarizing a voice log for the category: "${category}".
CRITICAL INSTRUCTIONS:
1. Create a direct, concise bulleted summary of the provided transcript.
2. Write in a neutral, imperative tone as if these are standard work notes (e.g., "Solved Longest Substring...", "Need to increase vector size...").
3. DO NOT write from a third-party observer perspective (avoid phrases like "Discussed solving..." or "Acknowledged that..."). Do not refer to the user in the third person.
4. The length of the summary should directly reflect the length of the input. For short transcripts, 1-2 bullets are sufficient.
5. Keep the summary focused on the actual content. Do NOT invent context unless explicitly stated.
6. Output ONLY the final markdown bullets. Write absolutely NO intros, outros, or conversational text. Start immediately with the first bullet.`;

  const result = await generateText({
    model: openai("gpt-5-nano"),
    system,
    prompt,
  });

  const summary = result.text.trim();

  if (!summary) {
    throw new Error("Empty summary generated");
  }

  return summary;
}
