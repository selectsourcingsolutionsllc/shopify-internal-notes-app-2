import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// Public endpoint for UI extensions - get notes for products in an order
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

export async function action({ request, params }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");
  const { orderId } = params;

  console.log("[PUBLIC API] Order notes - orderId:", orderId, "shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  if (request.method === "POST") {
    try {
      const { productIds } = await request.json();

      console.log("[PUBLIC API] Looking for notes for products:", productIds);

      // Fetch notes for all products in the order
      const notes = await prisma.productNote.findMany({
        where: {
          productId: { in: productIds },
          shopDomain: shop,
        },
        include: {
          photos: true,
        },
      });

      console.log("[PUBLIC API] Found", notes.length, "notes");

      // Fetch existing acknowledgments for this order
      const acknowledgments = await prisma.orderAcknowledgment.findMany({
        where: {
          orderId: orderId!,
          shopDomain: shop,
        },
      });

      return json({ notes, acknowledgments });
    } catch (error) {
      console.error("[PUBLIC API] Error:", error);
      return json({ error: "Database error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
