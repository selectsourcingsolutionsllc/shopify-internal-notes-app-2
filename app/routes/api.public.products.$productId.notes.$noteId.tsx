import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// Public endpoint for UI extensions - delete note
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
  // Try to get shop from token first, fall back to query param
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");
  const { productId, noteId } = params;

  console.log("[PUBLIC API] DELETE note:", noteId, "product:", productId, "shop:", shop);

  if (!shop || !noteId) {
    return json({ error: "Missing required parameters" }, { status: 400 });
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
        return json({ error: "Note not found" }, { status: 404 });
      }

      await prisma.productNote.delete({
        where: { id: noteId },
      });

      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("[PUBLIC API] Delete error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
}
