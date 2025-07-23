import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  List,
  Badge,
} from "@shopify/polaris";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";

const MONTHLY_PLAN = "Pro Plan";

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
  
  if (action === "subscribe") {
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
  const { subscription, hasActivePayment, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const urlParams = new URLSearchParams(window.location.search);
  const cancelled = urlParams.get("cancelled") === "true";
  
  const isInTrial = subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();
  const hasActiveSubscription = subscription?.status === "ACTIVE" || hasActivePayment;
  
  const handleSubscribe = () => {
    const formData = new FormData();
    formData.append("action", "subscribe");
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
      title="Billing"
      breadcrumbs={[{ content: "Dashboard", url: "/app" }]}
    >
      <Layout>
        {cancelled && (
          <Layout.Section>
            <Banner
              title="Subscription cancelled"
              status="info"
              onDismiss={() => {
                window.history.replaceState({}, "", "/app/billing");
              }}
            >
              <p>Your subscription has been cancelled. You can resubscribe at any time.</p>
            </Banner>
          </Layout.Section>
        )}
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2>Subscription Status</h2>
                <Badge status={hasActiveSubscription ? "success" : "neutral"}>
                  {hasActiveSubscription ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              {isInTrial && (
                <Banner status="info">
                  <p>
                    Your free trial ends on {format(new Date(subscription.trialEndsAt!), "MMMM dd, yyyy")}.
                    Subscribe now to ensure uninterrupted access.
                  </p>
                </Banner>
              )}
              
              {!hasActiveSubscription && !isInTrial && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ marginBottom: "16px" }}>
                    Start your 14-day free trial to access all features:
                  </p>
                  <List>
                    <List.Item>Add unlimited product notes with photos</List.Item>
                    <List.Item>Require acknowledgments during fulfillment</List.Item>
                    <List.Item>Track all changes with audit logs</List.Item>
                    <List.Item>Export data for compliance</List.Item>
                    <List.Item>Block fulfillment until notes are acknowledged</List.Item>
                  </List>
                </div>
              )}
              
              <div style={{ marginTop: "24px" }}>
                {!hasActiveSubscription ? (
                  <Button
                    primary
                    size="large"
                    onClick={handleSubscribe}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    Start 14-Day Free Trial
                  </Button>
                ) : (
                  <div>
                    <p style={{ marginBottom: "16px", color: "#6d7175" }}>
                      You have an active subscription. Thank you for using Internal Notes!
                    </p>
                    {subscription?.currentPeriodEnd && (
                      <p style={{ marginBottom: "16px", color: "#6d7175" }}>
                        Next billing date: {format(new Date(subscription.currentPeriodEnd), "MMMM dd, yyyy")}
                      </p>
                    )}
                    <Button
                      destructive
                      onClick={handleCancel}
                      loading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <h2 style={{ marginBottom: "20px" }}>Pro Plan - $19.99/month</h2>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
                <div>
                  <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: "600" }}>
                    Features Included
                  </h3>
                  <List>
                    <List.Item>Unlimited product notes</List.Item>
                    <List.Item>Photo attachments</List.Item>
                    <List.Item>Order fulfillment integration</List.Item>
                    <List.Item>Audit logging</List.Item>
                    <List.Item>CSV exports</List.Item>
                    <List.Item>Team collaboration</List.Item>
                  </List>
                </div>
                
                <div>
                  <h3 style={{ marginBottom: "12px", fontSize: "16px", fontWeight: "600" }}>
                    Benefits
                  </h3>
                  <List>
                    <List.Item>Reduce fulfillment errors</List.Item>
                    <List.Item>Improve team communication</List.Item>
                    <List.Item>Track compliance</List.Item>
                    <List.Item>Train new staff effectively</List.Item>
                    <List.Item>Document quality issues</List.Item>
                    <List.Item>24/7 support</List.Item>
                  </List>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}