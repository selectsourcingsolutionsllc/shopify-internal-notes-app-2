import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  RangeSlider,
  Badge,
  Box,
  Divider,
  Icon,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";
import { useState, useCallback } from "react";

// Pricing tiers configuration
const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    description: "Perfect for trying out",
    features: [
      "5 product notes",
      "1 team member",
      "Basic support",
    ],
    recommended: false,
    planKey: null, // Free tier doesn't need billing
  },
  {
    id: "basic",
    name: "Basic",
    price: 9.99,
    period: "month",
    description: "For small stores",
    features: [
      "50 product notes",
      "3 team members",
      "Photo attachments",
      "Email support",
    ],
    recommended: false,
    planKey: "Basic Plan",
  },
  {
    id: "pro",
    name: "Pro",
    price: 19.99,
    period: "month",
    description: "Most popular choice",
    features: [
      "Unlimited notes",
      "10 team members",
      "Photo attachments",
      "Audit logging",
      "CSV exports",
      "Priority support",
      "14-day free trial",
    ],
    recommended: true,
    planKey: MONTHLY_PLAN,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 49.99,
    period: "month",
    description: "For large operations",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
    ],
    recommended: false,
    planKey: "Enterprise Plan",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);

  const subscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain: session.shop },
  });

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  return json({
    subscription,
    hasActivePayment,
    appSubscriptions,
    shop: session.shop,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const plan = formData.get("plan") as string;

  if (action === "subscribe") {
    // For now, all paid plans use the Pro Plan billing
    // In production, you'd have separate billing configs for each tier
    const billingResponse = await billing.request({
      plan: MONTHLY_PLAN,
      isTest: true,
      returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_APP_HANDLE}/app/billing`,
    });

    // Store subscription info
    await prisma.billingSubscription.upsert({
      where: { shopDomain: session.shop },
      create: {
        shopDomain: session.shop,
        subscriptionId: billingResponse.appSubscription.id,
        status: "PENDING",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
      update: {
        subscriptionId: billingResponse.appSubscription.id,
        status: "PENDING",
      },
    });

    return redirect(billingResponse.confirmationUrl);
  }

  if (action === "cancel") {
    const subscription = await prisma.billingSubscription.findUnique({
      where: { shopDomain: session.shop },
    });

    if (subscription) {
      await billing.cancel({
        subscriptionId: subscription.subscriptionId,
        isTest: true,
        prorate: true,
      });

      await prisma.billingSubscription.update({
        where: { shopDomain: session.shop },
        data: { status: "CANCELLED" },
      });
    }

    return redirect("/app/billing?cancelled=true");
  }

  return null;
}

export default function Billing() {
  const { subscription, hasActivePayment } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams, setSearchParams] = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "true";

  // Volume slider state (for display purposes)
  const [monthlyOrders, setMonthlyOrders] = useState(500);
  const handleVolumeChange = useCallback(
    (value: number) => setMonthlyOrders(value),
    []
  );

  const isInTrial = subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
  const hasActiveSubscription = subscription?.status === "ACTIVE" || hasActivePayment;

  const handleSubscribe = (planKey: string | null) => {
    if (!planKey) return; // Free tier
    const formData = new FormData();
    formData.append("action", "subscribe");
    formData.append("plan", planKey);
    submit(formData, { method: "post" });
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel your subscription?")) {
      const formData = new FormData();
      formData.append("action", "cancel");
      submit(formData, { method: "post" });
    }
  };

  return (
    <Page
      title="Choose Your Plan"
      subtitle="Select the perfect plan for your store's needs"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {/* Cancelled banner */}
        {cancelled && (
          <Layout.Section>
            <Banner
              title="Subscription cancelled"
              tone="info"
              onDismiss={() => setSearchParams({})}
            >
              <p>Your subscription has been cancelled. You can resubscribe at any time.</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Active subscription banner */}
        {hasActiveSubscription && (
          <Layout.Section>
            <Banner
              title="You have an active subscription"
              tone="success"
            >
              <BlockStack gap="200">
                <Text as="p">
                  Thank you for being a Pro subscriber! You have access to all features.
                </Text>
                {subscription?.trialEndsAt && isInTrial && (
                  <Text as="p" tone="subdued">
                    Trial ends: {format(new Date(subscription.trialEndsAt), "MMMM dd, yyyy")}
                  </Text>
                )}
                <Box paddingBlockStart="200">
                  <Button
                    tone="critical"
                    onClick={handleCancel}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    Cancel Subscription
                  </Button>
                </Box>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* Volume selector */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Estimate your monthly volume
              </Text>
              <RangeSlider
                label="Monthly orders"
                value={monthlyOrders}
                onChange={handleVolumeChange}
                min={0}
                max={5000}
                step={100}
                output
                suffix={
                  <Text as="span" variant="bodyMd">
                    {monthlyOrders.toLocaleString()} orders/month
                  </Text>
                }
              />
              <Text as="p" tone="subdued">
                {monthlyOrders <= 100
                  ? "The Free plan is perfect for you!"
                  : monthlyOrders <= 500
                  ? "We recommend the Basic plan for your volume."
                  : monthlyOrders <= 2000
                  ? "The Pro plan is ideal for your store size."
                  : "Enterprise plan offers the best value at your scale."}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Pricing grid */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            {PRICING_TIERS.map((tier) => (
              <Card key={tier.id} background={tier.recommended ? "bg-surface-secondary" : undefined}>
                <BlockStack gap="400">
                  {/* Header with badge */}
                  <InlineStack align="space-between" blockAlign="start">
                    <Text variant="headingMd" as="h3">
                      {tier.name}
                    </Text>
                    {tier.recommended && (
                      <Badge tone="success">Most Popular</Badge>
                    )}
                  </InlineStack>

                  {/* Price */}
                  <BlockStack gap="100">
                    <InlineStack align="start" blockAlign="baseline" gap="100">
                      <Text variant="heading2xl" as="p" fontWeight="bold">
                        ${tier.price}
                      </Text>
                      {tier.price > 0 && (
                        <Text as="span" tone="subdued">
                          /{tier.period}
                        </Text>
                      )}
                    </InlineStack>
                    <Text as="p" tone="subdued">
                      {tier.description}
                    </Text>
                  </BlockStack>

                  <Divider />

                  {/* Features list */}
                  <BlockStack gap="200">
                    {tier.features.map((feature, index) => (
                      <InlineStack key={index} gap="200" blockAlign="start">
                        <Box>
                          <Icon source={CheckIcon} tone="success" />
                        </Box>
                        <Text as="span">{feature}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>

                  {/* CTA Button */}
                  <Box paddingBlockStart="200">
                    {tier.planKey === null ? (
                      <Button
                        fullWidth
                        disabled={hasActiveSubscription}
                      >
                        {hasActiveSubscription ? "Current Plan" : "Get Started Free"}
                      </Button>
                    ) : tier.planKey === MONTHLY_PLAN && hasActiveSubscription ? (
                      <Button
                        fullWidth
                        variant="primary"
                        disabled
                      >
                        Current Plan
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        variant={tier.recommended ? "primary" : undefined}
                        onClick={() => handleSubscribe(tier.planKey)}
                        loading={isSubmitting}
                        disabled={isSubmitting || hasActiveSubscription}
                      >
                        {tier.price === 0
                          ? "Get Started"
                          : tier.recommended
                          ? "Start Free Trial"
                          : "Subscribe"}
                      </Button>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </Layout.Section>

        {/* FAQ or additional info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Frequently Asked Questions
              </Text>

              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Can I change plans later?
                  </Text>
                  <Text as="p" tone="subdued">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    What happens after the free trial?
                  </Text>
                  <Text as="p" tone="subdued">
                    After your 14-day trial, you'll be charged the plan price. Cancel anytime before the trial ends to avoid charges.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text variant="headingSm" as="h3">
                    Is there a contract?
                  </Text>
                  <Text as="p" tone="subdued">
                    No contracts! All plans are billed monthly and you can cancel anytime with no penalties.
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
