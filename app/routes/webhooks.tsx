import { authenticate, unauthenticated } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import {
  checkOrderNeedsHold,
  applyHoldsToOrder,
} from "../utils/fulfillment-hold.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  if (!shop) {
    throw new Response("No shop provided", { status: 400 });
  }

  // payload is already parsed by authenticate.webhook

  switch (topic) {
    case "APP_UNINSTALLED":
      await handleAppUninstalled(shop);
      break;
    case "ORDERS_CREATE":
      await handleOrderCreated(shop, payload);
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
      console.log(`[Webhook] Unhandled topic: ${topic}`);
      break;
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

async function handleOrderCreated(shop: string, payload: any) {
  console.log(`[Webhook] Order created for shop: ${shop}, order ID: ${payload.id}`);

  try {
    // Extract product IDs from the order line items
    // Convert to Shopify GID format to match how they're stored in the database
    const productIds: string[] = [];
    if (payload.line_items) {
      for (const item of payload.line_items) {
        if (item.product_id) {
          // Webhook sends plain ID like "8433093509208"
          // Database stores as "gid://shopify/Product/8433093509208"
          productIds.push(`gid://shopify/Product/${item.product_id}`);
        }
      }
    }

    if (productIds.length === 0) {
      console.log("[Webhook] No products in order, skipping hold check");
      return;
    }

    console.log("[Webhook] Checking products for notes:", productIds);

    // Check if this order needs a hold
    const needsHold = await checkOrderNeedsHold(shop, productIds);

    if (!needsHold) {
      console.log("[Webhook] Order does not need hold");
      return;
    }

    console.log("[Webhook] Order needs hold, applying...");

    // Get admin API client for this shop
    // This requires an offline session stored in the database
    let admin;
    try {
      const result = await unauthenticated.admin(shop);
      admin = result.admin;
      console.log("[Webhook] Got admin API client for shop:", shop);
    } catch (sessionError) {
      console.error("[Webhook] Failed to get admin session for shop:", shop);
      console.error("[Webhook] Session error:", sessionError);
      console.error("[Webhook] This usually means the app needs to be reinstalled to create an offline session");
      return; // Exit gracefully, don't fail the webhook
    }

    // Apply holds to all fulfillment orders
    const result = await applyHoldsToOrder(admin, String(payload.id));

    if (result.success) {
      console.log("[Webhook] Successfully applied holds to order", payload.id);
    } else {
      console.error("[Webhook] Failed to apply some holds:", result.results);
    }
  } catch (error) {
    console.error("[Webhook] Error handling order created:", error);
    // Don't throw - we don't want to fail the webhook
  }
}