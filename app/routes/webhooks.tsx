import { authenticate, unauthenticated } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import {
  checkOrderNeedsHold,
  applyHoldsToOrder,
  applyFulfillmentHold,
  checkAllNotesAcknowledged,
  getOrderProductIds,
  getOrderIdFromFulfillmentOrder,
} from "../utils/fulfillment-hold.server";

// Constants for the hold warning note
const HOLD_WARNING_START = "⚠️ FULFILLMENT BLOCKED⚠️:";
const HOLD_WARNING_TEXT = "⚠️ FULFILLMENT BLOCKED⚠️: =============================There is an important product note(s) attached to this order that must be acknowledged before shipping. Please view the order details below and acknowledge all product notes before fulfilling.";
const NOTE_SEPARATOR = "\n\n---\n\n";

// Helper to get existing order note
async function getOrderNote(admin: any, orderGid: string): Promise<string> {
  try {
    const response = await admin.graphql(`
      query getOrder($id: ID!) {
        order(id: $id) {
          note
        }
      }
    `, { variables: { id: orderGid } });
    const data = await response.json();
    return data.data?.order?.note || "";
  } catch (error) {
    console.error("[Webhook] Failed to get order note:", error);
    return "";
  }
}

// Helper to add hold warning to order note (preserves existing notes)
async function addHoldNoteToOrder(admin: any, orderGid: string): Promise<void> {
  const existingNote = await getOrderNote(admin, orderGid);

  // Check if warning already exists
  if (existingNote.includes(HOLD_WARNING_START)) {
    console.log("[Webhook] Hold warning already in note, skipping");
    return;
  }

  // Prepend our warning to existing note
  let newNote = HOLD_WARNING_TEXT;
  if (existingNote.trim()) {
    newNote = HOLD_WARNING_TEXT + NOTE_SEPARATOR + existingNote;
  }

  await admin.graphql(`
    mutation orderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          note
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      input: {
        id: orderGid,
        note: newNote
      }
    }
  });
  console.log("[Webhook] Added hold warning to order note (preserved existing notes)");
}

// Helper to remove hold warning from order note (preserves other notes)
export async function removeHoldNoteFromOrder(admin: any, orderGid: string): Promise<void> {
  const existingNote = await getOrderNote(admin, orderGid);

  if (!existingNote.includes(HOLD_WARNING_START)) {
    console.log("[Webhook] No hold warning in note, nothing to remove");
    return;
  }

  // Remove our warning text (with separator if present)
  let newNote = existingNote;
  if (newNote.includes(HOLD_WARNING_TEXT + NOTE_SEPARATOR)) {
    newNote = newNote.replace(HOLD_WARNING_TEXT + NOTE_SEPARATOR, "");
  } else {
    newNote = newNote.replace(HOLD_WARNING_TEXT, "");
  }

  newNote = newNote.trim();

  await admin.graphql(`
    mutation orderUpdate($input: OrderInput!) {
      orderUpdate(input: $input) {
        order {
          id
          note
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      input: {
        id: orderGid,
        note: newNote
      }
    }
  });
  console.log("[Webhook] Removed hold warning from order note (preserved other notes)");
}

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
    case "FULFILLMENT_ORDERS_HOLD_RELEASED":
      await handleHoldReleased(shop, payload);
      break;
    case "FULFILLMENTS_CREATE":
      await handleFulfillmentCreated(shop, payload);
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

      // Add a note to the order explaining why it's on hold (preserves existing notes)
      const orderGid = `gid://shopify/Order/${payload.id}`;
      try {
        await addHoldNoteToOrder(admin, orderGid);
      } catch (noteError) {
        console.error("[Webhook] Failed to add order note:", noteError);
      }
    } else {
      console.error("[Webhook] Failed to apply some holds:", result.results);
    }
  } catch (error) {
    console.error("[Webhook] Error handling order created:", error);
    // Don't throw - we don't want to fail the webhook
  }
}

async function handleFulfillmentCreated(shop: string, payload: any) {
  console.log(`[Webhook] Fulfillment created for shop: ${shop}`);
  console.log(`[Webhook] Fulfillment payload:`, JSON.stringify(payload, null, 2));

  try {
    // Get fulfillment ID and order ID from payload
    const fulfillmentId = payload.id;
    const orderId = payload.order_id;

    if (!fulfillmentId || !orderId) {
      console.log("[Webhook] Missing fulfillment ID or order ID, skipping");
      return;
    }

    const orderGid = `gid://shopify/Order/${orderId}`;
    console.log(`[Webhook] Fulfillment ${fulfillmentId} created for order ${orderId}`);

    // Check if blockFulfillment is enabled
    const settings = await prisma.appSetting.findUnique({
      where: { shopDomain: shop },
    });

    if (!settings?.blockFulfillment) {
      console.log("[Webhook] blockFulfillment is disabled, not checking acknowledgments");
      return;
    }

    // Check for valid authorization FIRST
    // If user released hold via our app, there should be a valid authorization
    const authorization = await prisma.orderReleaseAuthorization.findUnique({
      where: {
        orderId_shopDomain: {
          orderId: orderGid,
          shopDomain: shop,
        },
      },
    });

    const now = new Date();
    if (authorization && !authorization.consumed && authorization.expiresAt > now) {
      // Valid authorization exists - this fulfillment was done after proper release
      console.log("[Webhook] Valid authorization found - fulfillment was done after proper release");
      return;
    }

    // Get admin API client
    let admin;
    try {
      const result = await unauthenticated.admin(shop);
      admin = result.admin;
    } catch (sessionError) {
      console.error("[Webhook] Failed to get admin session:", sessionError);
      return;
    }

    // Get product IDs from the fulfillment line items
    const productIds: string[] = [];
    if (payload.line_items) {
      for (const item of payload.line_items) {
        if (item.product_id) {
          productIds.push(`gid://shopify/Product/${item.product_id}`);
        }
      }
    }

    if (productIds.length === 0) {
      console.log("[Webhook] No products in fulfillment, skipping");
      return;
    }

    console.log("[Webhook] Products in fulfillment:", productIds);

    // Check if this order has products with notes
    const notesCount = await prisma.productNote.count({
      where: {
        shopDomain: shop,
        productId: { in: productIds },
      },
    });

    if (notesCount === 0) {
      console.log("[Webhook] No notes for products in this fulfillment, allowing");
      return;
    }

    // Products have notes and NO valid authorization - CANCEL THE FULFILLMENT!
    console.log("[Webhook] Products have notes and NO authorization! CANCELING fulfillment...");

    // Add a note to the order explaining why fulfillment was blocked (preserves existing notes)
    try {
      await addHoldNoteToOrder(admin, orderGid);
    } catch (noteError) {
      console.error("[Webhook] Failed to add order note:", noteError);
    }

    const fulfillmentGid = `gid://shopify/Fulfillment/${fulfillmentId}`;

    const cancelResponse = await admin.graphql(`
      mutation fulfillmentCancel($id: ID!) {
        fulfillmentCancel(id: $id) {
          fulfillment {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: { id: fulfillmentGid }
    });

    const cancelResult = await cancelResponse.json();
    console.log("[Webhook] Cancel result:", JSON.stringify(cancelResult, null, 2));

    if (cancelResult.data?.fulfillmentCancel?.userErrors?.length > 0) {
      console.error("[Webhook] Failed to cancel fulfillment:", cancelResult.data.fulfillmentCancel.userErrors);
    } else {
      console.log("[Webhook] Successfully CANCELED fulfillment", fulfillmentId);

      // Clear acknowledgments and re-apply the hold to the order
      console.log("[Webhook] Clearing acknowledgments and re-applying hold to order...");

      await prisma.orderAcknowledgment.deleteMany({
        where: {
          shopDomain: shop,
          orderId: orderGid,
        },
      });

      const holdResult = await applyHoldsToOrder(admin, String(orderId));
      if (holdResult.success) {
        console.log("[Webhook] Successfully re-applied hold after cancellation");
      }
    }
  } catch (error) {
    console.error("[Webhook] Error handling fulfillment created:", error);
  }
}

async function handleHoldReleased(shop: string, payload: any) {
  console.log(`[Webhook] Hold released for shop: ${shop}`);
  console.log(`[Webhook] Payload:`, JSON.stringify(payload, null, 2));

  try {
    // The payload contains the fulfillment order that had its hold released
    // Extract fulfillment order ID - it might be a GID or plain ID
    let fulfillmentOrderId = payload.fulfillment_order?.id || payload.id;

    if (!fulfillmentOrderId) {
      console.log("[Webhook] Missing fulfillment order ID, skipping");
      return;
    }

    // Extract numeric ID if it's a GID
    const foMatch = String(fulfillmentOrderId).match(/FulfillmentOrder\/(\d+)/);
    const fulfillmentOrderNumericId = foMatch ? foMatch[1] : fulfillmentOrderId;

    console.log(`[Webhook] Fulfillment order ID: ${fulfillmentOrderNumericId}`);

    // Get admin API client for this shop
    let admin;
    try {
      const result = await unauthenticated.admin(shop);
      admin = result.admin;
    } catch (sessionError) {
      console.error("[Webhook] Failed to get admin session:", sessionError);
      return;
    }

    // Order ID might not be in the payload - we need to look it up
    let orderId = payload.fulfillment_order?.order_id || payload.order_id;

    if (!orderId) {
      console.log("[Webhook] Order ID not in payload, looking it up...");
      // Use the GID format for the lookup
      const fulfillmentOrderGid = String(fulfillmentOrderId).startsWith('gid://')
        ? fulfillmentOrderId
        : `gid://shopify/FulfillmentOrder/${fulfillmentOrderNumericId}`;
      orderId = await getOrderIdFromFulfillmentOrder(admin, fulfillmentOrderGid);

      if (!orderId) {
        console.log("[Webhook] Could not find order ID, skipping");
        return;
      }
      console.log("[Webhook] Found order ID:", orderId);
    }

    const orderGid = `gid://shopify/Order/${orderId}`;
    console.log(`[Webhook] Hold released on fulfillment order ${fulfillmentOrderNumericId} for order ${orderId}`);

    // Check if blockFulfillment is enabled
    const settings = await prisma.appSetting.findUnique({
      where: { shopDomain: shop },
    });

    if (!settings?.blockFulfillment) {
      console.log("[Webhook] blockFulfillment is disabled, not re-applying hold");
      return;
    }

    // CHECK FOR VALID AUTHORIZATION FIRST
    // If this release was done via our app, there will be a valid authorization
    // Note: Shopify sometimes sends duplicate webhooks, so we also accept recently consumed authorizations
    const authorization = await prisma.orderReleaseAuthorization.findUnique({
      where: {
        orderId_shopDomain: {
          orderId: orderGid,
          shopDomain: shop,
        },
      },
    });

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Accept authorization if:
    // 1. Not consumed and not expired (first webhook), OR
    // 2. Already consumed but created within last minute (duplicate webhook)
    if (authorization && authorization.expiresAt > now) {
      if (!authorization.consumed) {
        // First webhook - consume the authorization
        console.log("[Webhook] Valid authorization found - this is a legitimate release via our app");

        await prisma.orderReleaseAuthorization.update({
          where: { id: authorization.id },
          data: { consumed: true },
        });

        console.log("[Webhook] Authorization consumed - hold will stay released");
        return;
      } else if (authorization.createdAt > oneMinuteAgo) {
        // Duplicate webhook - authorization was just consumed, still valid
        console.log("[Webhook] Authorization already consumed (duplicate webhook) - hold will stay released");
        return;
      }
    }

    // NO VALID AUTHORIZATION - This is an unauthorized release (someone clicked Shopify's Unhold button)
    console.log("[Webhook] NO VALID AUTHORIZATION - This is an unauthorized release attempt!");

    // Get product IDs from the order
    const productIds = await getOrderProductIds(admin, String(orderId));

    if (productIds.length === 0) {
      console.log("[Webhook] No products found in order, not re-applying hold");
      return;
    }

    console.log("[Webhook] Products in order:", productIds);

    // Check if this order has products with notes that need acknowledgment
    const notesCount = await prisma.productNote.count({
      where: {
        shopDomain: shop,
        productId: { in: productIds },
      },
    });

    if (notesCount === 0) {
      console.log("[Webhook] No notes for products in this order, hold can stay released");
      return;
    }

    // Products have notes - RE-APPLY THE HOLD!
    console.log("[Webhook] Order has products with notes - RE-APPLYING HOLD!");

    // Add a note to the order explaining why hold was re-applied (preserves existing notes)
    try {
      await addHoldNoteToOrder(admin, orderGid);
    } catch (noteError) {
      console.error("[Webhook] Failed to add order note:", noteError);
    }

    // Also clear any existing acknowledgments to force re-acknowledgment
    const deleteResult = await prisma.orderAcknowledgment.deleteMany({
      where: {
        shopDomain: shop,
        orderId: orderGid,
      },
    });
    console.log("[Webhook] Cleared", deleteResult.count, "existing acknowledgments");

    const fulfillmentOrderGid = `gid://shopify/FulfillmentOrder/${fulfillmentOrderNumericId}`;
    const holdResult = await applyFulfillmentHold(admin, fulfillmentOrderGid);

    if (holdResult.success) {
      console.log("[Webhook] Successfully RE-APPLIED hold to fulfillment order", fulfillmentOrderNumericId);
    } else {
      console.error("[Webhook] Failed to re-apply hold:", holdResult.error);
    }
  } catch (error) {
    console.error("[Webhook] Error handling hold released:", error);
  }
}