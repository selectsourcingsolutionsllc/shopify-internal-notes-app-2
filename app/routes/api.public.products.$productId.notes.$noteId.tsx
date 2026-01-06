import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// Public endpoint for UI extensions - delete note

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

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
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
