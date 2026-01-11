import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";

// SECURITY: This route is disabled in production
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export async function loader({ request }: LoaderFunctionArgs) {
  // Block in production
  if (IS_PRODUCTION) {
    throw new Response("Not Found", { status: 404 });
  }
  return redirect("/test");
}

export async function action({ request }: ActionFunctionArgs) {
  // Block in production - return 404 to not reveal route exists
  if (IS_PRODUCTION) {
    throw new Response("Not Found", { status: 404 });
  }

  const testShop = "test-shop.myshopify.com";
  const testUser = "test-user@example.com";

  try {
    // Create sample product notes
    const sampleNotes = [
      {
        productId: "gid://shopify/Product/123456789",
        content: "This product has a known defect in the blue variant. Check quality before shipping.",
        shopDomain: testShop,
        createdBy: testUser,
        updatedBy: testUser,
      },
      {
        productId: "gid://shopify/Product/987654321", 
        content: "Customer reported loose packaging. Double-check all items before fulfillment.",
        shopDomain: testShop,
        createdBy: testUser,
        updatedBy: testUser,
      },
      {
        productId: "gid://shopify/Product/555666777",
        content: "New batch received. Quality improved significantly - ready for normal shipping.",
        shopDomain: testShop,
        createdBy: testUser,
        updatedBy: testUser,
      }
    ];
    
    for (const noteData of sampleNotes) {
      const note = await prisma.productNote.create({
        data: noteData,
      });
      
      // Create audit log
      await createAuditLog({
        shopDomain: testShop,
        userId: "test-user-id",
        userEmail: testUser,
        action: "CREATE",
        entityType: "PRODUCT_NOTE",
        entityId: note.id,
        newValue: note,
        productNoteId: note.id,
      });
    }
    
    // Create sample acknowledgments
    const sampleAcknowledgments = [
      {
        orderId: "gid://shopify/Order/111222333",
        productId: "gid://shopify/Product/123456789",
        shopDomain: testShop,
        acknowledgedBy: testUser,
      },
      {
        orderId: "gid://shopify/Order/444555666",
        productId: "gid://shopify/Product/987654321",
        shopDomain: testShop,
        acknowledgedBy: "another-user@example.com",
      }
    ];
    
    for (const ackData of sampleAcknowledgments) {
      const acknowledgment = await prisma.orderAcknowledgment.create({
        data: ackData,
      });
      
      // Create audit log
      await createAuditLog({
        shopDomain: testShop,
        userId: "test-user-id",
        userEmail: ackData.acknowledgedBy,
        action: "ACKNOWLEDGE",
        entityType: "ORDER_ACKNOWLEDGMENT",
        entityId: acknowledgment.id,
        newValue: acknowledgment,
        acknowledgmentId: acknowledgment.id,
      });
    }
    
    return json({ success: true, message: "Sample data created successfully!" });
    
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}