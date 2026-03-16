import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { isValidLogCategory } from "@/lib/logs";

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

  if (!isValidLogCategory(category)) {
    throw new Error("Invalid category");
  }

  const prompt = `Transcript: "${text}"`;
  const system = `You are a productivity assistant summarizing a voice log for the category: "${category}".
CRITICAL INSTRUCTIONS:
1. Create a highly concise, bulleted summary of this work (max 3 bullets).
2. Output ONLY the final markdown bullets. Write absolutely NO intros, outros, or conversational text.
3. Do NOT output your internal reasoning, thought process, or 'Deconstruct the Request' steps. Start immediately with the first bullet point.`;

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
