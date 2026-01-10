import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  checkOrderNeedsHold,
  applyHoldsToOrder,
} from "../utils/fulfillment-hold.server";

// Public endpoint for UI extensions - reset acknowledgments when order page loads
// This ensures every person viewing the order sees notes fresh

// Helper to extract shop domain from session token
function getShopFromToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    if (payload.dest) {
      const url = new URL(payload.dest);
      return url.hostname;
    }
    return null;
  } catch (e) {
    console.error("[RESET API] Error decoding token:", e);
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");

  console.log("[RESET API] Reset acknowledgments - shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
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
