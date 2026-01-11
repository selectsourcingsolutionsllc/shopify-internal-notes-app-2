import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  checkAllNotesAcknowledged,
  releaseHoldsFromOrder,
} from "../utils/fulfillment-hold.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - explicitly release hold after acknowledgment
// This creates an authorization token so webhooks know this is a legitimate release
// The authorization expires in 60 seconds - enough time for the release to complete

export async function action({ request }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  console.log("[RELEASE API] Release hold request - shop:", shop, "verified:", verified);

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

      console.log("[RELEASE API] Checking acknowledgments for order:", orderId);

      // First, verify all notes are actually acknowledged
      const allAcknowledged = await checkAllNotesAcknowledged(
        shop,
        orderId,
        productIds || []
      );

      if (!allAcknowledged) {
        console.log("[RELEASE API] Not all notes acknowledged - refusing to release hold");
        return json({
          success: false,
          error: "All notes must be acknowledged before releasing hold",
        }, { status: 403 });
      }

      console.log("[RELEASE API] All notes acknowledged - creating authorization and releasing hold...");

      // Create authorization token BEFORE releasing hold
      // This allows the webhook to know this is a legitimate release
      const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds from now

      await prisma.orderReleaseAuthorization.upsert({
        where: {
          orderId_shopDomain: {
            orderId,
            shopDomain: shop,
          },
        },
        create: {
          orderId,
          shopDomain: shop,
          expiresAt,
          consumed: false,
        },
        update: {
          expiresAt,
          consumed: false,
        },
      });

      console.log("[RELEASE API] Authorization created, expires at:", expiresAt);

      // Get admin API client to release the hold
      const { admin } = await unauthenticated.admin(shop);

      // Extract numeric order ID from GID format if needed
      const orderIdMatch = orderId.match(/Order\/(\d+)/);
      const numericOrderId = orderIdMatch ? orderIdMatch[1] : orderId;

      const result = await releaseHoldsFromOrder(admin, numericOrderId);

      console.log("[RELEASE API] Hold release result:", result);

      return json({
        success: result.success,
        holdReleased: result.success,
        results: result.results,
      });
    } catch (error) {
      console.error("[RELEASE API] Error:", error);
      return json({ error: "Failed to release hold" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
