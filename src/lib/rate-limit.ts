import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { SubscriptionPlan } from "@/models/User";

// Graceful fallback if UPSTASH is not configured
let customRedisStore: Record<string, any> | undefined;

// Attempt to use Upstash Redis, if it's available.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Free: 50 messages/day.  Pro: 150 messages/day.
// Separate rate limiters so each plan has its own sliding window.
const freeRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 d"),
      analytics: true,
      prefix: "disciplog:ratelimit:ai:free",
    })
  : null;

const proRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(150, "1 d"),
      analytics: true,
      prefix: "disciplog:ratelimit:ai:pro",
    })
  : null;

export async function checkAIChatRateLimit(
  userId: string,
  plan: SubscriptionPlan = "free"
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const limiter = plan === "pro" ? proRateLimit : freeRateLimit;
  const limit = plan === "pro" ? 150 : 50;

  if (!limiter) {
    // Skip rate-limiting if no Redis is configured. This usually happens in local development
    // or if the env variables haven't been copied over.
    return { success: true, limit, remaining: limit, reset: 0 };
  }

  return await limiter.limit(`ai_chat_${userId}`);
}
