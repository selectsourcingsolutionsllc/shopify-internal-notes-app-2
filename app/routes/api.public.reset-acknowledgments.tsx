import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  checkOrderNeedsHold,
  applyHoldsToOrder,
} from "../utils/fulfillment-hold.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - reset acknowledgments when order page loads
// This ensures every person viewing the order sees notes fresh

export async function action({ request }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  console.log("[RESET API] Reset acknowledgments - shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { orderId, productIds } = body;

      if (!orderId) {
        return json({ error: "Missing orderId" }, { status: 400 });
      }

      console.log("[RESET API] Resetting acknowledgments for order:", orderId);

      // Delete all existing acknowledgments for this order
      const deleteResult = await prisma.orderAcknowledgment.deleteMany({
        where: {
          shopDomain: shop,
          orderId: orderId,
        },
      });

      console.log("[RESET API] Deleted", deleteResult.count, "acknowledgments");

      // Check if this order needs a hold (has products with notes)
      if (productIds && productIds.length > 0) {
        const needsHold = await checkOrderNeedsHold(shop, productIds);

        if (needsHold) {
          console.log("[RESET API] Order needs hold, applying...");

          try {
            // Get admin API client to apply the hold
            const { admin } = await unauthenticated.admin(shop);

            // Extract numeric order ID from GID format
            const orderIdMatch = orderId.match(/Order\/(\d+)/);
            const numericOrderId = orderIdMatch ? orderIdMatch[1] : orderId;

            const result = await applyHoldsToOrder(admin, numericOrderId);
            console.log("[RESET API] Hold apply result:", result);

            return json({
              success: true,
              deletedCount: deleteResult.count,
              holdApplied: result.success,
            });
          } catch (holdError) {
            console.error("[RESET API] Error applying hold:", holdError);
            // Still return success for the reset, just note hold failed
            return json({
              success: true,
              deletedCount: deleteResult.count,
              holdApplied: false,
              holdError: "Failed to apply hold",
            });
          }
        }
      }

      return json({
        success: true,
        deletedCount: deleteResult.count,
        holdApplied: false,
      });
    } catch (error) {
      console.error("[RESET API] Error:", error);
      return json({ error: "Database error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
