import { openai } from "@ai-sdk/openai";
import type { SubscriptionPlan, ProModelChoice } from "@/models/User";

// ── Model Constants ──────────────────────────────────────────
const FREE_CHAT_MODEL = "gpt-5-nano" as const;
const VALID_PRO_MODELS: readonly ProModelChoice[] = ["gpt-5-mini", "gpt-5"] as const;

/**
 * Resolve which OpenAI model to use for interactive chat.
 *
 * Server always validates against the DB plan — never trusts client input.
 * Free users always get nano. Pro users get their preferred model.
 */
export function resolveChatModel(
  plan: SubscriptionPlan,
  preferredModel?: string
) {
  if (plan === "pro" && preferredModel && isValidProModel(preferredModel)) {
    return openai(preferredModel);
  }

  if (plan === "pro") {
    // Pro without a valid preference defaults to gpt-5-mini
    return openai("gpt-5-mini");
  }

  return openai(FREE_CHAT_MODEL);
}

/**
 * Get the model name string (for logging / client display).
 */
export function resolveChatModelName(
  plan: SubscriptionPlan,
  preferredModel?: string
): string {
  if (plan === "pro" && preferredModel && isValidProModel(preferredModel)) {
    return preferredModel;
  }

  if (plan === "pro") {
    return "gpt-5-mini";
  }

  return FREE_CHAT_MODEL;
}

function isValidProModel(model: string): model is ProModelChoice {
  return (VALID_PRO_MODELS as readonly string[]).includes(model);
}
