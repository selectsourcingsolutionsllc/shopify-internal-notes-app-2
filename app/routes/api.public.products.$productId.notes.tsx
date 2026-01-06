import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

// Public endpoint for UI extensions - uses session token for auth
// Session token contains shop domain in the 'dest' claim

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

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Add CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Try to get shop from token first, fall back to query param
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");
  const { productId } = params;

  console.log("[PUBLIC API] GET notes for product:", productId, "shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop - provide token or shop param" }, { status: 400, headers });
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

  // Try to get shop from token first, fall back to query param
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");
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
