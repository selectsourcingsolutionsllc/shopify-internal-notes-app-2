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
import {
  getSubscriptionStatus,
  formatPrice,
  getStatusBadgeTone,
} from "../utils/billing.server";

// The app handle from shopify.app.toml — used to build the managed pricing URL
const APP_HANDLE = "product-notes-for-staff";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const subscriptionData = await getSubscriptionStatus(admin);

  const activeSubscription = subscriptionData.activeSubscription;
  const trialStatus = subscriptionData.trialStatus;

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
    appHandle: APP_HANDLE,
  });
}

export default function Billing() {
  const { hasSubscription, planName, status, statusTone, priceFormatted, isTest, trialStatus, appHandle } = useLoaderData<typeof loader>();

  // Shopify's managed pricing page URL (App Bridge navigation format)
  const managedPricingUrl = `shopify:admin/charges/${appHandle}/pricing_plans`;

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
                    Click "Manage Subscription" above. Shopify will show you all available plans
                    and handle the switch for you. Changes take effect immediately.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    How do I cancel?
                  </Text>
                  <Text as="p" tone="subdued">
                    Click "Manage Subscription" above and choose to cancel. You can also cancel
                    from your Shopify admin under Settings → Billing.
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
