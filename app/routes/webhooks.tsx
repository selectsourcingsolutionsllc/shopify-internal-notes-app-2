import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, session } = await authenticate.webhook(request);

  if (!shop) {
    throw new Response("No shop provided", { status: 400 });
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      await handleAppUninstalled(shop);
      break;
    case "CUSTOMERS_DATA_REQUEST":
      await handleCustomerDataRequest(shop);
      break;
    case "CUSTOMERS_REDACT":
      await handleCustomerRedact(shop);
      break;
    case "SHOP_REDACT":
      await handleShopRedact(shop);
      break;
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
}

async function handleAppUninstalled(shop: string) {
  // Delete all data associated with the shop
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { shopDomain: shop } }),
    prisma.productNotePhoto.deleteMany({
      where: { note: { shopDomain: shop } },
    }),
    prisma.productNote.deleteMany({ where: { shopDomain: shop } }),
    prisma.orderAcknowledgment.deleteMany({ where: { shopDomain: shop } }),
    prisma.appSetting.deleteMany({ where: { shopDomain: shop } }),
    prisma.billingSubscription.deleteMany({ where: { shopDomain: shop } }),
    prisma.session.deleteMany({ where: { shop } }),
  ]);
}

async function handleCustomerDataRequest(shop: string) {
  // Log the data request for compliance
  console.log(`Customer data requested for shop: ${shop}`);
  // In a real app, you would notify the merchant about this request
}

async function handleCustomerRedact(shop: string) {
  // Since we don't store customer data, just log for compliance
  console.log(`Customer data redaction requested for shop: ${shop}`);
}

async function handleShopRedact(shop: string) {
  // This is called 48 hours after app uninstall
  // Ensure all shop data is removed
  await handleAppUninstalled(shop);
}