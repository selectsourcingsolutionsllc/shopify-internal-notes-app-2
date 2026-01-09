import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  checkAllNotesAcknowledged,
  releaseHoldsFromOrder,
} from "../utils/fulfillment-hold.server";

// Public endpoint for UI extensions - submit acknowledgments
// NOTE: CORS headers are handled by Express middleware in server.js

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
    console.error("[PUBLIC API] Error decoding token:", e);
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");

  console.log("[PUBLIC API] Acknowledgment - shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const noteId = formData.get("noteId") as string;
      const orderId = formData.get("orderId") as string;
      const productId = formData.get("productId") as string;

      // Get the product ID from the note if not provided
      let finalProductId = productId;
      if (!finalProductId && noteId) {
        const note = await prisma.productNote.findUnique({
          where: { id: noteId },
        });
        if (note) {
          finalProductId = note.productId;
        }
      }

      if (!orderId || !finalProductId) {
        return json({ error: "Missing orderId or productId" }, { status: 400 });
      }

      const acknowledgment = await prisma.orderAcknowledgment.upsert({
        where: {
          orderId_productId: {
            orderId,
            productId: finalProductId,
          },
        },
        create: {
          orderId,
          productId: finalProductId,
          shopDomain: shop,
          acknowledgedBy: "extension-user",
          noteId,
        },
        update: {
          acknowledgedBy: "extension-user",
          acknowledgedAt: new Date(),
        },
      });

      // Check if all notes are acknowledged and release hold if so
      const allProductIdsJson = formData.get("allProductIds") as string;
      if (allProductIdsJson) {
        try {
          const allProductIds = JSON.parse(allProductIdsJson) as string[];
          console.log("[PUBLIC API] Checking if all notes acknowledged for order:", orderId);

          const allAcknowledged = await checkAllNotesAcknowledged(
            shop,
            orderId,
            allProductIds
          );

          if (allAcknowledged) {
            console.log("[PUBLIC API] All notes acknowledged! Releasing hold...");

            // Get admin API client to release the hold
            const { admin } = await unauthenticated.admin(shop);
            const result = await releaseHoldsFromOrder(admin, orderId);

            console.log("[PUBLIC API] Hold release result:", result);
            return json({ acknowledgment, holdReleased: result.success });
          }
        } catch (holdError) {
          console.error("[PUBLIC API] Error checking/releasing hold:", holdError);
          // Don't fail the acknowledgment if hold release fails
        }
      }

      return json({ acknowledgment });
    } catch (error) {
      console.error("[PUBLIC API] Error:", error);
      return json({ error: "Database error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
