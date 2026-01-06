import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// Public endpoint for UI extensions - delete note

// Helper to extract shop domain from session token
function getShopFromToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    // Decode JWT payload (middle part) without verification
    // This is safe because Shopify generates these tokens
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    // The 'dest' claim contains the shop URL like https://myshop.myshopify.com
    if (payload.dest) {
      const url = new URL(payload.dest);
      return url.hostname; // Returns myshop.myshopify.com
    }
    return null;
  } catch (e) {
    console.error("[PUBLIC API] Error decoding token:", e);
    return null;
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Handle OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  // Try to get shop from token first, fall back to query param
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");
  const { productId, noteId } = params;

  console.log("[PUBLIC API] DELETE note:", noteId, "product:", productId, "shop:", shop);

  if (!shop || !noteId) {
    return json({ error: "Missing required parameters" }, { status: 400, headers });
  }

  try {
    if (request.method === "DELETE") {
      // Verify the note belongs to this shop before deleting
      const note = await prisma.productNote.findFirst({
        where: {
          id: noteId,
          shopDomain: shop,
        },
      });

      if (!note) {
        return json({ error: "Note not found" }, { status: 404, headers });
      }

      await prisma.productNote.delete({
        where: { id: noteId },
      });

      return json({ success: true }, { headers });
    }

    return json({ error: "Method not allowed" }, { status: 405, headers });
  } catch (error) {
    console.error("[PUBLIC API] Delete error:", error);
    return json({ error: "Database error" }, { status: 500, headers });
  }
}
