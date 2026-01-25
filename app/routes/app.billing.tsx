import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation, useSearchParams, Form, Link, useNavigate } from "@remix-run/react";
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
  Badge,
  Box,
  Divider,
  Icon,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

import { format } from "date-fns";

// Pricing tiers - planKey is a simple string (NOT imported from .server.ts) - v2
// This avoids hydration errors because the same strings exist on server AND client
// minProducts/maxProducts define the EXACT product count range for each plan
// Users can ONLY select the plan that matches their product count - no choosing higher plans
const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter",
    planKey: "Starter Plan",
    price: 9.99,
    period: "month",
    productRange: "0-50 products",
    minProducts: 0,
    maxProducts: 50,
    description: "Perfect for new stores",
    features: [
      "Up to 50 products on store",
      "Unlimited notes",
      "Photo attachments",
      "7-day free trial",
    ],
    recommended: false,
  },
  {
    id: "basic",
    name: "Basic",
    planKey: "Basic Plan",
    price: 14.99,
    period: "month",
    productRange: "51-300 products",
    minProducts: 51,
    maxProducts: 300,
    description: "For growing stores",
    features: [
      "Up to 300 products on store",
      "Unlimited notes",
      "Photo attachments",
      "7-day free trial",
    ],
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    planKey: "Pro Plan",
    price: 19.99,
    period: "month",
    productRange: "301-3,000 products",
    minProducts: 301,
    maxProducts: 3000,
    description: "Most popular choice",
    features: [
      "Up to 3,000 products on store",
      "Unlimited notes",
      "Photo attachments",
      "7-day free trial",
    ],
    recommended: true,
  },
  {
    id: "titan",
    name: "Titan",
    planKey: "Titan Plan",
    price: 24.99,
    period: "month",
    productRange: "3,001+ products",
    minProducts: 3001,
    maxProducts: Infinity,  // Unlimited
    description: "For large catalogs",
    features: [
      "Unlimited products on store",
      "Unlimited notes",
      "Photo attachments",
      "7-day free trial",
    ],
    recommended: false,
  },
];

// Helper to find the REQUIRED plan for a given product count (only one plan allowed)
function getRequiredTier(productCount: number): string {
  if (productCount <= 50) return "starter";
  if (productCount <= 300) return "basic";
  if (productCount <= 3000) return "pro";
  return "titan";
}

// Helper to check if a tier is the CORRECT tier for the product count
// Users can ONLY select the plan that matches their range - not higher or lower
function isTierCorrectForProducts(tierId: string, productCount: number): boolean {
  const requiredTier = getRequiredTier(productCount);
  return tierId === requiredTier;
}

// All plan keys for billing.check()
const ALL_PLANS = PRICING_TIERS.map(t => t.planKey);

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing, admin } = await authenticate.admin(request);

  // Check environment variable on server only
  // IS_TEST_BILLING must be "true" for development stores (Shopify requires test mode)
  const isTestBilling = process.env.IS_TEST_BILLING === "true";

  // Check for charge_id in URL - this indicates user just approved billing
  const url = new URL(request.url);
  const chargeId = url.searchParams.get("charge_id");

  // Check all plans to see if the shop has any active subscription
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: ALL_PLANS,
    isTest: isTestBilling,
  });

  // Fetch the current subscription from database FIRST
  const existingSubscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain: session.shop },
  });

  // If Shopify shows an active subscription that's NOT in our database (or has different ID), save it
  // This handles both: returning from billing approval AND syncing any missing subscriptions
  const shopifySubscriptionId = appSubscriptions?.[0]?.id || null;
  const needsSync = hasActivePayment &&
                    appSubscriptions &&
                    appSubscriptions.length > 0 &&
                    (!existingSubscription || existingSubscription.subscriptionId !== shopifySubscriptionId);

  if (needsSync) {
    const activeSubscription = appSubscriptions[0];
    console.log("[BILLING] Syncing subscription to database - Shopify has subscription not in DB");
    console.log("[BILLING] Shopify subscription:", JSON.stringify(activeSubscription, null, 2));
    if (chargeId) {
      console.log("[BILLING] charge_id from URL:", chargeId);
    }

    try {
      // Query Shopify for full subscription details (including test status)
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
            }
          }
        }
      `);
      const data = await response.json();
      const shopifySubscription = data.data?.currentAppInstallation?.activeSubscriptions?.[0];

      if (shopifySubscription) {
        // Calculate trial end date if trial days exist
        let trialEndsAt = null;
        if (shopifySubscription.trialDays && shopifySubscription.trialDays > 0) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + shopifySubscription.trialDays);
          trialEndsAt = trialEnd;
        }

        // Upsert the subscription to database (update if exists, create if not)
        await prisma.billingSubscription.upsert({
          where: { shopDomain: session.shop },
          update: {
            subscriptionId: shopifySubscription.id,
            chargeId: chargeId,
            planName: shopifySubscription.name,
            status: shopifySubscription.status,
            test: shopifySubscription.test || false,
            trialStartedAt: shopifySubscription.trialDays > 0 ? new Date() : null,
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
            trialStartedAt: shopifySubscription.trialDays > 0 ? new Date() : null,
            trialEndsAt: trialEndsAt,
            currentPeriodEnd: shopifySubscription.currentPeriodEnd ? new Date(shopifySubscription.currentPeriodEnd) : null,
          },
        });

        console.log("[BILLING] Subscription saved to database successfully!");
      }
    } catch (error) {
      console.error("[BILLING] Error saving subscription to database:", error);
    }
  }

  // Fetch the subscription from database (after potential save above)
  // Re-query to get the updated data if we just saved
  const subscription = needsSync
    ? await prisma.billingSubscription.findUnique({ where: { shopDomain: session.shop } })
    : existingSubscription;

  // ========== DEBUG: Log all subscription info ==========
  console.log("\n========== BILLING DEBUG ==========");
  console.log("[BILLING DEBUG] Shop:", session.shop);
  console.log("[BILLING DEBUG] IS_TEST_BILLING:", isTestBilling);
  console.log("[BILLING DEBUG] hasActivePayment:", hasActivePayment);
  console.log("[BILLING DEBUG] appSubscriptions from billing.check():", JSON.stringify(appSubscriptions, null, 2));
  console.log("[BILLING DEBUG] Local DB subscription:", JSON.stringify(subscription, null, 2));

  // Also query Shopify directly for full subscription details
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
          }
          allSubscriptions(first: 10) {
            edges {
              node {
                id
                name
                status
                test
                createdAt
              }
            }
          }
        }
      }
    `);
    const data = await response.json();
    console.log("[BILLING DEBUG] Shopify GraphQL - activeSubscriptions:", JSON.stringify(data.data?.currentAppInstallation?.activeSubscriptions, null, 2));
    console.log("[BILLING DEBUG] Shopify GraphQL - allSubscriptions:", JSON.stringify(data.data?.currentAppInstallation?.allSubscriptions?.edges, null, 2));
  } catch (error) {
    console.error("[BILLING DEBUG] GraphQL query error:", error);
  }
  console.log("====================================\n");
  // ========== END DEBUG ==========

  // Get the plan name from Shopify, then convert to tier ID
  const currentPlanName = appSubscriptions?.[0]?.name || subscription?.planName || null;
  const currentTierId = currentPlanName
    ? PRICING_TIERS.find(t => t.planKey === currentPlanName)?.id || null
    : null;

  // Query Shopify for the store's product count
  let productCount = 0;
  try {
    const productCountResponse = await admin.graphql(`
      query {
        productsCount {
          count
        }
      }
    `);
    const productCountData = await productCountResponse.json();
    productCount = productCountData.data?.productsCount?.count || 0;
    console.log("[BILLING] Store product count:", productCount);
  } catch (error) {
    console.error("[BILLING] Error fetching product count:", error);
  }

  // Determine which tier is required based on product count (only ONE tier allowed)
  const requiredTier = getRequiredTier(productCount);
  console.log("[BILLING] Required tier for", productCount, "products:", requiredTier);

  // Explicitly construct the response object to ensure requiredTier is included
  const loaderResponse = {
    subscription,
    hasActivePayment,
    currentTierId,
    shop: session.shop,
    productCount,
    requiredTier: requiredTier,  // Explicitly assign to ensure it's in the response
  };
  console.log("[BILLING] Loader response object:", JSON.stringify({ productCount: loaderResponse.productCount, requiredTier: loaderResponse.requiredTier }));

  return json(loaderResponse);
}

export async function action({ request }: ActionFunctionArgs) {
  const { session, billing, admin, redirect: shopifyRedirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  // Check environment variable on server only
  // IS_TEST_BILLING must be "true" for development stores (Shopify requires test mode)
  const isTestBilling = process.env.IS_TEST_BILLING === "true";

  if (actionType === "subscribe") {
    // Get the selected tier from the form
    const tierId = formData.get("tierId") as string | null;
    const tier = PRICING_TIERS.find((t) => t.id === tierId);

    if (!tier) {
      throw new Response("Invalid pricing tier selected", { status: 400 });
    }

    // Query Shopify for the store's product count to validate plan selection
    let productCount = 0;
    try {
      const productCountResponse = await admin.graphql(`
        query {
          productsCount {
            count
          }
        }
      `);
      const productCountData = await productCountResponse.json();
      productCount = productCountData.data?.productsCount?.count || 0;
      console.log("[BILLING] Validating subscription - Store has", productCount, "products");
    } catch (error) {
      console.error("[BILLING] Error fetching product count for validation:", error);
    }

    // Validate that the selected plan is the CORRECT plan for the store's product count
    // Users can ONLY select the plan that matches their product range
    if (!isTierCorrectForProducts(tier.id, productCount)) {
      const requiredTier = getRequiredTier(productCount);
      const requiredTierData = PRICING_TIERS.find(t => t.id === requiredTier);
      console.log("[BILLING] Plan validation failed:", tier.name, "is not the correct plan for", productCount, "products. Required:", requiredTierData?.name);

      return json({
        error: `Your store has ${productCount.toLocaleString()} products. Based on your product count, you must select the ${requiredTierData?.name} plan (${requiredTierData?.productRange}).`,
        productCount,
        requiredTier: requiredTier,
      }, { status: 400 });
    }

    console.log("[BILLING] Plan validation passed:", tier.name, "is correct for", productCount, "products");

    // Get the launchUrl from Shopify - this is the proper embedded app URL
    // Using launchUrl ensures we return to the app within Shopify admin context
    let returnUrl: string;
    try {
      const launchUrlResponse = await admin.graphql(`
        query {
          currentAppInstallation {
            launchUrl
          }
        }
      `);
      const launchUrlData = await launchUrlResponse.json();
      const launchUrl = launchUrlData.data?.currentAppInstallation?.launchUrl;

      if (launchUrl) {
        // launchUrl is like: https://admin.shopify.com/store/shop-name/apps/app-handle
        // We append /app/billing-status to show billing summary after approval
        returnUrl = `${launchUrl}/app/billing-status`;
        console.log("[BILLING] Using launchUrl for return:", returnUrl);
      } else {
        // Fallback to SHOPIFY_APP_URL if launchUrl not available
        const rawAppUrl = process.env.SHOPIFY_APP_URL?.trim();
        returnUrl = `${rawAppUrl || "https://product-notes-for-staff.up.railway.app"}/app/billing-status`;
        console.log("[BILLING] launchUrl not available, using fallback:", returnUrl);
      }
    } catch (error) {
      console.error("[BILLING] Error getting launchUrl:", error);
      const rawAppUrl = process.env.SHOPIFY_APP_URL?.trim();
      returnUrl = `${rawAppUrl || "https://product-notes-for-staff.up.railway.app"}/app/billing-status`;
      console.log("[BILLING] Error getting launchUrl, using fallback:", returnUrl);
    }

    // Log billing request details for debugging
    console.log("[BILLING] Subscribe request:", {
      tierId,
      plan: tier.planKey,
      isTestBilling: isTestBilling,
      shop: session.shop,
      returnUrl: returnUrl,
      IS_TEST_BILLING_ENV: process.env.IS_TEST_BILLING,
    });

    // First, let's make a manual GraphQL call to see the exact error
    console.log("[BILLING] Making manual GraphQL call to debug...");
    try {
      const testResponse = await admin.graphql(`
        mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $test: Boolean, $trialDays: Int, $lineItems: [AppSubscriptionLineItemInput!]!) {
          appSubscriptionCreate(
            name: $name,
            returnUrl: $returnUrl,
            test: $test,
            trialDays: $trialDays,
            lineItems: $lineItems
          ) {
            appSubscription {
              id
              name
              status
            }
            confirmationUrl
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          name: tier.planKey,
          returnUrl: returnUrl,
          test: isTestBilling,
          trialDays: 7,
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  interval: "EVERY_30_DAYS",
                  price: {
                    amount: tier.price,
                    currencyCode: "USD"
                  }
                }
              }
            }
          ]
        }
      });

      const testData = await testResponse.json();
      console.log("[BILLING] Manual GraphQL response:", JSON.stringify(testData, null, 2));

      // Check for userErrors
      if (testData.data?.appSubscriptionCreate?.userErrors?.length > 0) {
        console.error("[BILLING] USER ERRORS:", JSON.stringify(testData.data.appSubscriptionCreate.userErrors, null, 2));
      }

      // If we got a confirmationUrl, redirect to it using _top to break out of iframe
      if (testData.data?.appSubscriptionCreate?.confirmationUrl) {
        const confirmationUrl = testData.data.appSubscriptionCreate.confirmationUrl;
        console.log("[BILLING] Got confirmation URL, redirecting with _top target:", confirmationUrl);
        // Use Shopify's redirect helper with _top target to break out of the embedded iframe
        return shopifyRedirect(confirmationUrl, { target: '_top' });
      }

    } catch (graphqlError) {
      console.error("[BILLING] Manual GraphQL error:", graphqlError);
      // Try to extract more details
      if (graphqlError && typeof graphqlError === 'object') {
        const errAny = graphqlError as Record<string, unknown>;
        if (errAny.body) {
          console.error("[BILLING] GraphQL error body:", JSON.stringify(errAny.body, null, 2));
        }
        if (errAny.response) {
          console.error("[BILLING] GraphQL error response:", errAny.response);
        }
      }
    }

    // Fall back to the library method
    try {
      // Request billing for the specific plan matching the selected tier
      // billing.request() returns a Response that must be returned for redirect to work
      const billingResponse = await billing.request({
        plan: tier.planKey,
        isTest: isTestBilling,
        returnUrl: returnUrl,
      });

      console.log("[BILLING] billing.request succeeded, returning redirect response");
      return billingResponse;
    } catch (error: unknown) {
      // Log the FULL error object to see GraphQL error details
      console.error("[BILLING] Error creating subscription - FULL ERROR:");

      // Try to iterate through all properties
      if (error && typeof error === 'object') {
        for (const key of Object.keys(error)) {
          console.error(`[BILLING] Error.${key}:`, JSON.stringify((error as Record<string, unknown>)[key], null, 2));
        }
      }

      // Check if this is a Response object with a reauthorize URL
      // Shopify billing sometimes throws a Response that contains the redirect URL
      if (error instanceof Response) {
        const reauthorizeUrl = error.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url");
        console.log("[BILLING] Got Response error, reauthorize URL:", reauthorizeUrl);

        if (reauthorizeUrl) {
          // Redirect user to the billing confirmation page with _top to break out of iframe
          console.log("[BILLING] Redirecting to reauthorize URL with _top target");
          return shopifyRedirect(reauthorizeUrl, { target: '_top' });
        }

        // If no reauthorize URL, return the response as-is
        return error;
      }

      // Return a proper error response for other errors
      throw new Response(
        JSON.stringify({
          error: "Failed to create subscription",
          details: error instanceof Error ? error.message : String(error),
          isTestBilling: isTestBilling,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }

  if (actionType === "cancel") {
    let subscriptionId: string | null = null;
    let isTestSubscription = isTestBilling;

    // First try to get subscription from local database
    const dbSubscription = await prisma.billingSubscription.findUnique({
      where: { shopDomain: session.shop },
    });

    if (dbSubscription) {
      subscriptionId = dbSubscription.subscriptionId;
      isTestSubscription = dbSubscription.test;
      console.log("[BILLING] Found subscription in database:", subscriptionId);
    } else {
      // Fallback: Query Shopify directly for active subscription
      console.log("[BILLING] No subscription in database, querying Shopify...");
      try {
        const response = await admin.graphql(`
          query {
            currentAppInstallation {
              activeSubscriptions {
                id
                name
                status
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
          console.log("[BILLING] Found subscription in Shopify:", subscriptionId, "test:", isTestSubscription);
        }
      } catch (error) {
        console.error("[BILLING] Error querying Shopify for subscription:", error);
      }
    }

    if (subscriptionId) {
      try {
        console.log("[BILLING] Cancelling subscription:", subscriptionId, "isTest:", isTestSubscription);
        await billing.cancel({
          subscriptionId: subscriptionId,
          isTest: isTestSubscription,
          prorate: true,
        });
        console.log("[BILLING] Subscription cancelled successfully!");

        // Update database if subscription exists there
        if (dbSubscription) {
          await prisma.billingSubscription.update({
            where: { shopDomain: session.shop },
            data: { status: "CANCELLED" },
          });
        }
      } catch (error) {
        console.error("[BILLING] Error cancelling subscription:", error);
        throw new Response("Failed to cancel subscription", { status: 500 });
      }
    } else {
      console.log("[BILLING] No subscription found to cancel");
    }

    return redirect("/app/billing?cancelled=true");
  }

  return null;
}

export default function Billing() {
  const loaderData = useLoaderData<typeof loader>();
  const { subscription, hasActivePayment, currentTierId, productCount: storeProductCount, requiredTier: serverRequiredTier } = loaderData;
  const actionData = useActionData<{ error?: string; productCount?: number; requiredTier?: string }>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams, setSearchParams] = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "true";

  // DEBUG: Log raw loader data
  console.log("[BILLING CLIENT] Raw loaderData:", JSON.stringify(loaderData));
  console.log("[BILLING CLIENT] subscription:", subscription);
  console.log("[BILLING CLIENT] subscription?.status:", subscription?.status);
  console.log("[BILLING CLIENT] hasActivePayment:", hasActivePayment);

  // Calculate required tier on client as fallback if server didn't provide it
  const productCountValue = storeProductCount ?? 0;
  const clientCalculatedTier = (() => {
    if (productCountValue <= 50) return "starter";
    if (productCountValue <= 300) return "basic";
    if (productCountValue <= 3000) return "pro";
    return "titan";
  })();

  // Use server-provided tier, or fallback to client calculation
  // This ensures users can ALWAYS subscribe even if server data is missing
  const requiredTier = serverRequiredTier || clientCalculatedTier;

  console.log("[BILLING CLIENT] Product count value:", productCountValue);
  console.log("[BILLING CLIENT] Server requiredTier:", serverRequiredTier);
  console.log("[BILLING CLIENT] Client calculated tier:", clientCalculatedTier);
  console.log("[BILLING CLIENT] Final requiredTier:", requiredTier);

  // DEBUG: Log what the client is receiving
  console.log("[BILLING CLIENT] storeProductCount:", storeProductCount);
  console.log("[BILLING CLIENT] serverRequiredTier from loader:", serverRequiredTier);
  console.log("[BILLING CLIENT] clientCalculatedTier:", clientCalculatedTier);
  console.log("[BILLING CLIENT] Final requiredTier being used:", requiredTier);

  const hasActiveSubscription = subscription?.status === "ACTIVE" || hasActivePayment;
  const currentTier = PRICING_TIERS.find((t) => t.id === currentTierId);
  const requiredTierData = PRICING_TIERS.find((t) => t.id === requiredTier);

  // Helper to check if a tier is the CORRECT tier for the store's product count
  // Only ONE plan is allowed - the one that matches the product range
  // SAFEGUARD: If requiredTier is somehow undefined, allow all tiers so user can subscribe
  const isTierAllowed = (tierId: string): boolean => {
    if (!requiredTier) {
      console.log("[BILLING CLIENT] WARNING: requiredTier is undefined/null, allowing all tiers");
      return true;
    }
    const allowed = tierId === requiredTier;
    console.log("[BILLING CLIENT] isTierAllowed check:", tierId, "===", requiredTier, "=", allowed);
    return allowed;
  };

  // Cancel is now handled by a dedicated page at /app/cancel-subscription

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
                  {currentTier
                    ? `Thank you for being a ${currentTier.name} subscriber! You have access to all features.`
                    : "Thank you for subscribing! You have access to all features."}
                </Text>
                {subscription?.trialEndsAt && (
                  <Text as="p" tone="subdued" suppressHydrationWarning>
                    Trial ends: {format(new Date(subscription.trialEndsAt), "MMMM dd, yyyy")}
                  </Text>
                )}
                <Box paddingBlockStart="200">
                  <Button
                    tone="critical"
                    onClick={() => navigate("/app/cancel-subscription")}
                  >
                    Cancel Subscription
                  </Button>
                </Box>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        {/* DEBUG: Show subscription state (remove after debugging) */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Debug: Subscription State</Text>
              <Text as="p" tone="subdued">
                hasActiveSubscription: {hasActiveSubscription ? "true" : "false"}
              </Text>
              <Text as="p" tone="subdued">
                subscription?.status: {subscription?.status || "null"}
              </Text>
              <Text as="p" tone="subdued">
                hasActivePayment: {hasActivePayment ? "true" : "false"}
              </Text>
              <Text as="p" tone="subdued">
                currentTierId: {currentTierId || "null"}
              </Text>
              {/* Only show cancel button if there's actually an ACTIVE subscription */}
              {hasActiveSubscription && (
                <Box paddingBlockStart="200">
                  <Button
                    tone="critical"
                    onClick={() => navigate("/app/cancel-subscription")}
                  >
                    Cancel Subscription
                  </Button>
                </Box>
              )}
              {!hasActiveSubscription && subscription && (
                <Text as="p" tone="caution">
                  No active subscription to cancel (status: {subscription.status})
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Error banner from action */}
        {actionData?.error && (
          <Layout.Section>
            <Banner
              title="Unable to select this plan"
              tone="critical"
            >
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Store product count info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Your Store
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Text variant="headingLg" as="p">
                  {storeProductCount.toLocaleString()}
                </Text>
                <Text as="span" tone="subdued">
                  products in your store
                </Text>
              </InlineStack>
              <Banner tone="info">
                <Text as="p">
                  Based on your product count, your plan is: <strong>{requiredTierData?.name}</strong> ({requiredTierData?.productRange})
                </Text>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Pricing grid */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 2, lg: 4 }} gap="400">
            {PRICING_TIERS.map((tier) => {
              const isCurrentPlan = tier.id === currentTierId;
              return (
              <div
                key={tier.id}
                style={{
                  height: '100%',
                  ...(isCurrentPlan ? {
                    borderTop: '3px solid #2C6ECB',
                    borderRadius: '8px',
                    marginTop: '-3px',
                  } : {}),
                }}
              >
              <Card background={tier.recommended ? "bg-surface-secondary" : undefined}>
                <BlockStack gap="400">
                  {/* Header with badge */}
                  <InlineStack align="space-between" blockAlign="start">
                    <Text variant="headingMd" as="h3">
                      {tier.name}
                    </Text>
                    {isCurrentPlan ? (
                      <Badge tone="info">Current</Badge>
                    ) : tier.recommended ? (
                      <Badge tone="success">Most Popular</Badge>
                    ) : null}
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
                    {isCurrentPlan ? (
                      <Button fullWidth disabled>
                        Current Plan
                      </Button>
                    ) : !isTierAllowed(tier.id) ? (
                      <BlockStack gap="100">
                        <Button fullWidth disabled>
                          Not Available
                        </Button>
                        <Text as="p" tone="subdued" alignment="center">
                          {tier.productRange}
                        </Text>
                      </BlockStack>
                    ) : hasActiveSubscription ? (
                      <Form method="post">
                        <input type="hidden" name="action" value="subscribe" />
                        <input type="hidden" name="tierId" value={tier.id} />
                        <Button
                          fullWidth
                          variant={tier.recommended ? "primary" : undefined}
                          submit
                          loading={isSubmitting}
                          disabled={isSubmitting}
                        >
                          Switch to {tier.name}
                        </Button>
                      </Form>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="action" value="subscribe" />
                        <input type="hidden" name="tierId" value={tier.id} />
                        <Button
                          fullWidth
                          variant={tier.recommended ? "primary" : undefined}
                          submit
                          loading={isSubmitting}
                          disabled={isSubmitting}
                        >
                          {tier.recommended ? "Start 7-Day Trial" : "Start Trial"}
                        </Button>
                      </Form>
                    )}
                  </Box>
                </BlockStack>
              </Card>
              </div>
              );
            })}
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
