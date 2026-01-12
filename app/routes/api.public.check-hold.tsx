import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { applyHoldsToOrder, getFulfillmentOrders } from "../utils/fulfillment-hold.server";
import { addHoldNoteToOrder } from "./webhooks";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - check if hold needs to be re-applied
// Called when the extension loads to ensure hold is in place if needed

export async function action({ request }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  console.log("[CHECK-HOLD] Request received - shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
  }

  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const orderId = formData.get("orderId") as string;
      const productIdsJson = formData.get("productIds") as string;

      if (!orderId || !productIdsJson) {
        return json({ error: "Missing orderId or productIds" }, { status: 400 });
      }

      const productIds = JSON.parse(productIdsJson) as string[];
      const sessionId = formData.get("sessionId") as string;

      console.log("[CHECK-HOLD] Checking order:", orderId, "products:", productIds, "sessionId:", sessionId);

      // Check if blockFulfillment is enabled
      const settings = await prisma.appSetting.findUnique({
        where: { shopDomain: shop },
      });

      if (!settings?.blockFulfillment) {
        console.log("[CHECK-HOLD] blockFulfillment is disabled");
        return json({ holdApplied: false, reason: "blockFulfillment disabled" });
      }

      // Check if there are notes for these products
      const notesCount = await prisma.productNote.count({
        where: {
          shopDomain: shop,
          productId: { in: productIds },
        },
      });

      if (notesCount === 0) {
        console.log("[CHECK-HOLD] No notes for products");
        return json({ holdApplied: false, reason: "no notes" });
      }

      // Get admin API client first - we need it to check fulfillment status
      let admin;
      try {
        const result = await unauthenticated.admin(shop);
        admin = result.admin;
      } catch (sessionError) {
        console.error("[CHECK-HOLD] Failed to get admin session:", sessionError);
        return json({ error: "Failed to get admin session" }, { status: 500 });
      }

      // Extract numeric order ID from GID format
      const orderIdMatch = orderId.match(/Order\/(\d+)/);
      const numericOrderId = orderIdMatch ? orderIdMatch[1] : orderId;

      // CHECK IF ORDER IS ALREADY FULFILLED
      // If the order is fulfilled, closed, or cancelled - don't mess with it
      const fulfillmentOrders = await getFulfillmentOrders(admin, numericOrderId);
      const fulfillableStatuses = ["OPEN", "SCHEDULED", "ON_HOLD"];
      const hasUnfulfilledItems = fulfillmentOrders.some(fo => fulfillableStatuses.includes(fo.status));

      if (!hasUnfulfilledItems) {
        console.log("[CHECK-HOLD] Order is already fulfilled/closed - no action needed");
        console.log("[CHECK-HOLD] Fulfillment order statuses:", fulfillmentOrders.map(fo => fo.status));
        return json({ holdApplied: false, reason: "order already fulfilled" });
      }

      // SESSION-BASED LOGIC:
      // Check if acknowledgments exist for this order and compare session IDs
      const existingAcknowledgments = await prisma.orderAcknowledgment.findMany({
        where: {
          shopDomain: shop,
          orderId,
        },
        select: {
          sessionId: true,
          productId: true,
        },
      });

      console.log("[CHECK-HOLD] Existing acknowledgments:", existingAcknowledgments.length);

      if (existingAcknowledgments.length > 0) {
        // Check if any acknowledgment has the same sessionId (meaning same browser session)
        const sameSession = existingAcknowledgments.some(ack => ack.sessionId === sessionId);

        console.log("[CHECK-HOLD] Same session check:", sameSession,
          "- current:", sessionId,
          "- stored:", existingAcknowledgments[0]?.sessionId);

        if (sameSession) {
          // User is still on the same page session - don't re-apply hold
          console.log("[CHECK-HOLD] Same session - user is still on page, no hold needed");
          return json({ holdApplied: false, reason: "same session" });
        }

        // Different session - user left and came back
        // Clear the old acknowledgments so user has to re-acknowledge
        console.log("[CHECK-HOLD] Different session - user left and came back, clearing old acknowledgments");
        const deleteResult = await prisma.orderAcknowledgment.deleteMany({
          where: {
            shopDomain: shop,
            orderId,
          },
        });
        console.log("[CHECK-HOLD] Cleared", deleteResult.count, "old acknowledgments");

        // Flag that we cleared acknowledgments - UI needs to know
        var acknowledgementsCleared = true;
      } else {
        console.log("[CHECK-HOLD] No acknowledgments exist - need to apply hold");
        var acknowledgementsCleared = false;
      }

      // Either no acknowledgments exist, or we just cleared stale ones
      // Need to apply hold

      // Re-apply holds
      const holdResult = await applyHoldsToOrder(admin, numericOrderId);

      console.log("[CHECK-HOLD] Hold apply result:", holdResult);

      if (holdResult.success && holdResult.results.length > 0) {
        // Actually applied holds
        console.log("[CHECK-HOLD] Successfully applied hold to", holdResult.results.length, "fulfillment orders");

        // Add warning note
        await addHoldNoteToOrder(admin, orderId);

        return json({ holdApplied: true, acknowledgementsCleared: true, reason: "hold re-applied" });
      } else if (holdResult.success && holdResult.results.length === 0) {
        // Skipped all - order might already be on hold or in wrong state
        console.log("[CHECK-HOLD] No holds applied - order may already be on hold");

        // Still add warning note if not present
        await addHoldNoteToOrder(admin, orderId);

        return json({ holdApplied: false, acknowledgementsCleared, reason: "order already on hold or not eligible" });
      } else {
        console.log("[CHECK-HOLD] Failed to apply hold:", holdResult.results);
        return json({ holdApplied: false, acknowledgementsCleared: false, reason: "failed to apply hold" });
      }

    } catch (error) {
      console.error("[CHECK-HOLD] Error:", error);
      return json({ error: "Server error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
