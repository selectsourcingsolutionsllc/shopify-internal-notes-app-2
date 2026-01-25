import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing, admin } = await authenticate.admin(request);

  const isTestBilling = process.env.IS_TEST_BILLING === "true";

  // Get subscription from database
  const dbSubscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain: session.shop },
  });

  // Also check Shopify directly for the most accurate info
  let shopifySubscription = null;
  try {
    const response = await admin.graphql(`
      query {
        currentAppInstallation {
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
        }
      }
    `);
    const data = await response.json();
    shopifySubscription = data.data?.currentAppInstallation?.activeSubscriptions?.[0] || null;
  } catch (error) {
    console.error("[CANCEL PAGE] Error fetching Shopify subscription:", error);
  }

  // If no active subscription, redirect to billing page
  if (!shopifySubscription && (!dbSubscription || dbSubscription.status !== "ACTIVE")) {
    return redirect("/app/billing");
  }

  // Calculate trial info
  let isInTrial = false;
  let trialDaysRemaining = 0;
  if (shopifySubscription?.trialDays && shopifySubscription.trialDays > 0) {
    const createdAt = new Date(shopifySubscription.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    trialDaysRemaining = Math.max(0, shopifySubscription.trialDays - daysSinceCreation);
    isInTrial = trialDaysRemaining > 0;
  }

  // Get price info
  const pricing = shopifySubscription?.lineItems?.[0]?.plan?.pricingDetails;
  const price = pricing?.price?.amount || null;
  const interval = pricing?.interval || null;

  return json({
    subscription: {
      id: shopifySubscription?.id || dbSubscription?.subscriptionId,
      name: shopifySubscription?.name || dbSubscription?.planName,
      status: shopifySubscription?.status || dbSubscription?.status,
      test: shopifySubscription?.test ?? dbSubscription?.test ?? isTestBilling,
      currentPeriodEnd: shopifySubscription?.currentPeriodEnd || dbSubscription?.currentPeriodEnd,
      price,
      interval,
      isInTrial,
      trialDaysRemaining,
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, billing, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const isTestBilling = process.env.IS_TEST_BILLING === "true";

  if (intent === "cancel") {
    // Get subscription ID
    let subscriptionId: string | null = null;
    let isTestSubscription = isTestBilling;

    // First try database
    const dbSubscription = await prisma.billingSubscription.findUnique({
      where: { shopDomain: session.shop },
    });

    if (dbSubscription) {
      subscriptionId = dbSubscription.subscriptionId;
      isTestSubscription = dbSubscription.test;
    } else {
      // Fallback to Shopify
      try {
        const response = await admin.graphql(`
          query {
            currentAppInstallation {
              activeSubscriptions {
                id
                test
              }
            }
          }
        `);
        const data = await response.json();
        const activeSubscription = data.data?.currentAppInstallation?.activeSubscriptions?.[0];
        if (activeSubscription) {
          subscriptionId = activeSubscription.id;
          isTestSubscription = activeSubscription.test || false;
        }
      } catch (error) {
        console.error("[CANCEL] Error querying Shopify:", error);
      }
    }

    if (subscriptionId) {
      try {
        console.log("[CANCEL] Cancelling subscription:", subscriptionId);
        await billing.cancel({
          subscriptionId: subscriptionId,
          isTest: isTestSubscription,
          prorate: true,
        });
        console.log("[CANCEL] Subscription cancelled successfully!");

        // Update database
        if (dbSubscription) {
          await prisma.billingSubscription.update({
            where: { shopDomain: session.shop },
            data: { status: "CANCELLED" },
          });
        }

        return redirect("/app/billing?cancelled=true");
      } catch (error) {
        console.error("[CANCEL] Error cancelling subscription:", error);
        return json({ error: "Failed to cancel subscription" }, { status: 500 });
      }
    }

    return json({ error: "No subscription found to cancel" }, { status: 400 });
  }

  return redirect("/app/billing");
}

export default function CancelSubscription() {
  const { subscription } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const formatPrice = () => {
    if (!subscription.price) return "your current rate";
    const intervalText = subscription.interval === "EVERY_30_DAYS" ? "/month" : "/year";
    return `$${subscription.price}${intervalText}`;
  };

  return (
    <Page
      title="Cancel Subscription"
      backAction={{ content: "Back to Billing", url: "/app/billing" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                Are you sure you want to cancel?
              </Text>

              <Banner tone="warning">
                <Text as="p" fontWeight="semibold">
                  You're about to cancel your {subscription.name} subscription.
                </Text>
              </Banner>

              <Divider />

              {/* Current Plan Info */}
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Your Current Plan
                </Text>
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between">
                    <BlockStack gap="100">
                      <Text variant="headingSm" as="p">{subscription.name}</Text>
                      <Text as="p" tone="subdued">{formatPrice()}</Text>
                    </BlockStack>
                    {subscription.isInTrial && (
                      <Text as="p" tone="caution">
                        {subscription.trialDaysRemaining} days left in trial
                      </Text>
                    )}
                  </InlineStack>
                </Box>
              </BlockStack>

              <Divider />

              {/* What happens when you cancel */}
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  What happens when you cancel
                </Text>
                <List type="bullet">
                  <List.Item>
                    Your access to Product Notes will pause
                  </List.Item>
                  <List.Item>
                    Your notes are safely stored and will be available if you resubscribe
                  </List.Item>
                  {subscription.isInTrial ? (
                    <List.Item>
                      <Text as="span" fontWeight="semibold">
                        You won't be charged - you're still in your free trial
                      </Text>
                    </List.Item>
                  ) : (
                    <List.Item>
                      You may receive a prorated refund for unused time
                    </List.Item>
                  )}
                </List>
              </BlockStack>

              <Divider />

              {/* Access Until */}
              {subscription.currentPeriodEnd && !subscription.isInTrial && (
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">
                    Access Until
                  </Text>
                  <Text as="p">
                    If you cancel now, you'll retain access until{" "}
                    <Text as="span" fontWeight="semibold">
                      {format(new Date(subscription.currentPeriodEnd), "MMMM dd, yyyy")}
                    </Text>
                  </Text>
                </BlockStack>
              )}

              {subscription.currentPeriodEnd && !subscription.isInTrial && <Divider />}

              {/* Action Buttons */}
              <InlineStack gap="300" align="end">
                <Link to="/app/billing">
                  <Button size="large">
                    Keep My Subscription
                  </Button>
                </Link>
                <Form method="post">
                  <input type="hidden" name="intent" value="cancel" />
                  <Button
                    size="large"
                    variant="primary"
                    tone="critical"
                    submit
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Cancelling..." : "Yes, Cancel Subscription"}
                  </Button>
                </Form>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Help Section */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Need Help?
              </Text>
              <Text as="p" tone="subdued">
                Having issues with the app? We'd love to help before you go.
              </Text>
              <Text as="p" tone="subdued">
                Contact us at:{" "}
                <Text as="span" fontWeight="semibold">
                  selectsourcingsolutionsllc@outlook.com
                </Text>
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
