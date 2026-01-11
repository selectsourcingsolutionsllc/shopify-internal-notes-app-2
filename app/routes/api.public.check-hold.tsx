import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { applyHoldsToOrder } from "../utils/fulfillment-hold.server";
import { addHoldNoteToOrder } from "./webhooks";

// Public endpoint for UI extensions - check if hold needs to be re-applied
// Called when the extension loads to ensure hold is in place if needed

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
    console.error("[CHECK-HOLD] Error decoding token:", e);
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");

  console.log("[CHECK-HOLD] Request received - shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
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
      console.log("[CHECK-HOLD] Checking order:", orderId, "products:", productIds);

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

      // Check for valid authorization
      // Accept if: not expired AND (not consumed OR consumed within last minute)
      // The "consumed within last minute" handles the case where the webhook already consumed it
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const authorization = await prisma.orderReleaseAuthorization.findUnique({
        where: {
          orderId_shopDomain: {
            orderId,
            shopDomain: shop,
          },
        },
      });

      if (authorization && authorization.expiresAt > now) {
        // Authorization exists and hasn't expired
        if (!authorization.consumed) {
          console.log("[CHECK-HOLD] Valid unconsumed authorization exists, no hold needed");
          return json({ holdApplied: false, reason: "valid authorization" });
        } else if (authorization.createdAt > oneMinuteAgo) {
          // Was consumed but created recently - this is from a legitimate release
          console.log("[CHECK-HOLD] Recently consumed authorization exists, no hold needed");
          return json({ holdApplied: false, reason: "recently consumed authorization" });
        }
      }

      // No valid authorization - need to re-apply hold
      console.log("[CHECK-HOLD] No valid authorization, re-applying hold...");

      // Clear any existing acknowledgments so user has to re-acknowledge
      const deleteResult = await prisma.orderAcknowledgment.deleteMany({
        where: {
          shopDomain: shop,
          orderId,
        },
      });
      console.log("[CHECK-HOLD] Cleared", deleteResult.count, "old acknowledgments");

      // Get admin API client
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

      // Re-apply holds
      const holdResult = await applyHoldsToOrder(admin, numericOrderId);

      if (holdResult.success) {
        console.log("[CHECK-HOLD] Successfully re-applied hold");

        // Add warning note
        await addHoldNoteToOrder(admin, orderId);

        return json({ holdApplied: true, reason: "hold re-applied" });
      } else {
        console.log("[CHECK-HOLD] Failed to apply hold:", holdResult.results);
        return json({ holdApplied: false, reason: "failed to apply hold" });
      }

    } catch (error) {
      console.error("[CHECK-HOLD] Error:", error);
      return json({ error: "Server error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
