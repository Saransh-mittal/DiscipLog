import webpush from "web-push";
import connectToDatabase from "@/lib/mongoose";
import PushSubscription from "@/models/PushSubscription";

const MAX_FAIL_COUNT = 5;

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    type?: string;
    tier?: string;
  };
  actions?: Array<{ action: string; title: string }>;
}

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "VAPID keys not configured. Run: npx tsx scripts/generate-vapid-keys.ts"
    );
  }

  return { publicKey, privateKey, subject };
}

function configureWebPush() {
  const config = getVapidConfig();
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
}

function buildNotificationPayload(payload: PushPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/favicon.ico",
    badge: payload.badge || "/favicon.ico",
    data: payload.data || {},
    actions: payload.actions || [],
  });
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  await connectToDatabase();
  configureWebPush();

  const subscriptions = await PushSubscription.find({ userId }).lean();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const notificationPayload = buildNotificationPayload(payload);
  let sent = 0;
  let failed = 0;
  let removed = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          notificationPayload
        );

        await PushSubscription.findByIdAndUpdate(sub._id, {
          $set: { lastUsedAt: new Date(), failCount: 0 },
        });

        return "sent" as const;
      } catch (error) {
        const statusCode =
          error instanceof webpush.WebPushError ? error.statusCode : 0;

        // 404 or 410 = subscription expired/unsubscribed, remove it
        if (statusCode === 404 || statusCode === 410) {
          await PushSubscription.findByIdAndDelete(sub._id);
          return "removed" as const;
        }

        // Increment failure counter; remove if too many failures
        const newFailCount = (sub.failCount || 0) + 1;
        if (newFailCount >= MAX_FAIL_COUNT) {
          await PushSubscription.findByIdAndDelete(sub._id);
          return "removed" as const;
        }

        await PushSubscription.findByIdAndUpdate(sub._id, {
          $set: { failCount: newFailCount },
        });

        return "failed" as const;
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value === "sent") sent++;
      else if (result.value === "failed") failed++;
      else if (result.value === "removed") removed++;
    } else {
      failed++;
    }
  }

  return { sent, failed, removed };
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  await connectToDatabase();
  const count = await PushSubscription.countDocuments({ userId });
  return count > 0;
}
