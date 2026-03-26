import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import connectToDatabase from "@/lib/mongoose";
import { getPersonaOption, getStoredAIProfile } from "@/lib/ai-profile";
import { sendPushToUser } from "@/lib/push-service";
import User from "@/models/User";
import LogEntry from "@/models/LogEntry";
import WeeklyDebrief from "@/models/WeeklyDebrief";
import PushSubscription from "@/models/PushSubscription";

function validateCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function getWeekRange(): { weekStartDate: string; weekEndDate: string; startDate: Date; endDate: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const format = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return {
    weekStartDate: format(monday),
    weekEndDate: format(sunday),
    startDate: monday,
    endDate: sunday,
  };
}

function getPreviousWeekRange(): { weekStartDate: string; weekEndDate: string; startDate: Date; endDate: Date } {
  const current = getWeekRange();
  const prevMonday = new Date(current.startDate);
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
  prevSunday.setUTCHours(23, 59, 59, 999);

  const format = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return { weekStartDate: format(prevMonday), weekEndDate: format(prevSunday), startDate: prevMonday, endDate: prevSunday };
}

interface LogDoc {
  date: string;
  hours: number;
  category: string;
  rawTranscript: string;
  aiSummary?: string;
}

function computeMetrics(logs: LogDoc[], categories: Array<{ name: string; weeklyMinTarget: number }>) {
  const totalHours = roundHours(logs.reduce((s, l) => s + l.hours, 0));
  const totalLogs = logs.length;

  // Best day
  const dayHours: Record<string, number> = {};
  for (const log of logs) {
    dayHours[log.date] = (dayHours[log.date] || 0) + log.hours;
  }

  let bestDay = { date: "", hours: 0 };
  for (const [date, hours] of Object.entries(dayHours)) {
    if (hours > bestDay.hours) {
      bestDay = { date, hours: roundHours(hours) };
    }
  }

  // Consistency: days with >= 1 log out of 7
  const activeDays = Object.keys(dayHours).length;
  const consistencyPercent = Math.round((activeDays / 7) * 100);

  // Category breakdown
  const catHours: Record<string, { hours: number; logCount: number }> = {};
  for (const log of logs) {
    if (!catHours[log.category]) {
      catHours[log.category] = { hours: 0, logCount: 0 };
    }
    catHours[log.category].hours += log.hours;
    catHours[log.category].logCount++;
  }

  const categoryBreakdown = Object.entries(catHours).map(([name, data]) => {
    const target = categories.find((c) => c.name === name);
    return {
      name,
      hours: roundHours(data.hours),
      logCount: data.logCount,
      targetHit: target ? data.hours >= target.weeklyMinTarget : false,
      prevWeekHours: null as number | null,
    };
  });

  // MVP: highest % over target
  let mvpCategory = "";
  let mvpScore = -Infinity;
  for (const cat of categoryBreakdown) {
    const target = categories.find((c) => c.name === cat.name);
    if (target && target.weeklyMinTarget > 0) {
      const pctOver = (cat.hours - target.weeklyMinTarget) / target.weeklyMinTarget;
      if (pctOver > mvpScore) {
        mvpScore = pctOver;
        mvpCategory = cat.name;
      }
    }
  }

  return { totalHours, totalLogs, bestDay, consistencyPercent, categoryBreakdown, mvpCategory };
}

async function generateDebriefContent(input: {
  metrics: ReturnType<typeof computeMetrics>;
  personaLabel: string;
  personaInstructions: string;
  coreWhy: string;
  implicitMemory: string;
  logs: LogDoc[];
}): Promise<{ weekTitle: string; coachNote: string; hardestDay: string; challengeForNextWeek: string }> {
  const logSummary = input.logs
    .slice(0, 20)
    .map((l) => `- ${l.date} | ${l.category} | ${roundHours(l.hours)}h | ${(l.aiSummary || l.rawTranscript).slice(0, 120)}`)
    .join("\n");

  const catSummary = input.metrics.categoryBreakdown
    .map((c) => `- ${c.name}: ${c.hours}h across ${c.logCount} logs${c.targetHit ? " ✓" : ""}${c.prevWeekHours !== null ? ` (prev: ${c.prevWeekHours}h)` : ""}`)
    .join("\n");

  try {
    const result = await generateText({
      model: openai("gpt-5-nano"),
      system: `You are ${input.personaLabel}, an AI productivity coach. ${input.personaInstructions}

Return ONLY valid JSON with this shape:
{"weekTitle":"","coachNote":"","hardestDay":"","challengeForNextWeek":""}

Rules:
- weekTitle: A dramatic, inspiring 3-6 word title for this week (e.g., "The Relentless Push", "Silent Momentum")
- coachNote: 2-3 paragraphs reflecting on the week. Acknowledge their biggest win and their hardest day. Be specific, grounded in the data. Match your persona tone.
- hardestDay: 1-2 sentences acknowledging the toughest day (lowest output or a skip) and framing it positively.
- challengeForNextWeek: 1 concrete, achievable micro-challenge for next week based on this week's gaps or trends.
- Do NOT invent facts. Use only the provided data.`,
      prompt: `Week: ${input.metrics.bestDay.date ? input.metrics.bestDay.date.slice(0, 7) : "this week"}
Total hours: ${input.metrics.totalHours}h
Total logs: ${input.metrics.totalLogs}
Best day: ${input.metrics.bestDay.date} (${input.metrics.bestDay.hours}h)
Consistency: ${input.metrics.consistencyPercent}%
MVP category: ${input.metrics.mvpCategory || "None"}
Core why: ${input.coreWhy || "Not specified"}
Implicit memory: ${input.implicitMemory || "None"}

Category breakdown:
${catSummary}

Sample logs:
${logSummary}

Generate the weekly debrief now. JSON only.`,
    });

    const cleaned = result.text.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned);

    return {
      weekTitle: typeof parsed.weekTitle === "string" ? parsed.weekTitle.slice(0, 60) : "This Week in Review",
      coachNote: typeof parsed.coachNote === "string" ? parsed.coachNote.slice(0, 1500) : "",
      hardestDay: typeof parsed.hardestDay === "string" ? parsed.hardestDay.slice(0, 300) : "",
      challengeForNextWeek: typeof parsed.challengeForNextWeek === "string" ? parsed.challengeForNextWeek.slice(0, 300) : "",
    };
  } catch (error) {
    console.error("[DEBRIEF_LLM_ERROR]", error);
    return {
      weekTitle: "This Week in Review",
      coachNote: `You logged ${input.metrics.totalHours}h across ${input.metrics.totalLogs} sessions this week with a ${input.metrics.consistencyPercent}% consistency rate.`,
      hardestDay: "",
      challengeForNextWeek: "",
    };
  }
}

export async function POST(req: Request) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const url = new URL(req.url);
    const target = url.searchParams.get("target");

    let activeRange = getWeekRange();
    let compareRange: { weekStartDate: string; weekEndDate: string; startDate: Date; endDate: Date } = getPreviousWeekRange();

    if (target === "previous") {
      activeRange = getPreviousWeekRange();
      
      const prevPrevMonday = new Date(activeRange.startDate);
      prevPrevMonday.setUTCDate(prevPrevMonday.getUTCDate() - 7);
      const prevPrevSunday = new Date(prevPrevMonday);
      prevPrevSunday.setUTCDate(prevPrevMonday.getUTCDate() + 6);
      prevPrevSunday.setUTCHours(23, 59, 59, 999);

      const format = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      compareRange = { 
        weekStartDate: format(prevPrevMonday), 
        weekEndDate: format(prevPrevSunday),
        startDate: prevPrevMonday, 
        endDate: prevPrevSunday 
      };
    }

    const { weekStartDate, weekEndDate, startDate, endDate } = activeRange;
    const prevWeek = compareRange;

    // Find all users with at least 1 log this week
    const userIdsWithLogs = await LogEntry.distinct("userId", {
      date: { $gte: weekStartDate, $lte: weekEndDate },
    });

    if (userIdsWithLogs.length === 0) {
      return NextResponse.json({ processed: 0, debriefs: 0, message: "No users with logs this week" });
    }

    // Filter out users who already have a debrief this week
    const existingDebriefs = await WeeklyDebrief.find({
      userId: { $in: userIdsWithLogs },
      weekStartDate,
    })
      .select("userId")
      .lean();

    const existingUserIds = new Set(existingDebriefs.map((d) => String(d.userId)));
    const eligibleUserIds = userIdsWithLogs
      .map(String)
      .filter((id) => !existingUserIds.has(id));

    let debriefCount = 0;

    for (const userId of eligibleUserIds) {
      try {
        // Fetch this week's logs
        const logs = await LogEntry.find({
          userId,
          date: { $gte: weekStartDate, $lte: weekEndDate },
        })
          .sort({ date: 1, loggedAt: 1 })
          .select("date hours category rawTranscript aiSummary")
          .lean<LogDoc[]>();

        if (logs.length === 0) continue;

        // Fetch user info
        const user = await User.findById(userId)
          .select("aiProfile categories")
          .lean<{ aiProfile?: unknown; categories?: Array<{ name: string; weeklyMinTarget: number }> } | null>();

        if (!user) continue;

        const profile = getStoredAIProfile(user.aiProfile);
        const persona = getPersonaOption(profile.persona);
        const categories = user.categories || [];

        const metrics = computeMetrics(logs, categories);

        // Get previous week data for trend arrows
        const prevLogs = await LogEntry.find({
          userId,
          date: { $gte: prevWeek.weekStartDate, $lte: weekStartDate },
        })
          .select("category hours")
          .lean<Array<{ category: string; hours: number }>>();

        const prevCatHours: Record<string, number> = {};
        for (const log of prevLogs) {
          prevCatHours[log.category] = (prevCatHours[log.category] || 0) + log.hours;
        }

        for (const cat of metrics.categoryBreakdown) {
          cat.prevWeekHours = prevCatHours[cat.name] !== undefined
            ? roundHours(prevCatHours[cat.name])
            : null;
        }

        // Generate AI content
        const aiContent = await generateDebriefContent({
          metrics,
          personaLabel: persona.label,
          personaInstructions: persona.promptInstructions,
          coreWhy: profile.coreWhy,
          implicitMemory: profile.implicitMemory,
          logs,
        });

        // Save debrief
        await WeeklyDebrief.create({
          userId,
          weekStartDate,
          weekEndDate,
          totalHours: metrics.totalHours,
          totalLogs: metrics.totalLogs,
          bestDay: metrics.bestDay,
          consistencyPercent: metrics.consistencyPercent,
          categoryBreakdown: metrics.categoryBreakdown,
          mvpCategory: metrics.mvpCategory,
          ...aiContent,
        });

        // Send push notification
        const hasPush = await PushSubscription.countDocuments({ userId });
        if (hasPush > 0) {
          await sendPushToUser(userId, {
            title: "Your Weekly Debrief is Ready",
            body: `"${aiContent.weekTitle}" — Open DiscipLog to see your Week in Review.`,
            data: { url: "/dashboard", type: "weekly_debrief" },
          });
        }

        debriefCount++;
      } catch (error) {
        console.error(`[DEBRIEF_USER_ERROR] userId=${userId}`, error);
      }
    }

    return NextResponse.json({
      processed: eligibleUserIds.length,
      debriefs: debriefCount,
      weekStartDate,
      weekEndDate,
      message: `Generated ${debriefCount} debriefs`,
    });
  } catch (error) {
    console.error("[WEEKLY_DEBRIEF_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
