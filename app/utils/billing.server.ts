// Billing utility functions for subscription management
// Uses direct GraphQL queries to avoid billing.check() permission issues with staff accounts

interface SubscriptionPricing {
  amount: string;
  currencyCode: string;
  interval: string;
}

interface AppSubscription {
  id: string;
  name: string;
  status: string;
  test: boolean;
  trialDays: number;
  createdAt: string;
  currentPeriodEnd: string | null;
  lineItems: Array<{
    plan: {
      pricingDetails: SubscriptionPricing | null;
    };
  }>;
}

interface SubscriptionHistoryNode {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  test: boolean;
}

interface TrialStatus {
  inTrial: boolean;
  daysRemaining: number;
  trialEndsAt: Date | null;
  message: string;
}

/**
 * Calculate trial status from subscription data
 * Uses createdAt + trialDays instead of currentPeriodEnd (more reliable)
 */
export function calculateTrialStatus(subscription: AppSubscription | null): TrialStatus {
  if (!subscription) {
    return {
      inTrial: false,
      daysRemaining: 0,
      trialEndsAt: null,
      message: "No active subscription",
    };
  }

  if (subscription.trialDays <= 0) {
    return {
      inTrial: false,
      daysRemaining: 0,
      trialEndsAt: null,
      message: "No trial period",
    };
  }

  const now = new Date();
  const createdAt = new Date(subscription.createdAt);

  // Calculate trial end date
  const trialEndsAt = new Date(createdAt);
  trialEndsAt.setDate(trialEndsAt.getDate() + subscription.trialDays);

  // Calculate remaining days
  const remainingMs = trialEndsAt.getTime() - now.getTime();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  const inTrial = remainingDays > 0 && subscription.status === "ACTIVE";

  return {
    inTrial,
    daysRemaining: remainingDays,
    trialEndsAt: inTrial ? trialEndsAt : null,
    message: inTrial
      ? `${remainingDays} day${remainingDays !== 1 ? "s" : ""} remaining in trial`
      : "Trial ended",
  };
}

/**
 * Get subscription status using direct GraphQL query
 * This avoids billing.check() which can fail for staff without billing permissions
 */
export async function getSubscriptionStatus(admin: any): Promise<{
  activeSubscription: AppSubscription | null;
  subscriptionHistory: SubscriptionHistoryNode[];
  launchUrl: string | null;
  trialStatus: TrialStatus;
}> {
  const response = await admin.graphql(`
    query GetSubscriptionStatus {
      currentAppInstallation {
        launchUrl
        activeSubscriptions {
          id
          name
          status
          test
          trialDays
          createdAt
          currentPeriodEnd
          lineItems {
            plan {
              pricingDetails {
                ... on AppRecurringPricing {
                  interval
                  price {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
        allSubscriptions(first: 20) {
          edges {
            node {
              id
              name
              status
              createdAt
              test
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const installation = data.data?.currentAppInstallation;

  if (!installation) {
    return {
      activeSubscription: null,
      subscriptionHistory: [],
      launchUrl: null,
      trialStatus: calculateTrialStatus(null),
    };
  }

  // Transform activeSubscriptions - it's an array, get the first one
  const activeSubscription = installation.activeSubscriptions?.[0] || null;

  // Transform pricing details for easier access
  if (activeSubscription?.lineItems?.[0]?.plan?.pricingDetails) {
    const pricing = activeSubscription.lineItems[0].plan.pricingDetails;
    if (pricing.price) {
      activeSubscription.lineItems[0].plan.pricingDetails = {
        amount: pricing.price.amount,
        currencyCode: pricing.price.currencyCode,
        interval: pricing.interval,
      };
    }
  }

  // Extract subscription history from edges
  const subscriptionHistory: SubscriptionHistoryNode[] = (installation.allSubscriptions?.edges || [])
    .map((edge: { node: SubscriptionHistoryNode }) => edge.node);

  return {
    activeSubscription,
    subscriptionHistory,
    launchUrl: installation.launchUrl,
    trialStatus: calculateTrialStatus(activeSubscription),
  };
}

/**
 * Format price for display
 */
export function formatPrice(subscription: AppSubscription | null): string {
  if (!subscription) return "N/A";

  const pricing = subscription.lineItems?.[0]?.plan?.pricingDetails;
  if (!pricing || !pricing.amount) return "N/A";

  const amount = parseFloat(pricing.amount);
  const currency = pricing.currencyCode || "USD";
  const interval = pricing.interval === "EVERY_30_DAYS" ? "month" :
                   pricing.interval === "ANNUAL" ? "year" : pricing.interval;

  return `$${amount.toFixed(2)}/${interval}`;
}

/**
 * Get badge tone based on subscription status
 */
export function getStatusBadgeTone(status: string): "success" | "warning" | "critical" | undefined {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "FROZEN":
      return "warning";
    case "CANCELLED":
    case "DECLINED":
    case "EXPIRED":
      return "critical";
    case "PENDING":
      return "warning";
    default:
      return undefined;
  }
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
