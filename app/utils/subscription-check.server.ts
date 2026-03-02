// Shared subscription check utility
// Used by notes API, photo uploads, and any other endpoint that needs to verify access

import prisma from "../db.server";
import { isPlanSufficient, getTierMismatchInfo } from "./plan-tiers.server";

export type SubscriptionCheckReason =
  | "no_subscription"
  | "trial_ended"
  | "subscription_expired"
  | "subscription_inactive"
  | "plan_insufficient";

export type SubscriptionCheck = {
  hasAccess: boolean;
  reason?: SubscriptionCheckReason;
  message?: string;
};

/**
 * Check if a shop has an active subscription and is on the right plan tier.
 *
 * Logic order:
 * 1. No subscription at all → blocked
 * 2. Still in trial → allowed (regardless of tier or cancellation status)
 * 3. Trial ended + not ACTIVE → blocked
 * 4. Subscription not ACTIVE → blocked
 * 5. Current period expired → blocked
 * 6. Plan insufficient for product count → blocked
 * 7. Otherwise → allowed
 */
export async function checkSubscriptionStatus(shopDomain: string): Promise<SubscriptionCheck> {
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
    // Still within trial period — allow access even if status is CANCELLED
    // (Tier enforcement is skipped during trial)
    return { hasAccess: true };
  }

  // Trial has ended — check if they had a trial
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

  // Subscription is ACTIVE and not in trial — check tier enforcement
  // Fail open: if planName is null or productCount is null, allow access
  if (!isPlanSufficient(subscription.planName, subscription.productCount)) {
    const mismatchInfo = getTierMismatchInfo(subscription.planName, subscription.productCount);
    return {
      hasAccess: false,
      reason: "plan_insufficient",
      message: mismatchInfo?.message ||
        "Your current plan doesn't support your store's product count. Please upgrade your plan.",
    };
  }

  return { hasAccess: true };
}
