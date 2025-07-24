import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Handle CORS preflight requests
export async function options() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
    },
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  const { orderId } = params;
  
  if (request.method === "POST") {
    const { productIds } = await request.json();
    
    // Fetch notes for all products in the order
    const notes = await prisma.productNote.findMany({
      where: {
        productId: { in: productIds },
        shopDomain: session.shop,
      },
      include: {
        photos: true,
      },
    });
    
    // Fetch existing acknowledgments for this order
    const acknowledgments = await prisma.orderAcknowledgment.findMany({
      where: {
        orderId: orderId!,
        shopDomain: session.shop,
      },
    });
    
    // Get product titles from Shopify
    const productTitles: Record<string, string> = {};
    for (const productId of productIds) {
      try {
        const response = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              title
            }
          }`,
          { variables: { id: productId } }
        );
        
        const data = await response.json();
        if (data.data?.product?.title) {
          productTitles[productId] = data.data.product.title;
        }
      } catch (error) {
        console.error(`Failed to fetch product title for ${productId}:`, error);
      }
    }
    
    // Add product titles to notes
    const notesWithTitles = notes.map(note => ({
      ...note,
      productTitle: productTitles[note.productId] || null,
    }));
    
    return json({ notes: notesWithTitles, acknowledgments }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
      },
    });
  }
  
  return new Response("Method not allowed", { 
    status: 405,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
    },
  });
}