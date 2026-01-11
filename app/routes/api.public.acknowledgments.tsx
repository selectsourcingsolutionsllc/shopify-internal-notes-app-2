import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import {
  checkAllNotesAcknowledged,
  releaseHoldsFromOrder,
} from "../utils/fulfillment-hold.server";
import { removeHoldNoteFromOrder } from "./webhooks";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - submit acknowledgments
// NOTE: CORS headers are handled by Express middleware in server.js

export async function action({ request }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  console.log("[PUBLIC API] Acknowledgment - shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
  }

  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const noteId = formData.get("noteId") as string;
      const orderId = formData.get("orderId") as string;
      const productId = formData.get("productId") as string;
      const sessionId = formData.get("sessionId") as string;

      console.log("[PUBLIC API] Acknowledgment - sessionId:", sessionId, "noteId:", noteId);

      // noteId is required now - each acknowledgment is for a specific note
      if (!noteId) {
        return json({ error: "Missing noteId" }, { status: 400 });
      }

      if (!orderId) {
        return json({ error: "Missing orderId" }, { status: 400 });
      }

      // Get the product ID from the note if not provided
      let finalProductId = productId;
      if (!finalProductId) {
        const note = await prisma.productNote.findUnique({
          where: { id: noteId },
        });
        if (note) {
          finalProductId = note.productId;
        } else {
          return json({ error: "Note not found" }, { status: 404 });
        }
      }

      // Upsert by orderId + noteId (unique constraint)
      // This ensures each note is tracked separately
      const acknowledgment = await prisma.orderAcknowledgment.upsert({
        where: {
          orderId_noteId: {
            orderId,
            noteId,
          },
        },
        create: {
          orderId,
          productId: finalProductId,
          shopDomain: shop,
          acknowledgedBy: "extension-user",
          noteId,
          sessionId,
        },
        update: {
          acknowledgedBy: "extension-user",
          acknowledgedAt: new Date(),
          sessionId,
        },
      });

      console.log("[PUBLIC API] Acknowledgment created/updated for note:", noteId);

      // Check if all notes are acknowledged and auto-release hold if so
      const allProductIdsJson = formData.get("allProductIds") as string;
      let allAcknowledged = false;
      let holdReleased = false;

      if (allProductIdsJson) {
        try {
          const allProductIds = JSON.parse(allProductIdsJson) as string[];
          console.log("[PUBLIC API] Checking if all notes acknowledged for order:", orderId);

          allAcknowledged = await checkAllNotesAcknowledged(
            shop,
            orderId,
            allProductIds
          );

          console.log("[PUBLIC API] All acknowledged:", allAcknowledged);

          // If all notes are acknowledged, auto-release the hold
          if (allAcknowledged) {
            console.log("[PUBLIC API] All notes acknowledged - auto-releasing hold...");

            // Get admin API client to release the hold
            const { admin } = await unauthenticated.admin(shop);

            // Extract numeric order ID from GID format
            const orderIdMatch = orderId.match(/Order\/(\d+)/);
            const numericOrderId = orderIdMatch ? orderIdMatch[1] : orderId;

            const result = await releaseHoldsFromOrder(admin, numericOrderId);
            holdReleased = result.success;

            console.log("[PUBLIC API] Hold release result:", result);

            // Remove the "FULFILLMENT BLOCKED" warning from the order note (preserves other notes)
            // Always try to remove when all notes are acknowledged, regardless of hold release result
            try {
              console.log("[PUBLIC API] Attempting to remove hold warning for order:", orderId);
              await removeHoldNoteFromOrder(admin, orderId);
              console.log("[PUBLIC API] Successfully removed hold warning from order note");
            } catch (noteError) {
              console.error("[PUBLIC API] Failed to remove hold warning:", noteError);
            }
          }
        } catch (checkError) {
          console.error("[PUBLIC API] Error checking/releasing:", checkError);
        }
      }

      return json({ acknowledgment, allAcknowledged, holdReleased });
    } catch (error) {
      console.error("[PUBLIC API] Error:", error);
      return json({ error: "Database error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
