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
    id: "starter",
    name: "Starter",
    price: 9.99,
    period: "month",
    productRange: "0-50 products",
    description: "Perfect for new stores",
    features: [
      "Up to 50 products",
      "Unlimited notes",
      "Photo attachments",
      "Email support",
      "7-day free trial",
    ],
    recommended: false,
    planKey: "Starter Plan",
  },
  {
    id: "basic",
    name: "Basic",
    price: 14.99,
    period: "month",
    productRange: "50-300 products",
    description: "For growing stores",
    features: [
      "Up to 300 products",
      "Unlimited notes",
      "Photo attachments",
      "Audit logging",
      "Email support",
      "7-day free trial",
    ],
    recommended: false,
    planKey: "Basic Plan",
  },
  {
    id: "pro",
    name: "Pro",
    price: 19.99,
    period: "month",
    productRange: "300-3,000 products",
    description: "Most popular choice",
    features: [
      "Up to 3,000 products",
      "Unlimited notes",
      "Photo attachments",
      "Audit logging",
      "CSV exports",
      "Priority support",
      "7-day free trial",
    ],
    recommended: true,
    planKey: MONTHLY_PLAN,
  },
  {
    id: "titan",
    name: "Titan",
    price: 24.99,
    period: "month",
    productRange: "3,000-10,000 products",
    description: "For large catalogs",
    features: [
      "Up to 10,000 products",
      "Unlimited notes",
      "Photo attachments",
      "Audit logging",
      "CSV exports",
      "Priority support",
      "7-day free trial",
    ],
    recommended: false,
    planKey: "Titan Plan",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 29.99,
    period: "month",
    productRange: "10,000+ products",
    description: "Unlimited scale",
    features: [
      "Unlimited products",
      "Unlimited notes",
      "Photo attachments",
      "Audit logging",
      "CSV exports",
      "Dedicated support",
      "7-day free trial",
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
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

  // Volume slider state (for display purposes - based on product count)
  const [productCount, setProductCount] = useState(100);
  const handleVolumeChange = useCallback(
    (value: number) => setProductCount(value),
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
                How many products do you have?
              </Text>
              <RangeSlider
                label="Number of products"
                value={productCount}
                onChange={handleVolumeChange}
                min={0}
                max={15000}
                step={50}
                output
                suffix={
                  <Text as="span" variant="bodyMd">
                    {productCount.toLocaleString()} products
                  </Text>
                }
              />
              <Text as="p" tone="subdued">
                {productCount <= 50
                  ? "The Starter plan is perfect for you!"
                  : productCount <= 300
                  ? "We recommend the Basic plan for your catalog size."
                  : productCount <= 3000
                  ? "The Pro plan is ideal for your store."
                  : productCount <= 10000
                  ? "The Titan plan is built for catalogs your size."
                  : "Enterprise plan offers unlimited scale for your business."}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Pricing grid */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="400">
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
                      <Text as="span" tone="subdued">
                        /{tier.period}
                      </Text>
                    </InlineStack>
                    <Text as="p" fontWeight="semibold">
                      {tier.productRange}
                    </Text>
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
                    {tier.planKey === MONTHLY_PLAN && hasActiveSubscription ? (
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
                        {tier.recommended ? "Start 7-Day Trial" : "Start Trial"}
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
                    After your 7-day trial, you'll be charged the plan price. Cancel anytime before the trial ends to avoid charges.
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
