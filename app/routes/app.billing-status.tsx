import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  DescriptionList,
  Banner,
  Button,
  Divider,
  Box,
  EmptyState,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  getSubscriptionStatus,
  formatPrice,
  formatDate,
  getStatusBadgeTone,
} from "../utils/billing.server";

// Pre-formatted data structure for client
interface FormattedSubscription {
  name: string;
  status: string;
  statusTone: BadgeProps["tone"];
  priceFormatted: string;
  nextBillingFormatted: string;
  startedFormatted: string;
  isTest: boolean;
}

interface FormattedHistoryItem {
  id: string;
  name: string;
  status: string;
  statusTone: BadgeProps["tone"];
  dateFormatted: string;
  isTest: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[BILLING-STATUS] Loader starting...");

  try {
    const { admin, session } = await authenticate.admin(request);
    console.log("[BILLING-STATUS] Auth successful, fetching subscription...");

    // Check for charge_id in URL - this indicates user just approved billing
    const url = new URL(request.url);
    const chargeId = url.searchParams.get("charge_id");

    if (chargeId) {
      console.log("[BILLING-STATUS] User returned from billing approval with charge_id:", chargeId);
    }

    const subscriptionData = await getSubscriptionStatus(admin);

    // If user just approved billing (charge_id present) or there's an active subscription,
    // make sure it's saved to our database
    if (subscriptionData.activeSubscription) {
      const shopifySubscription = subscriptionData.activeSubscription;
      console.log("[BILLING-STATUS] Active subscription from Shopify:", JSON.stringify(shopifySubscription, null, 2));

      // Check if we need to save/update the subscription in database
      const existingSubscription = await prisma.billingSubscription.findUnique({
        where: { shopDomain: session.shop },
      });

      const needsSync = !existingSubscription ||
                        existingSubscription.subscriptionId !== shopifySubscription.id ||
                        existingSubscription.status !== shopifySubscription.status;

      if (needsSync) {
        console.log("[BILLING-STATUS] Syncing subscription to database...");

        // Calculate trial end date if trial days exist
        let trialEndsAt = null;
        if (shopifySubscription.trialDays && shopifySubscription.trialDays > 0) {
          const createdAt = new Date(shopifySubscription.createdAt);
          trialEndsAt = new Date(createdAt);
          trialEndsAt.setDate(trialEndsAt.getDate() + shopifySubscription.trialDays);
        }

        try {
          await prisma.billingSubscription.upsert({
            where: { shopDomain: session.shop },
            update: {
              subscriptionId: shopifySubscription.id,
              chargeId: chargeId,
              planName: shopifySubscription.name,
              status: shopifySubscription.status,
              test: shopifySubscription.test || false,
              trialStartedAt: shopifySubscription.trialDays > 0 ? new Date(shopifySubscription.createdAt) : null,
              trialEndsAt: trialEndsAt,
              currentPeriodEnd: shopifySubscription.currentPeriodEnd ? new Date(shopifySubscription.currentPeriodEnd) : null,
            },
            create: {
              shopDomain: session.shop,
              subscriptionId: shopifySubscription.id,
              chargeId: chargeId,
              planName: shopifySubscription.name,
              status: shopifySubscription.status,
              test: shopifySubscription.test || false,
              trialStartedAt: shopifySubscription.trialDays > 0 ? new Date(shopifySubscription.createdAt) : null,
              trialEndsAt: trialEndsAt,
              currentPeriodEnd: shopifySubscription.currentPeriodEnd ? new Date(shopifySubscription.currentPeriodEnd) : null,
            },
          });
          console.log("[BILLING-STATUS] Subscription saved to database successfully!");
        } catch (dbError) {
          console.error("[BILLING-STATUS] Error saving subscription to database:", dbError);
        }
      } else {
        console.log("[BILLING-STATUS] Subscription already in sync with database");
      }
    }
    console.log("[BILLING-STATUS] Got subscription data");

    // Format all data server-side before sending to client
    const formattedSubscription: FormattedSubscription | null = subscriptionData.activeSubscription
      ? {
          name: subscriptionData.activeSubscription.name,
          status: subscriptionData.activeSubscription.status,
          statusTone: getStatusBadgeTone(subscriptionData.activeSubscription.status),
          priceFormatted: formatPrice(subscriptionData.activeSubscription),
          nextBillingFormatted: subscriptionData.activeSubscription.currentPeriodEnd
            ? formatDate(subscriptionData.activeSubscription.currentPeriodEnd)
            : "N/A",
          startedFormatted: formatDate(subscriptionData.activeSubscription.createdAt),
          isTest: subscriptionData.activeSubscription.test,
        }
      : null;

    const formattedHistory: FormattedHistoryItem[] = subscriptionData.subscriptionHistory
      .filter(Boolean)
      .map((sub) => ({
        id: sub.id,
        name: sub.name,
        status: sub.status,
        statusTone: getStatusBadgeTone(sub.status),
        dateFormatted: formatDate(sub.createdAt),
        isTest: sub.test,
      }));

    return json({
      subscription: formattedSubscription,
      history: formattedHistory,
      trialStatus: {
        inTrial: subscriptionData.trialStatus.inTrial,
        daysRemaining: subscriptionData.trialStatus.daysRemaining,
        message: subscriptionData.trialStatus.message,
      },
      error: null,
    });
  } catch (error: unknown) {
    console.error("[BILLING-STATUS] Error:", error);
    console.error("[BILLING-STATUS] Error message:", error instanceof Error ? error.message : String(error));

    return json({
      subscription: null,
      history: [],
      trialStatus: {
        inTrial: false,
        daysRemaining: 0,
        message: "Unable to fetch subscription status",
      },
      error: "Unable to fetch subscription information. You may not have permission to view billing details.",
    });
  }
}

export default function BillingStatus() {
  const { subscription, history, trialStatus, error } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Build subscription details for DescriptionList
  const subscriptionDetails = subscription
    ? [
        { term: "Plan", description: subscription.name },
        { term: "Price", description: subscription.priceFormatted },
        { term: "Status", description: subscription.status },
        { term: "Next billing date", description: subscription.nextBillingFormatted },
        { term: "Started", description: subscription.startedFormatted },
        { term: "Test mode", description: subscription.isTest ? "Yes" : "No" },
      ]
    : [];

  return (
    <Page
      title="Billing & Subscription Status"
      subtitle="View your current plan and billing history"
      backAction={{ content: "Dashboard", url: "/app" }}
      secondaryActions={[
        {
          content: "Change Plan",
          url: "/app/billing",
        },
      ]}
    >
      <Layout>
        {/* Error Banner */}
        {error && (
          <Layout.Section>
            <Banner tone="critical" title="Error">
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Trial Warning Banner */}
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

        {/* Current Subscription Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  Current Subscription
                </Text>
                {subscription && (
                  <Badge tone={subscription.statusTone}>
                    {subscription.status}
                  </Badge>
                )}
              </InlineStack>

              {/* Trial Status Banner */}
              {trialStatus.inTrial && (
                <Banner tone="info">
                  <p>{trialStatus.message}</p>
                </Banner>
              )}

              {subscription ? (
                <>
                  <DescriptionList items={subscriptionDetails} />

                  <Divider />

                  <InlineStack gap="300">
                    <Link to="/app/billing">
                      <Button>Change Plan</Button>
                    </Link>
                    <Button
                      tone="critical"
                      onClick={() => navigate("/app/cancel-subscription")}
                    >
                      Cancel Subscription
                    </Button>
                  </InlineStack>
                </>
              ) : (
                <EmptyState
                  heading="No active subscription"
                  action={{
                    content: "Choose a Plan",
                    url: "/app/billing",
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    You don't have an active subscription. Choose a plan to get
                    started with all features.
                  </p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Billing History Card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Billing History
              </Text>

              {history.length > 0 ? (
                <BlockStack gap="300">
                  {history.map((item) => (
                    <Box
                      key={item.id}
                      padding="300"
                      background="bg-surface-secondary"
                      borderRadius="200"
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="semibold" as="p">
                            {item.name}
                          </Text>
                          <Text variant="bodySm" tone="subdued" as="p">
                            {item.dateFormatted}
                            {item.isTest && " (Test)"}
                          </Text>
                        </BlockStack>
                        <Badge tone={item.statusTone}>
                          {item.status}
                        </Badge>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              ) : (
                <Text tone="subdued" as="p">
                  No billing history available.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Help Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Need Help?
              </Text>

              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    How do I upgrade or downgrade my plan?
                  </Text>
                  <Text tone="subdued" as="p">
                    Click "Change Plan" above to view all available plans and
                    switch to a different tier. Changes take effect immediately.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    How do I cancel my subscription?
                  </Text>
                  <Text tone="subdued" as="p">
                    You can cancel your subscription from the{" "}
                    <Link to="/app/billing">billing page</Link>. You'll retain
                    access until the end of your current billing period.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Where can I see my invoices?
                  </Text>
                  <Text tone="subdued" as="p">
                    All app charges appear on your Shopify bill. You can view
                    them in your Shopify admin under Settings → Billing.
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
