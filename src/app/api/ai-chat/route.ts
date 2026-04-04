import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { authOptions } from "../auth/[...nextauth]/route";
import {
  buildCoachSystemPrompt,
  buildCoachTools,
  buildRecallSystemPrompt,
  getMessageText,
} from "@/lib/ai-chat-context";
import { resolveChatModel } from "@/lib/ai-models";
import { scheduleImplicitMemoryRefreshFromChat } from "@/lib/implicit-memory";
import { checkAIChatRateLimit } from "@/lib/rate-limit";
import connectToDatabase from "@/lib/mongoose";
import User from "@/models/User";
import type { SubscriptionPlan } from "@/models/User";
import ErrorLog from "@/models/ErrorLog";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    // Load user subscription from DB (never trust client)
    await connectToDatabase();
    const dbUser = await User.findById(userId)
      .select("subscription")
      .lean<{ subscription?: { plan?: string; preferredModel?: string } }>();

    const plan: SubscriptionPlan =
      (dbUser?.subscription?.plan as SubscriptionPlan) || "free";
    const dbPreferredModel = dbUser?.subscription?.preferredModel;

    // Apply Rate Limiting (plan-aware)
    const rateLimit = await checkAIChatRateLimit(userId, plan);
    if (!rateLimit.success) {
      return new NextResponse(
        "Service unavailable: You have reached the AI message limit for today. Please wait a bit before asking again.",
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimit.reset - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    const body = await req.json();
    const {
      messages = [],
      timezone,
      mode,
      recallCardId,
      preferredModel: clientPreferredModel,
    } = body;

    const userTimezone = timezone || "Asia/Kolkata";
    const typedMessages = messages as UIMessage[];

    // Resolve model — server validates against DB plan
    // Client can request a model, but DB's preferred model takes precedence
    // unless client explicitly overrides (and is pro)
    const effectivePreferredModel =
      plan === "pro"
        ? clientPreferredModel || dbPreferredModel || "gpt-5-mini"
        : undefined;
    const model = resolveChatModel(plan, effectivePreferredModel);

    // Pro models support reasoning — enable it for deeper analysis
    const proReasoningOptions =
      plan === "pro"
        ? {
            providerOptions: {
              openai: {
                reasoningEffort: "medium" as const,
                reasoningSummary: "auto" as const,
              },
            },
          }
        : {};

    // ── Branch by mode ────────────────────────────────────────
    if (mode === "recall") {
      // ── Recall Mode ─────────────────────────────────────────
      if (!recallCardId) {
        return new NextResponse("Missing recall card ID", { status: 400 });
      }

      const recallContext = await buildRecallSystemPrompt({
        userId,
        timezone: userTimezone,
        recallCardId,
        messages: typedMessages,
      });

      const modelMessages = await convertToModelMessages(
        recallContext.compactedMessages
      );

      const result = streamText({
        model,
        system: recallContext.systemPrompt,
        messages: modelMessages,
        ...proReasoningOptions,
        experimental_transform: smoothStream(),
      });

      return result.toUIMessageStreamResponse({
        originalMessages: typedMessages,
        sendReasoning: plan === "pro",
      });
    }

    // ── Coach Mode (default) ────────────────────────────────
    const promptContext = await buildCoachSystemPrompt({
      timezone: userTimezone,
      userId,
      messages: typedMessages,
    });

    const modelMessages = await convertToModelMessages(typedMessages);
    const recentLogIds = promptContext.baselineContext.recentLogs.map(
      (log) => log.id
    );

    const result = streamText({
      model,
      system: promptContext.systemPrompt,
      messages: modelMessages,
      toolChoice: "auto",
      stopWhen: stepCountIs(4),
      tools: buildCoachTools(
        userId,
        promptContext.baselineContext,
        recentLogIds
      ),
      ...proReasoningOptions,
      experimental_transform: smoothStream(),
      onFinish: () => {
        scheduleImplicitMemoryRefreshFromChat(userId, typedMessages);
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: typedMessages,
      sendReasoning: plan === "pro",
    });
  } catch (error: unknown) {
    console.error("[AI_CHAT_ERROR]", error);

    try {
      await connectToDatabase();
      await ErrorLog.create({
        environment: process.env.NODE_ENV || "unknown",
        context: "Server-AIChatAPI",
        errorMessage:
          error instanceof Error ? error.message : "Unknown AI Chat error",
        stackTrace:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.stack
              : "Unknown stack"
            : "Hidden in production",
      });
    } catch {}

    if (
      error instanceof Error &&
      error.message.includes("insufficient_quota")
    ) {
      return new NextResponse(
        "Service unavailable: OpenAI quota exceeded. Please check billing details.",
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message === "Recall card not found") {
      return new NextResponse("Recall card not found", { status: 404 });
    }

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(
        error instanceof Error
          ? error.message || error.stack || "Internal Error"
          : "Internal Error",
        { status: 500 }
      );
    }

    return new NextResponse("An anomaly occurred during chat.", {
      status: 500,
    });
  }
}
