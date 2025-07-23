import prisma from "../db.server";

interface AnalyticsEvent {
  shopDomain: string;
  userId: string;
  event: string;
  properties?: Record<string, any>;
}

export async function trackUsage({ shopDomain, userId, event, properties }: AnalyticsEvent) {
  try {
    // Track usage in audit logs for internal analytics
    await prisma.auditLog.create({
      data: {
        shopDomain,
        userId,
        userEmail: "",
        action: "USAGE_TRACKING",
        entityType: "ANALYTICS_EVENT",
        entityId: event,
        newValue: {
          event,
          properties,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Failed to track usage:", error);
  }
}

// Usage in your routes:
// await trackUsage({
//   shopDomain: session.shop,
//   userId: session.id,
//   event: "note_created",
//   properties: { productId: note.productId }
// });