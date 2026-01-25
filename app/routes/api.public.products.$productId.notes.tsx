import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - uses session token for auth
// Session token contains shop domain in the 'dest' claim
// NOTE: CORS headers are handled by Express middleware in server.js

// Helper to check if shop has active subscription
async function checkSubscription(shop: string): Promise<{ hasSubscription: boolean; message?: string }> {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { shopDomain: shop },
  });

  if (!subscription) {
    return {
      hasSubscription: false,
      message: "Start your free trial to add product notes. Visit the app to get started!",
    };
  }

  if (subscription.status !== "ACTIVE") {
    return {
      hasSubscription: false,
      message: "Your subscription is inactive. Please renew to continue adding notes.",
    };
  }

  // Check if trial has expired (if trialEndsAt exists and is in the past)
  if (subscription.trialEndsAt && new Date(subscription.trialEndsAt) < new Date()) {
    // Trial expired but status is still ACTIVE means they're paying - allow it
    // This check is just informational
  }

  return { hasSubscription: true };
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);
  const { productId } = params;

  console.log("[PUBLIC API] GET notes for product:", productId, "shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
  }

  if (!productId) {
    return json({ error: "Missing productId" }, { status: 400 });
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
    return json({ notes });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);
  const { productId } = params;

  console.log("[PUBLIC API] Action:", request.method, "product:", productId, "shop:", shop, "verified:", verified);

  if (!shop || !productId) {
    return json({ error: error || "Missing required parameters" }, { status: 400 });
  }

  // Check subscription before allowing note creation/editing
  const { hasSubscription, message } = await checkSubscription(shop);
  if (!hasSubscription) {
    console.log("[PUBLIC API] Subscription required for shop:", shop);
    return json({
      error: "subscription_required",
      message: message,
      requiresSubscription: true
    }, { status: 403 });
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

      return json({ note });
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

      return json({ note });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
}
