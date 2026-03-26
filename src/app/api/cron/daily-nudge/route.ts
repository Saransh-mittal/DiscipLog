import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import connectToDatabase from "@/lib/mongoose";
import {
  getExpectedLogHour,
  getDeviationWindow,
  NEW_USER_EARLY_SPARK_HOUR,
  NEW_USER_EVENING_CHECK_HOUR,
  type UsagePattern,
} from "@/lib/usage-patterns";
import { getBaselineCoachContext } from "@/lib/coach-context";
import { getPersonaOption, getStoredAIProfile } from "@/lib/ai-profile";
import { getDateKeyInTimezone, getZonedDateContext } from "@/lib/logs";
import { sendPushToUser, type PushPayload } from "@/lib/push-service";
import User from "@/models/User";
import LogEntry from "@/models/LogEntry";
import Nudge, { type NudgeTier } from "@/models/Nudge";
import PushSubscription from "@/models/PushSubscription";

const MAX_LLM_NUDGES_PER_RUN = 20;

const TIER_PROMPTS: Record<string, string> = {
  warmup:
    "Write a short, light, anticipatory message (1-2 sentences). Tone: warm energy boost. The user's best logging window is approaching. Do not be pushy — frame it as an exciting window opening up.",
  core:
    "Write a short, direct friction-breaking message (1-2 sentences). The user has missed their expected logging time. Acknowledge the delay, reference their goal, and push for immediate action. Match the persona tone.",
  last_call:
    "Write a short, urgent but supportive last-call message (1-2 sentences). The day is almost over. Even 15 minutes matters. Frame it as a final chance to maintain streak/momentum. Do not guilt-trip.",
  early_spark:
    "Write a short, gentle introductory nudge (1-2 sentences). This is a new user who hasn't logged today yet. Be welcoming, frame logging as easy and fast. Suggest starting with just a quick session.",
  evening_check:
    "Write a short accountability check-in (1-2 sentences). This new user hasn't logged today. Evening is here — frame even a small log as a win for building the habit.",
};

const TIER_CTA: Record<string, { label: string; url: string }> = {
  warmup: { label: "Open Dashboard", url: "/dashboard" },
  core: { label: "Log Now", url: "/dashboard" },
  last_call: { label: "Quick 15-min Sprint", url: "/dashboard" },
  early_spark: { label: "Start Logging", url: "/dashboard" },
  evening_check: { label: "Log a Quick Win", url: "/dashboard" },
};

interface NudgeCandidate {
  userId: string;
  tier: NudgeTier;
  dateKey: string;
  timezone: string;
}

function validateCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

function getCurrentHourInTimezone(timezone: string): number {
  const context = getZonedDateContext(new Date(), timezone);
  return Number(context.hour) + Number(context.minute) / 60;
}

function getMonToSunDayIndex(timezone: string): number {
  const weekday = getZonedDateContext(new Date(), timezone).weekday;
  const map: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };
  return map[weekday] ?? 0;
}

async function hasLoggedToday(userId: string, dateKey: string): Promise<boolean> {
  const count = await LogEntry.countDocuments({ userId, date: dateKey });
  return count > 0;
}

async function hasNudgeForTier(
  userId: string,
  dateKey: string,
  tier: NudgeTier
): Promise<boolean> {
  const existing = await Nudge.findOne({ userId, dateKey, tier }).lean();
  return !!existing;
}

function getEstablishedUserTiers(
  expectedHour: number,
  deviationWindow: number,
  currentHour: number
): NudgeTier[] {
  const tiers: NudgeTier[] = [];

  // Warmup: 2 hours before expected
  const warmupHour = expectedHour - 2;
  if (currentHour >= warmupHour && currentHour < expectedHour) {
    tiers.push("warmup");
  }

  // Core: after expected + deviation
  const coreHour = expectedHour + deviationWindow;
  if (currentHour >= coreHour) {
    tiers.push("core");
  }

  // Last call: 4 hours after expected, max 22:00
  const lastCallHour = Math.min(expectedHour + 4, 22);
  if (currentHour >= lastCallHour && currentHour <= 22) {
    tiers.push("last_call");
  }

  return tiers;
}

function getNewUserTiers(currentHour: number): NudgeTier[] {
  const tiers: NudgeTier[] = [];

  if (currentHour >= NEW_USER_EARLY_SPARK_HOUR) {
    tiers.push("early_spark");
  }

  if (currentHour >= NEW_USER_EVENING_CHECK_HOUR) {
    tiers.push("evening_check");
  }

  return tiers;
}

async function generateNudgeMessage(
  userId: string,
  tier: NudgeTier,
  timezone: string
): Promise<string> {
  try {
    const [baselineContext, user] = await Promise.all([
      getBaselineCoachContext({ userId, timezone }),
      User.findById(userId).select("aiProfile").lean<{ aiProfile?: unknown } | null>(),
    ]);

    const profile = getStoredAIProfile(user?.aiProfile);
    const persona = getPersonaOption(profile.persona);

    const result = await generateText({
      model: openai("gpt-5-nano"),
      system: `You are ${persona.label}, an AI productivity coach. ${persona.promptInstructions}\n\nIMPORTANT: Return ONLY the nudge message text. No quotes, no labels, no JSON. Just the raw message (1-2 sentences max).`,
      prompt: `${TIER_PROMPTS[tier]}

User's core motivation: ${profile.coreWhy || "Not specified"}
Today's logged hours so far: ${baselineContext.structuredStats.todayTotalHours}h
Streak days: ${baselineContext.recentLogs.length > 0 ? "active" : "at risk"}
Implicit memory: ${baselineContext.memoryContext || "None yet"}

Generate the nudge now. Raw text only.`,
    });

    return result.text.trim().replace(/^["']|["']$/g, "");
  } catch (error) {
    console.error("[NUDGE_LLM_ERROR]", error);
    // Fallback messages
    const fallbacks: Record<string, string> = {
      warmup: "Your best focus window is coming up. Ready to make it count?",
      core: "You usually log by now. Even a quick 15-minute sprint keeps the streak alive.",
      last_call: "Day's almost over. Even one small log keeps your momentum going.",
      early_spark: "Hey! Ready to log your first session today? Even 15 minutes counts.",
      evening_check: "Evening check-in — a quick log now builds the habit for tomorrow.",
    };
    return fallbacks[tier] || "Time to log some progress!";
  }
}

export async function POST(req: Request) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    // Find all users who have at least one push subscription
    const subscribedUserIds = await PushSubscription.distinct("userId");

    if (subscribedUserIds.length === 0) {
      return NextResponse.json({
        processed: 0,
        nudgesSent: 0,
        message: "No users with push subscriptions",
      });
    }

    // Load users with their usage patterns
    const users = await User.find({
      _id: { $in: subscribedUserIds },
    })
      .select("usagePattern aiProfile")
      .lean<
        Array<{
          _id: unknown;
          usagePattern?: UsagePattern;
          aiProfile?: unknown;
        }>
      >();

    const candidates: NudgeCandidate[] = [];

    for (const user of users) {
      const userId = String(user._id);
      const pattern = user.usagePattern || {
        avgLogHour: null,
        dayOfWeekAvgHour: Array(7).fill(null),
        sampleSize: 0,
        lastCalculatedAt: null,
        inferredTimezone: "Asia/Kolkata",
      };

      const timezone = pattern.inferredTimezone || "Asia/Kolkata";
      const dateKey = getDateKeyInTimezone(timezone);
      const currentHour = getCurrentHourInTimezone(timezone);
      const dayOfWeek = getMonToSunDayIndex(timezone);

      // Skip if already logged today
      if (await hasLoggedToday(userId, dateKey)) continue;

      let eligibleTiers: NudgeTier[];

      if (pattern.sampleSize >= 3) {
        // Established user — pattern-aware tiers
        const expectedHour = getExpectedLogHour(pattern, dayOfWeek);
        if (expectedHour === null) continue;

        const deviationWindow = getDeviationWindow(pattern.sampleSize);
        eligibleTiers = getEstablishedUserTiers(expectedHour, deviationWindow, currentHour);
      } else {
        // New user — default tiers
        eligibleTiers = getNewUserTiers(currentHour);
      }

      for (const tier of eligibleTiers) {
        if (!(await hasNudgeForTier(userId, dateKey, tier))) {
          candidates.push({ userId, tier, dateKey, timezone });
        }
      }
    }

    // Process candidates (with LLM limit)
    let nudgesSent = 0;
    const llmCandidates = candidates.slice(0, MAX_LLM_NUDGES_PER_RUN);

    for (const candidate of llmCandidates) {
      try {
        // Double-check they haven't logged in the meantime
        if (await hasLoggedToday(candidate.userId, candidate.dateKey)) continue;

        const message = await generateNudgeMessage(
          candidate.userId,
          candidate.tier,
          candidate.timezone
        );

        const cta = TIER_CTA[candidate.tier] || TIER_CTA.core;
        const profile = getStoredAIProfile(
          (await User.findById(candidate.userId).select("aiProfile").lean<{ aiProfile?: unknown } | null>())?.aiProfile
        );
        const persona = getPersonaOption(profile.persona);

        // Save nudge to DB
        await Nudge.create({
          userId: candidate.userId,
          dateKey: candidate.dateKey,
          type: candidate.tier === "early_spark" || candidate.tier === "evening_check"
            ? "daily_reminder"
            : "friction_break",
          tier: candidate.tier,
          message,
          ctaLabel: cta.label,
          ctaUrl: cta.url,
          deliveredViaPush: true,
        });

        // Send push notification
        const payload: PushPayload = {
          title: persona.label,
          body: message,
          data: {
            url: cta.url,
            type: "friction_break",
            tier: candidate.tier,
          },
          actions: [
            { action: "open", title: cta.label },
            { action: "snooze", title: "Snooze 1h" },
          ],
        };

        await sendPushToUser(candidate.userId, payload);
        nudgesSent++;
      } catch (error) {
        console.error(`[NUDGE_SEND_ERROR] userId=${candidate.userId} tier=${candidate.tier}`, error);
      }
    }

    return NextResponse.json({
      processed: users.length,
      candidates: candidates.length,
      nudgesSent,
      message: `Processed ${users.length} users, sent ${nudgesSent} nudges`,
    });
  } catch (error) {
    console.error("[DAILY_NUDGE_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
