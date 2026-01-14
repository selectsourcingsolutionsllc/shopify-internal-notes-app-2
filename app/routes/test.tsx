import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Layout, Text, Button } from "@shopify/polaris";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Skip Shopify authentication for testing
  const testShop = "test-shop.myshopify.com";
  
  try {
    // Test database connection
    await prisma.$connect();
    
    // Create or get test settings
    const settings = await prisma.appSetting.upsert({
      where: { shopDomain: testShop },
      create: {
        shopDomain: testShop,
        requireAcknowledgment: true,
        requirePhotoProof: false,
        blockFulfillment: true,
      },
      update: {},
    });
    
    // Get some test data
    const productNotes = await prisma.productNote.findMany({
      where: { shopDomain: testShop },
      take: 5,
      include: { photos: true },
    });
    
    const auditLogs = await prisma.auditLog.findMany({
      where: { shopDomain: testShop },
      take: 5,
      orderBy: { timestamp: "desc" },
    });
    
    return json({ 
      settings, 
      productNotes, 
      auditLogs,
      status: "success" 
    });
  } catch (error) {
    return json({ 
      error: error.message, 
      status: "error" 
    });
  }
}

export default function TestPage() {
  const data = useLoaderData<typeof loader>();
  
  if (data.status === "error") {
    return (
      <Page title="Test Page - Error">
        <Layout>
          <Layout.Section>
            <Card>
              <Text as="h2" variant="headingMd">Database Connection Error</Text>
              <Text as="p">{data.error}</Text>
              <Text as="p">Make sure PostgreSQL is running and DATABASE_URL is correct in .env</Text>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }
  
  return (
    <Page title="Product Notes for Staff - Test Mode">
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text as="h2" variant="headingMd">✅ App Structure Test</Text>
              <div style={{ marginTop: "16px" }}>
                <Text as="p">Database: Connected</Text>
                <Text as="p">Settings: {data.settings ? "Created" : "Not found"}</Text>
                <Text as="p">Product Notes: {data.productNotes.length} found</Text>
                <Text as="p">Audit Logs: {data.auditLogs.length} found</Text>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text as="h3" variant="headingMd">Test Data</Text>
              <div style={{ marginTop: "16px" }}>
                <Text as="h4">Settings:</Text>
                <pre style={{ fontSize: "12px", background: "#f6f6f7", padding: "10px", borderRadius: "4px" }}>
                  {JSON.stringify(data.settings, null, 2)}
                </pre>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Text as="h3" variant="headingMd">Next Steps</Text>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <Text as="p">1. ✅ Database connection working</Text>
                <Text as="p">2. ✅ Prisma models working</Text>
                <Text as="p">3. ✅ Remix routes working</Text>
                <Text as="p">4. ✅ Polaris components working</Text>
                <Text as="p">5. 🔄 Next: Set up Shopify Partner account</Text>
              </div>
              
              <div style={{ marginTop: "20px" }}>
                <Button 
                  url="/test/create-sample-data"
                  primary
                >
                  Create Sample Data
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}