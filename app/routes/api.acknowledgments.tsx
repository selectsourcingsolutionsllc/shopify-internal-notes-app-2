import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";
import { uploadFile } from "../utils/storage.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (request.method === "POST") {
    const formData = await request.formData();
    const noteId = formData.get("noteId") as string;
    const orderId = formData.get("orderId") as string;
    const productId = formData.get("productId") as string;
    const photo = formData.get("photo") as File | null;
    
    let proofPhotoUrl = null;
    let proofPhotoName = null;
    
    if (photo) {
      const { url, filename } = await uploadFile(photo, session.shop, "acknowledgments");
      proofPhotoUrl = url;
      proofPhotoName = filename;
    }
    
    // Get the product ID from the note if not provided
    let finalProductId = productId;
    if (!finalProductId && noteId) {
      const note = await prisma.productNote.findUnique({
        where: { id: noteId },
      });
      if (note) {
        finalProductId = note.productId;
      }
    }

    // Validate that we have a productId before proceeding
    if (!finalProductId) {
      return json({ error: "Missing productId - provide productId or valid noteId" }, { status: 400 });
    }

    const acknowledgment = await prisma.orderAcknowledgment.upsert({
      where: {
        orderId_productId: {
          orderId,
          productId: finalProductId,
        },
      },
      create: {
        orderId,
        productId: finalProductId,
        shopDomain: session.shop,
        acknowledgedBy: session.email || session.id,
        proofPhotoUrl,
        proofPhotoName,
        noteId,
      },
      update: {
        acknowledgedBy: session.email || session.id,
        acknowledgedAt: new Date(),
        proofPhotoUrl,
        proofPhotoName,
      },
    });
    
    await createAuditLog({
      shopDomain: session.shop,
      userId: session.id,
      userEmail: session.email,
      action: "ACKNOWLEDGE",
      entityType: "ORDER_ACKNOWLEDGMENT",
      entityId: acknowledgment.id,
      newValue: acknowledgment,
      acknowledgmentId: acknowledgment.id,
    });
    
    return json({ acknowledgment });
  }
  
  return new Response("Method not allowed", { status: 405 });
}