import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

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

      return json({ acknowledgment });
    } catch (error) {
      console.error("[PUBLIC API] Error:", error);
      return json({ error: "Database error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
