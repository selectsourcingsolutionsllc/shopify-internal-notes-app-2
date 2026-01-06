import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// Public endpoint for UI extensions - no Shopify auth required
// Extensions pass shop domain in query params

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Add CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const { productId } = params;

  console.log("[PUBLIC API] GET notes for product:", productId, "shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400, headers });
  }

  if (!productId) {
    return json({ error: "Missing productId" }, { status: 400, headers });
  }

  try {
    const notes = await prisma.productNote.findMany({
      where: {
        productId: productId,
        shopDomain: shop,
      },
      include: {
        photos: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log("[PUBLIC API] Found", notes.length, "notes");
    return json({ notes }, { headers });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500, headers });
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

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const { productId } = params;

  console.log("[PUBLIC API] Action:", request.method, "product:", productId, "shop:", shop);

  if (!shop || !productId) {
    return json({ error: "Missing required parameters" }, { status: 400, headers });
  }

  try {
    if (request.method === "POST") {
      const { content } = await request.json();

      const note = await prisma.productNote.create({
        data: {
          productId: productId,
          shopDomain: shop,
          content,
          createdBy: "extension-user",
          updatedBy: "extension-user",
        },
      });

      return json({ note }, { headers });
    }

    if (request.method === "PUT") {
      const { content, noteId } = await request.json();

      const note = await prisma.productNote.update({
        where: { id: noteId },
        data: {
          content,
          updatedBy: "extension-user",
        },
      });

      return json({ note }, { headers });
    }

    return json({ error: "Method not allowed" }, { status: 405, headers });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500, headers });
  }
}
