import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  Checkbox,
  Button,
  Banner,
  Badge,
  InlineStack,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useCallback } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, billing } = await authenticate.admin(request);

  let settings = await prisma.appSetting.findUnique({
    where: { shopDomain: session.shop },
  });

  // Create default settings if they don't exist
  if (!settings) {
    settings = await prisma.appSetting.create({
      data: {
        shopDomain: session.shop,
        requireAcknowledgment: true,
        requirePhotoProof: false,
        blockFulfillment: true,
      },
    });
  }

  // Get subscription status
  const subscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain: session.shop },
  });

  const { hasActivePayment } = await billing.check({
    plans: ["Pro Plan"],
    isTest: true,
  });

  const isInTrial = subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
  const hasActiveSubscription = subscription?.status === "ACTIVE" || hasActivePayment;

  return json({ settings, hasActiveSubscription, isInTrial });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const requireAcknowledgment = formData.get("requireAcknowledgment") === "true";
  const requirePhotoProof = formData.get("requirePhotoProof") === "true";
  const blockFulfillment = formData.get("blockFulfillment") === "true";
  
  const oldSettings = await prisma.appSetting.findUnique({
    where: { shopDomain: session.shop },
  });
  
  const settings = await prisma.appSetting.update({
    where: { shopDomain: session.shop },
    data: {
      requireAcknowledgment,
      requirePhotoProof,
      blockFulfillment,
    },
  });
  
  // Create audit log for settings change
  await prisma.auditLog.create({
    data: {
      shopDomain: session.shop,
      userId: session.id,
      userEmail: session.email || "",
      action: "UPDATE",
      entityType: "APP_SETTINGS",
      entityId: settings.id,
      oldValue: oldSettings,
      newValue: settings,
    },
  });
  
  return redirect("/app/settings?saved=true");
}

export default function Settings() {
  const { settings, hasActiveSubscription, isInTrial } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [requireAcknowledgment, setRequireAcknowledgment] = useState(settings.requireAcknowledgment);
  const [requirePhotoProof, setRequirePhotoProof] = useState(settings.requirePhotoProof);
  const [blockFulfillment, setBlockFulfillment] = useState(settings.blockFulfillment);

  // Tether the two settings together - when one changes, the other follows
  const handleRequireAcknowledgmentChange = useCallback((checked: boolean) => {
    setRequireAcknowledgment(checked);
    setBlockFulfillment(checked);
  }, []);

  const handleBlockFulfillmentChange = useCallback((checked: boolean) => {
    setBlockFulfillment(checked);
    setRequireAcknowledgment(checked);
  }, []);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("requireAcknowledgment", String(requireAcknowledgment));
    formData.append("requirePhotoProof", String(requirePhotoProof));
    formData.append("blockFulfillment", String(blockFulfillment));
    submit(formData, { method: "post" });
  }, [requireAcknowledgment, requirePhotoProof, blockFulfillment, submit]);

  const [searchParams, setSearchParams] = useSearchParams();
  const saved = searchParams.get("saved") === "true";
  
  return (
    <Page
      title="Settings"
      breadcrumbs={[{ content: "Dashboard", url: "/app" }]}
    >
      <Layout>
        {saved && (
          <Layout.Section>
            <Banner
              title="Settings saved"
              status="success"
              onDismiss={() => {
                setSearchParams({});
              }}
            />
          </Layout.Section>
        )}
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <h2 style={{ marginBottom: "20px" }}>Order Fulfillment Settings</h2>
              
              <FormLayout>
                <Checkbox
                  label="Require acknowledgment of product notes"
                  helpText="Staff must acknowledge all product notes before fulfilling orders"
                  checked={requireAcknowledgment}
                  onChange={handleRequireAcknowledgmentChange}
                />
                
{/* HIDDEN: Require photo proof setting - set to true to show */}
                {false && (
                <Checkbox
                  label="Require photo proof for acknowledgments"
                  helpText="Staff must upload a photo when acknowledging product notes"
                  checked={requirePhotoProof}
                  onChange={setRequirePhotoProof}
                  disabled={!requireAcknowledgment}
                />
                )}
                
                <Checkbox
                  label="Block order fulfillment until acknowledged"
                  helpText="Prevent orders from being fulfilled until all product notes are acknowledged"
                  checked={blockFulfillment}
                  onChange={handleBlockFulfillmentChange}
                />
              </FormLayout>
              
              <div style={{ marginTop: "24px" }}>
                <Button
                  primary
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Subscription & Billing</Text>
                  <Badge tone={hasActiveSubscription ? "success" : isInTrial ? "info" : "warning"}>
                    {hasActiveSubscription ? "Active" : isInTrial ? "Trial" : "Inactive"}
                  </Badge>
                </InlineStack>

                <Text as="p" tone="subdued">
                  {hasActiveSubscription
                    ? "Your Pro Plan subscription is active. Manage your billing settings below."
                    : isInTrial
                    ? "You're on a free trial. Subscribe to continue using all features."
                    : "Start your 14-day free trial to access all features."}
                </Text>

                <Button url="/app/billing" variant="primary">
                  {hasActiveSubscription ? "Manage Subscription" : "View Plans & Pricing"}
                </Button>
              </BlockStack>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <h2 style={{ marginBottom: "20px" }}>How Settings Work</h2>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h3 style={{ marginBottom: "8px", fontSize: "16px", fontWeight: "600" }}>
                    Require Acknowledgment
                  </h3>
                  <p style={{ color: "#6d7175" }}>
                    When enabled, staff members will see product notes during order fulfillment 
                    and must acknowledge them before proceeding.
                  </p>
                </div>
                
{/* HIDDEN: Photo Proof explanation - set to true to show */}
                {false && (
                <div>
                  <h3 style={{ marginBottom: "8px", fontSize: "16px", fontWeight: "600" }}>
                    Photo Proof
                  </h3>
                  <p style={{ color: "#6d7175" }}>
                    Requires staff to upload a photo as proof when acknowledging notes.
                    Useful for quality control and training purposes.
                  </p>
                </div>
                )}
                
                <div>
                  <h3 style={{ marginBottom: "8px", fontSize: "16px", fontWeight: "600" }}>
                    Block Fulfillment
                  </h3>
                  <p style={{ color: "#6d7175" }}>
                    Prevents orders from being marked as fulfilled until all product notes 
                    have been acknowledged. This ensures important information is never missed.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}