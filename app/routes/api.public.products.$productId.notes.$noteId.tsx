import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - delete note
// NOTE: CORS headers are handled by Express middleware in server.js

export async function action({ request, params }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);
  const { productId, noteId } = params;

  console.log("[PUBLIC API] DELETE note:", noteId, "product:", productId, "shop:", shop, "verified:", verified);

  if (!shop || !noteId) {
    return json({ error: error || "Missing required parameters" }, { status: 400 });
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
