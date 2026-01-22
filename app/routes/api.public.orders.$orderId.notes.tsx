import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - get notes for products in an order
// NOTE: CORS headers are handled by Express middleware in server.js

export async function action({ request, params }: ActionFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);
  const { orderId } = params;

  console.log("[PUBLIC API] Order notes - orderId:", orderId, "shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
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
      // Log photo counts for each note
      notes.forEach((note: any) => {
        console.log(`[PUBLIC API] Note ${note.id}: ${note.photos?.length || 0} photos`);
      });

      // Fetch existing acknowledgments for this order
      const acknowledgments = await prisma.orderAcknowledgment.findMany({
        where: {
          orderId: orderId!,
          shopDomain: shop,
        },
      });

      // Get product titles from Shopify in a single batch query
      const productTitles: Record<string, string> = {};
      if (productIds.length > 0) {
        try {
          const { admin } = await unauthenticated.admin(shop);
          const response = await admin.graphql(
            `#graphql
            query getProducts($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Product {
                  id
                  title
                }
              }
            }`,
            { variables: { ids: productIds } }
          );

          const data = await response.json();
          if (data.data?.nodes) {
            for (const product of data.data.nodes) {
              if (product?.id && product?.title) {
                productTitles[product.id] = product.title;
              }
            }
          }
          console.log("[PUBLIC API] Fetched product titles:", Object.keys(productTitles).length);
        } catch (error) {
          console.error("[PUBLIC API] Failed to fetch product titles:", error);
        }
      }

      // Add product titles to notes
      const notesWithTitles = notes.map(note => ({
        ...note,
        productTitle: productTitles[note.productId] || null,
      }));

      return json({ notes: notesWithTitles, acknowledgments });
    } catch (error) {
      console.error("[PUBLIC API] Error:", error);
      return json({ error: "Database error" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
}
