import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - uses session token for auth
// Session token contains shop domain in the 'dest' claim
// NOTE: CORS headers are handled by Express middleware in server.js

// Helper to check subscription status and return appropriate message
type SubscriptionCheck = {
  hasAccess: boolean;
  reason?: "no_subscription" | "trial_ended" | "subscription_expired" | "subscription_inactive";
  message?: string;
};

async function checkSubscriptionStatus(shopDomain: string): Promise<SubscriptionCheck> {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain },
  });

  // No subscription record at all
  if (!subscription) {
    return {
      hasAccess: false,
      reason: "no_subscription",
      message: "Start your free trial to add product notes. Visit the app to get started!",
    };
  }

  // IMPORTANT: Check trial period FIRST, regardless of subscription status
  // If they cancelled during trial, they can still use the app until trial ends
  if (subscription.trialEndsAt && new Date() < subscription.trialEndsAt) {
    // Still within trial period - allow access even if status is CANCELLED
    return { hasAccess: true };
  }

  // Trial has ended - check if they had a trial
  if (subscription.trialEndsAt && new Date() >= subscription.trialEndsAt) {
    // If subscription is not ACTIVE and trial is over, no access
    if (subscription.status !== "ACTIVE") {
      return {
        hasAccess: false,
        reason: "trial_ended",
        message: "Your free trial has ended. Subscribe to a plan to continue adding notes.",
      };
    }
    // If ACTIVE, check if they have an ongoing paid period
    if (!subscription.currentPeriodEnd || new Date() > subscription.currentPeriodEnd) {
      return {
        hasAccess: false,
        reason: "trial_ended",
        message: "Your free trial has ended. Subscribe to a plan to continue adding notes.",
      };
    }
  }

  // Subscription exists but status is not ACTIVE (cancelled, etc.) and no trial
  if (subscription.status !== "ACTIVE") {
    return {
      hasAccess: false,
      reason: "subscription_inactive",
      message: "Your subscription is no longer active. Please resubscribe to continue adding notes.",
    };
  }

  // Check if current paid period has ended
  if (subscription.currentPeriodEnd && new Date() > subscription.currentPeriodEnd) {
    return {
      hasAccess: false,
      reason: "subscription_expired",
      message: "Your subscription has expired. Please renew to continue adding notes.",
    };
  }

  return { hasAccess: true };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);
  const { productId } = params;

  console.log("[PUBLIC API] GET notes for product:", productId, "shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
  }

  if (!productId) {
    return json({ error: "Missing productId" }, { status: 400 });
  }

  try {
    const notes = await prisma.productNote.findMany({
      where: {
        productId: productId,
        shopDomain: shop,
      },
      include: {
        photos: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log("[PUBLIC API] Found", notes.length, "notes");
    return json({ notes });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);
  const { productId } = params;

  console.log("[PUBLIC API] Action:", request.method, "product:", productId, "shop:", shop, "verified:", verified);

  if (!shop || !productId) {
    return json({ error: error || "Missing required parameters" }, { status: 400 });
  }

  // Check subscription before allowing note creation/editing
  const subscriptionStatus = await checkSubscriptionStatus(shop);
  if (!subscriptionStatus.hasAccess) {
    console.log("[PUBLIC API] Subscription check failed for", shop, "- reason:", subscriptionStatus.reason);
    return json({
      error: "subscription_required",
      reason: subscriptionStatus.reason,
      message: subscriptionStatus.message,
      requiresSubscription: true,
    }, { status: 403 });
  }

  try {
    if (request.method === "POST") {
      const { content } = await request.json();

      const note = await prisma.productNote.create({
        data: {
          productId: productId,
          shopDomain: shop,
          content,
          createdBy: "extension-user",
          updatedBy: "extension-user",
        },
      });

      return json({ note });
    }

    if (request.method === "PUT") {
      const { content, noteId } = await request.json();

      const note = await prisma.productNote.update({
        where: { id: noteId },
        data: {
          content,
          updatedBy: "extension-user",
        },
      });

      return json({ note });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
}
