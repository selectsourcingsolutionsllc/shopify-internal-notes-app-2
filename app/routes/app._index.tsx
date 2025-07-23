import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  EmptyState,
  Banner,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  const [productNotes, auditLogs, subscription, settings] = await Promise.all([
    prisma.productNote.findMany({
      where: { shopDomain: session.shop },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        photos: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { shopDomain: session.shop },
      orderBy: { timestamp: "desc" },
      take: 5,
    }),
    prisma.billingSubscription.findUnique({
      where: { shopDomain: session.shop },
    }),
    prisma.appSetting.findUnique({
      where: { shopDomain: session.shop },
    }),
  ]);

  const stats = {
    totalNotes: await prisma.productNote.count({
      where: { shopDomain: session.shop },
    }),
    totalAcknowledgments: await prisma.orderAcknowledgment.count({
      where: { shopDomain: session.shop },
    }),
    pendingAcknowledgments: await prisma.orderAcknowledgment.count({
      where: { 
        shopDomain: session.shop,
        acknowledgedAt: null,
      },
    }),
  };

  return json({ 
    productNotes, 
    auditLogs, 
    subscription,
    settings,
    stats,
    shop: session.shop,
  });
}

export default function AppIndex() {
  const { productNotes, auditLogs, subscription, settings, stats, shop } = useLoaderData<typeof loader>();

  const hasActiveSubscription = subscription?.status === "ACTIVE";
  const isInTrial = subscription?.trialEndsAt && new Date(subscription.trialEndsAt) > new Date();

  const productNotesRows = productNotes.map((note) => [
    note.productId,
    note.content.substring(0, 50) + (note.content.length > 50 ? "..." : ""),
    note.photos.length,
    format(new Date(note.updatedAt), "MMM dd, yyyy"),
    <Link to={`/app/notes/${note.id}`}>
      <Button size="slim">View</Button>
    </Link>,
  ]);

  const auditLogRows = auditLogs.map((log) => [
    log.action,
    log.entityType,
    log.userEmail || log.userId,
    format(new Date(log.timestamp), "MMM dd, yyyy HH:mm"),
  ]);

  return (
    <Page
      title="Internal Notes Dashboard"
      primaryAction={{
        content: "View All Notes",
        url: "/app/notes",
      }}
      secondaryActions={[
        {
          content: "Settings",
          url: "/app/settings",
        },
        {
          content: "Export Audit Log",
          url: "/app/audit/export",
        },
      ]}
    >
      {!hasActiveSubscription && !isInTrial && (
        <Banner
          title="Start your free trial"
          status="warning"
          action={{
            content: "Start 14-day trial",
            url: "/app/billing",
          }}
        >
          <p>Get full access to all features with a 14-day free trial.</p>
        </Banner>
      )}

      {isInTrial && (
        <Banner
          title="Free trial active"
          status="info"
        >
          <p>Your trial ends on {format(new Date(subscription.trialEndsAt!), "MMMM dd, yyyy")}.</p>
        </Banner>
      )}

      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <h2 style={{ marginBottom: "20px" }}>Overview</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                <div>
                  <p style={{ fontSize: "14px", color: "#6d7175" }}>Total Notes</p>
                  <p style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.totalNotes}</p>
                </div>
                <div>
                  <p style={{ fontSize: "14px", color: "#6d7175" }}>Total Acknowledgments</p>
                  <p style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.totalAcknowledgments}</p>
                </div>
                <div>
                  <p style={{ fontSize: "14px", color: "#6d7175" }}>Pending Acknowledgments</p>
                  <p style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.pendingAcknowledgments}</p>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2>Recent Product Notes</h2>
                <Button url="/app/notes" size="slim">View All</Button>
              </div>
              {productNotes.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "text"]}
                  headings={["Product ID", "Note", "Photos", "Updated", "Actions"]}
                  rows={productNotesRows}
                />
              ) : (
                <EmptyState
                  heading="No product notes yet"
                  action={{
                    content: "Learn how to add notes",
                    url: "/app/help",
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Product notes will appear here once added through the product detail pages.</p>
                </EmptyState>
              )}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2>Recent Activity</h2>
                <Button url="/app/audit" size="slim">View Full Log</Button>
              </div>
              {auditLogs.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Action", "Type", "User", "Timestamp"]}
                  rows={auditLogRows}
                />
              ) : (
                <p style={{ color: "#6d7175" }}>No recent activity</p>
              )}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <h2 style={{ marginBottom: "20px" }}>Current Settings</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Require Acknowledgment</span>
                  <Badge status={settings?.requireAcknowledgment ? "success" : "neutral"}>
                    {settings?.requireAcknowledgment ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Require Photo Proof</span>
                  <Badge status={settings?.requirePhotoProof ? "success" : "neutral"}>
                    {settings?.requirePhotoProof ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Block Fulfillment</span>
                  <Badge status={settings?.blockFulfillment ? "warning" : "neutral"}>
                    {settings?.blockFulfillment ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
              <div style={{ marginTop: "20px" }}>
                <Button url="/app/settings">Manage Settings</Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}