import prisma from "../db.server";

// Hold handle that identifies our app's holds
const HOLD_HANDLE = "internal-notes-acknowledgment";

interface FulfillmentOrder {
  id: string;
  status: string;
}

interface HoldResult {
  success: boolean;
  fulfillmentOrderId?: string;
  error?: string;
}

/**
 * Get product IDs from an order via GraphQL
 */
export async function getOrderProductIds(
  admin: any,
  orderId: string
): Promise<string[]> {
  try {
    const response = await admin.graphql(
      `#graphql
      query GetOrderProducts($orderId: ID!) {
        order(id: $orderId) {
          lineItems(first: 50) {
            nodes {
              product {
                id
              }
            }
          }
        }
      }`,
      {
        variables: {
          orderId: `gid://shopify/Order/${orderId}`,
        },
      }
    );

    const data = await response.json();
    const lineItems = data?.data?.order?.lineItems?.nodes || [];

    // Extract unique product IDs
    const productIds = new Set<string>();
    for (const item of lineItems) {
      if (item.product?.id) {
        productIds.add(item.product.id);
      }
    }

    return Array.from(productIds);
  } catch (error) {
    console.error("[FulfillmentHold] Error getting order products:", error);
    return [];
  }
}
/**
 * Get order ID from a fulfillment order ID
 */
export async function getOrderIdFromFulfillmentOrder(
  admin: any,
  fulfillmentOrderId: string
): Promise<string | null> {
  try {
    const response = await admin.graphql(
      \`#graphql
      query GetFulfillmentOrderDetails($id: ID!) {
        fulfillmentOrder(id: $id) {
          id
          order {
            id
          }
        }
      }\`,
      {
        variables: {
          id: fulfillmentOrderId,
        },
      }
    );

    const data = await response.json();
    const orderId = data?.data?.fulfillmentOrder?.order?.id;

    if (orderId) {
      // Extract numeric ID from gid://shopify/Order/123456
      const match = orderId.match(/Order\/(\d+)/);
      return match ? match[1] : null;
    }

    return null;
  } catch (error) {
    console.error("[FulfillmentHold] Error getting order from fulfillment order:", error);
    return null;
  }
}


/**
 * Get fulfillment orders for a Shopify order
 */
export async function getFulfillmentOrders(
  admin: any,
  orderId: string
): Promise<FulfillmentOrder[]> {
  const response = await admin.graphql(
    `#graphql
    query GetFulfillmentOrders($orderId: ID!) {
      order(id: $orderId) {
        fulfillmentOrders(first: 10) {
          nodes {
            id
            status
          }
        }
      }
    }`,
    {
      variables: {
        orderId: `gid://shopify/Order/${orderId}`,
      },
    }
  );

  const data = await response.json();
  return data?.data?.order?.fulfillmentOrders?.nodes || [];
}

/**
 * Apply a fulfillment hold to a fulfillment order
 */
export async function applyFulfillmentHold(
  admin: any,
  fulfillmentOrderId: string
): Promise<HoldResult> {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation FulfillmentOrderHold($fulfillmentHold: FulfillmentOrderHoldInput!, $id: ID!) {
        fulfillmentOrderHold(fulfillmentHold: $fulfillmentHold, id: $id) {
          fulfillmentOrder {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: fulfillmentOrderId,
          fulfillmentHold: {
            reason: "OTHER",
            reasonNotes: "Product notes require acknowledgment before fulfillment",
            notifyMerchant: false,
          },
        },
      }
    );

    const data = await response.json();

    if (data?.data?.fulfillmentOrderHold?.userErrors?.length > 0) {
      const errors = data.data.fulfillmentOrderHold.userErrors;
      console.error("[FulfillmentHold] Error applying hold:", errors);
      return {
        success: false,
        error: errors.map((e: any) => e.message).join(", "),
      };
    }

    console.log("[FulfillmentHold] Hold applied to:", fulfillmentOrderId);
    return {
      success: true,
      fulfillmentOrderId,
    };
  } catch (error) {
    console.error("[FulfillmentHold] Exception applying hold:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Release all fulfillment holds for a fulfillment order
 */
export async function releaseFulfillmentHold(
  admin: any,
  fulfillmentOrderId: string
): Promise<HoldResult> {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation FulfillmentOrderReleaseHold($id: ID!) {
        fulfillmentOrderReleaseHold(id: $id) {
          fulfillmentOrder {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: fulfillmentOrderId,
        },
      }
    );

    const data = await response.json();

    if (data?.data?.fulfillmentOrderReleaseHold?.userErrors?.length > 0) {
      const errors = data.data.fulfillmentOrderReleaseHold.userErrors;
      console.error("[FulfillmentHold] Error releasing hold:", errors);
      return {
        success: false,
        error: errors.map((e: any) => e.message).join(", "),
      };
    }

    console.log("[FulfillmentHold] Hold released from:", fulfillmentOrderId);
    return {
      success: true,
      fulfillmentOrderId,
    };
  } catch (error) {
    console.error("[FulfillmentHold] Exception releasing hold:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if an order has products with notes that need acknowledgment
 */
export async function checkOrderNeedsHold(
  shopDomain: string,
  productIds: string[]
): Promise<boolean> {
  // Get app settings
  const settings = await prisma.appSetting.findUnique({
    where: { shopDomain },
  });

  // If blockFulfillment is disabled, no hold needed
  if (!settings?.blockFulfillment) {
    console.log("[FulfillmentHold] blockFulfillment is disabled for", shopDomain);
    return false;
  }

  // Check if any products have notes
  const notesCount = await prisma.productNote.count({
    where: {
      shopDomain,
      productId: { in: productIds },
    },
  });

  console.log("[FulfillmentHold] Found", notesCount, "notes for products:", productIds);
  return notesCount > 0;
}

/**
 * Check if all notes for an order have been acknowledged
 */
export async function checkAllNotesAcknowledged(
  shopDomain: string,
  orderId: string,
  productIds: string[]
): Promise<boolean> {
  // Get all notes for products in this order
  const notes = await prisma.productNote.findMany({
    where: {
      shopDomain,
      productId: { in: productIds },
    },
    select: { id: true, productId: true },
  });

  if (notes.length === 0) {
    // No notes = all acknowledged
    return true;
  }

  // Get acknowledgments for this order
  const acknowledgments = await prisma.orderAcknowledgment.findMany({
    where: {
      shopDomain,
      orderId,
      productId: { in: productIds },
    },
    select: { productId: true },
  });

  // Check if every product with notes has an acknowledgment
  const acknowledgedProductIds = new Set(acknowledgments.map(a => a.productId));
  const productsWithNotes = new Set(notes.map(n => n.productId));

  for (const productId of productsWithNotes) {
    if (!acknowledgedProductIds.has(productId)) {
      console.log("[FulfillmentHold] Product", productId, "not acknowledged yet");
      return false;
    }
  }

  console.log("[FulfillmentHold] All notes acknowledged for order", orderId);
  return true;
}

/**
 * Apply holds to all fulfillment orders for a Shopify order
 */
export async function applyHoldsToOrder(
  admin: any,
  orderId: string
): Promise<{ success: boolean; results: HoldResult[] }> {
  const fulfillmentOrders = await getFulfillmentOrders(admin, orderId);
  const results: HoldResult[] = [];

  for (const fo of fulfillmentOrders) {
    // Only apply hold to orders that are in a state that can be held
    if (fo.status === "OPEN" || fo.status === "SCHEDULED") {
      const result = await applyFulfillmentHold(admin, fo.id);
      results.push(result);
    } else {
      console.log("[FulfillmentHold] Skipping", fo.id, "- status is", fo.status);
    }
  }

  return {
    success: results.every(r => r.success),
    results,
  };
}

/**
 * Release holds from all fulfillment orders for a Shopify order
 */
export async function releaseHoldsFromOrder(
  admin: any,
  orderId: string
): Promise<{ success: boolean; results: HoldResult[] }> {
  const fulfillmentOrders = await getFulfillmentOrders(admin, orderId);
  const results: HoldResult[] = [];

  for (const fo of fulfillmentOrders) {
    // Only release from orders that are on hold
    if (fo.status === "ON_HOLD") {
      const result = await releaseFulfillmentHold(admin, fo.id);
      results.push(result);
    } else {
      console.log("[FulfillmentHold] Skipping release for", fo.id, "- status is", fo.status);
    }
  }

  return {
    success: results.every(r => r.success),
    results,
  };
}
