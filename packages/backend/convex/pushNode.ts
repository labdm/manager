"use node";

// Static import so `convex deploy` bundles this package. `createRequire`
// left a runtime `require("web-push")` that the Convex Node analyzer could
// not resolve (`Cannot find module 'web-push'`).
import { sendNotification, setVapidDetails } from "web-push";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function statusCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const value = error.statusCode;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

/** Sends a Web Push message. Missing VAPID env skips quietly so the cron does not retry forever. */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      return { sent: 0, skipped: "vapid_not_configured" as const };
    }
    setVapidDetails(subject, publicKey, privateKey);
    const subs = await ctx.runQuery(internal.push.listForUser, { userId: args.userId });
    let sent = 0;
    for (const sub of subs) {
      try {
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: args.title, body: args.body, url: args.url }),
        );
        sent += 1;
      } catch (error) {
        const status = statusCode(error);
        if (status === 404 || status === 410) {
          await ctx.runMutation(internal.push.removeSubscription, { id: sub.id });
        }
      }
    }
    return { sent };
  },
});
