import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Banner,
  Button,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";
import {
  getSubscriptionStatus,
  formatPrice,
  getStatusBadgeTone,
} from "../utils/billing.server";
import { syncProductCount } from "../utils/product-count-sync.server";
import { getTierMismatchInfo, getRequiredPlan } from "../utils/plan-tiers.server";
import { APP_HANDLE, MANAGED_PRICING_URL } from "../config/app";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  const [subscriptionData, dbSubscription, productCount] = await Promise.all([
    getSubscriptionStatus(admin),
    prisma.billingSubscription.findUnique({
      where: { shopDomain: session.shop },
    }),
    syncProductCount(admin, session.shop),
  ]);

  const activeSubscription = subscriptionData.activeSubscription;
  const trialStatus = subscriptionData.trialStatus;

  // Use fresh product count or fall back to DB cached value
  const currentProductCount = productCount ?? dbSubscription?.productCount ?? null;
  const tierMismatch = getTierMismatchInfo(activeSubscription?.name || null, currentProductCount);

  // Calculate recommended plan based on product count (for pre-selection guidance)
  const recommendedPlan = currentProductCount !== null
    ? getRequiredPlan(currentProductCount)
    : null;

  return json({
    hasSubscription: !!activeSubscription,
    planName: activeSubscription?.name || null,
    status: activeSubscription?.status || null,
    statusTone: activeSubscription ? getStatusBadgeTone(activeSubscription.status) : null,
    priceFormatted: formatPrice(activeSubscription),
    isTest: activeSubscription?.test || false,
    trialStatus: {
      inTrial: trialStatus.inTrial,
      daysRemaining: trialStatus.daysRemaining,
      message: trialStatus.message,
    },
    // Database subscription info for cancellation banners
    dbStatus: dbSubscription?.status || null,
    dbTrialEndsAt: dbSubscription?.trialEndsAt?.toISOString() || null,
    // Tier mismatch info
    tierMismatch,
    currentProductCount,
    // Recommended plan for pre-selection guidance
    recommendedPlan,
  });
}

export default function Billing() {
  const { hasSubscription, planName, status, statusTone, priceFormatted, isTest, trialStatus, dbStatus, dbTrialEndsAt, tierMismatch, currentProductCount, recommendedPlan } = useLoaderData<typeof loader>();

  // Shopify's managed pricing page URL (from shared config)
  const managedPricingUrl = MANAGED_PRICING_URL;

  return (
    <Page
      title="Subscription"
      subtitle="Manage your plan through Shopify"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {/* Trial warning */}
        {trialStatus.inTrial && trialStatus.daysRemaining <= 3 && (
          <Layout.Section>
            <Banner tone="warning" title="Trial Ending Soon">
              <p>
                Your free trial ends in {trialStatus.daysRemaining} day
                {trialStatus.daysRemaining !== 1 ? "s" : ""}. Your subscription
                will automatically continue after the trial period.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* Cancelled but still in trial period banner */}
        {dbStatus === "CANCELLED" && dbTrialEndsAt &&
         new Date(dbTrialEndsAt) > new Date() && (
          <Layout.Section>
            <Banner title="Your subscription is cancelled" tone="warning">
              <BlockStack gap="200">
                <Text as="p">
                  You cancelled your subscription, but don't worry - you can still
                  use all features until your free trial ends on{" "}
                  <Text as="span" fontWeight="semibold">
                    {format(new Date(dbTrialEndsAt), "MMMM dd, yyyy")}
                  </Text>.
                </Text>
                <Text as="p">
                  Since you cancelled during your free trial, you will not be charged.
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* Trial ended banner */}
        {dbStatus === "CANCELLED" && dbTrialEndsAt &&
         new Date(dbTrialEndsAt) <= new Date() && (
          <Layout.Section>
            <Banner title="Your free trial has ended" tone="critical">
              <Text as="p">
                Subscribe to continue using Product Notes.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Tier mismatch banner */}
        {tierMismatch && (
          <Layout.Section>
            <Banner
              title={trialStatus.inTrial ? "Plan upgrade needed before trial ends" : "Plan upgrade required"}
              tone={trialStatus.inTrial ? "warning" : "critical"}
              action={{
                content: "Upgrade Plan",
                url: managedPricingUrl,
              }}
            >
              <Text as="p">{tierMismatch.message}</Text>
              {trialStatus.inTrial && (
                <Text as="p">
                  Your notes will continue to work during your trial, but you'll need to upgrade before it ends.
                </Text>
              )}
            </Banner>
          </Layout.Section>
        )}

        {/* Current subscription info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Current Plan
                </Text>
                {status && statusTone && (
                  <Badge tone={statusTone}>{status}</Badge>
                )}
              </InlineStack>

              {trialStatus.inTrial && (
                <Banner tone="info">
                  <p>{trialStatus.message}</p>
                </Banner>
              )}

              {hasSubscription ? (
                <BlockStack gap="300">
                  <InlineStack gap="400">
                    <BlockStack gap="100">
                      <Text variant="headingLg" as="p">{planName}</Text>
                      <Text as="p" tone="subdued">{priceFormatted}</Text>
                      {isTest && (
                        <Badge tone="info">Test Mode</Badge>
                      )}
                    </BlockStack>
                  </InlineStack>

                  <Divider />

                  <Text as="p" tone="subdued">
                    To change your plan or cancel your subscription, use the button below.
                    Shopify manages all plan changes, billing, and cancellations.
                  </Text>

                  <Button
                    variant="primary"
                    url={managedPricingUrl}
                  >
                    Manage Subscription
                  </Button>
                </BlockStack>
              ) : (
                <BlockStack gap="300">
                  {recommendedPlan && currentProductCount !== null && (
                    <Banner tone="info" title="Required plan for your store">
                      <Text as="p">
                        Your store has <Text as="span" fontWeight="semibold">{currentProductCount.toLocaleString()} products</Text>.
                        Based on your product count, your store requires the <Text as="span" fontWeight="semibold">{recommendedPlan.displayName} plan</Text> ({recommendedPlan.price}),
                        which supports up to {recommendedPlan.maxProducts === Infinity ? "unlimited" : recommendedPlan.maxProducts.toLocaleString()} products.
                      </Text>
                    </Banner>
                  )}

                  <Text as="p">
                    You don't have an active subscription. Choose a plan to get started
                    with all features including a 7-day free trial.
                  </Text>

                  <Button
                    variant="primary"
                    url={managedPricingUrl}
                  >
                    Choose a Plan
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Help section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Frequently Asked Questions
              </Text>

              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    How do I change plans?
                  </Text>
                  <Text as="p" tone="subdued">
                    Click "Billing Status" or "Manage Subscription" to view all
                    available plans and switch to a different tier.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    How do I cancel?
                  </Text>
                  <Text as="p" tone="subdued">
                    Go to the Billing Status page and click "Cancel Subscription."
                    Your notes will be safely stored if you decide to resubscribe later.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    What happens after the free trial?
                  </Text>
                  <Text as="p" tone="subdued">
                    After your 7-day trial, you'll be charged the plan price. Cancel anytime
                    before the trial ends to avoid charges.
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
