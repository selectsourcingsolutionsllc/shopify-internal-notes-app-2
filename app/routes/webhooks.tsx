import { authenticate, unauthenticated } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import {
  checkOrderNeedsHold,
  applyHoldsToOrder,
  applyFulfillmentHold,
  checkAllNotesAcknowledged,
  getOrderProductIds,
} from "../utils/fulfillment-hold.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  // Log ALL incoming webhooks to help debug
  console.log(`[Webhook] ======== INCOMING WEBHOOK ========`);
  console.log(`[Webhook] Topic: ${topic}`);
  console.log(`[Webhook] Shop: ${shop}`);
  console.log(`[Webhook] ===================================`);

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
    case "FULFILLMENT_HOLDS_RELEASED":
      await handleHoldReleased(shop, payload);
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

async function handleHoldReleased(shop: string, payload: any) {
  console.log(`[Webhook] Hold released for shop: ${shop}`);
  console.log(`[Webhook] Payload:`, JSON.stringify(payload, null, 2));

  try {
    // The payload contains the fulfillment order that had its hold released
    const fulfillmentOrderId = payload.fulfillment_order?.id || payload.id;
    const orderId = payload.fulfillment_order?.order_id || payload.order_id;

    if (!fulfillmentOrderId || !orderId) {
      console.log("[Webhook] Missing fulfillment order or order ID, skipping");
      return;
    }

    console.log(`[Webhook] Hold released on fulfillment order ${fulfillmentOrderId} for order ${orderId}`);

    // Get admin API client for this shop
    let admin;
    try {
      const result = await unauthenticated.admin(shop);
      admin = result.admin;
    } catch (sessionError) {
      console.error("[Webhook] Failed to get admin session:", sessionError);
      return;
    }

    // Get product IDs from the order
    const productIds = await getOrderProductIds(admin, String(orderId));

    if (productIds.length === 0) {
      console.log("[Webhook] No products found in order, not re-applying hold");
      return;
    }

    console.log("[Webhook] Products in order:", productIds);

    // Check if blockFulfillment is enabled
    const settings = await prisma.appSetting.findUnique({
      where: { shopDomain: shop },
    });

    if (!settings?.blockFulfillment) {
      console.log("[Webhook] blockFulfillment is disabled, not re-applying hold");
      return;
    }

    // Check if all notes have been acknowledged
    const allAcknowledged = await checkAllNotesAcknowledged(
      shop,
      `gid://shopify/Order/${orderId}`,
      productIds
    );

    if (allAcknowledged) {
      console.log("[Webhook] All notes acknowledged, hold can stay released");
      return;
    }

    // Notes NOT acknowledged - RE-APPLY THE HOLD!
    console.log("[Webhook] Notes NOT acknowledged! Re-applying hold...");

    const fulfillmentOrderGid = `gid://shopify/FulfillmentOrder/${fulfillmentOrderId}`;
    const holdResult = await applyFulfillmentHold(admin, fulfillmentOrderGid);

    if (holdResult.success) {
      console.log("[Webhook] Successfully RE-APPLIED hold to fulfillment order", fulfillmentOrderId);
    } else {
      console.error("[Webhook] Failed to re-apply hold:", holdResult.error);
    }
  } catch (error) {
    console.error("[Webhook] Error handling hold released:", error);
  }
}
// CodeRabbit review trigger - safe to remove
