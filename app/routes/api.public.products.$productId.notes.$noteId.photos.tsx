import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";
import { uploadFile, deleteFile } from "../utils/storage.server";
import { getVerifiedShop } from "../utils/shop-validation.server";
import { addCorsHeaders, createCorsResponse } from "../utils/cors.server";
import { checkSubscriptionStatus } from "../utils/subscription-check.server";

export async function loader({ request, params }: ActionFunctionArgs) {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return createCorsResponse(request);
  }

  const { noteId } = params;

  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  if (!shop) {
    return addCorsHeaders(json({ error: error || "Authentication required" }, { status: 403 }), request);
  }

  // Get photos for this note
  const photos = await prisma.productNotePhoto.findMany({
    where: { noteId: noteId! },
    orderBy: { uploadedAt: "desc" },
  });

  return addCorsHeaders(json({ photos }), request);
}

export async function action({ request, params }: ActionFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return createCorsResponse(request);
  }

  const { productId, noteId } = params;

  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  if (!shop) {
    return addCorsHeaders(json({ error: error || "Authentication required" }, { status: 403 }), request);
  }

  // Verify the note exists and belongs to this shop
  const note = await prisma.productNote.findUnique({
    where: { id: noteId },
  });

  if (!note || note.shopDomain !== shop) {
    return addCorsHeaders(json({ error: "Note not found" }, { status: 404 }), request);
  }

  if (request.method === "POST") {
    // Check subscription before allowing photo uploads
    const subscriptionStatus = await checkSubscriptionStatus(shop);
    if (!subscriptionStatus.hasAccess) {
      console.log("[Photo Upload] Subscription check failed for", shop, "- reason:", subscriptionStatus.reason);
      return addCorsHeaders(json({
        error: "subscription_required",
        reason: subscriptionStatus.reason,
        message: subscriptionStatus.message,
        requiresSubscription: true,
      }, { status: 403 }), request);
    }

    try {
      const formData = await request.formData();
      const photo = formData.get("photo") as File;

      if (!photo) {
        return addCorsHeaders(json({ error: "No photo provided" }, { status: 400 }), request);
      }

      // Upload the photo and create thumbnail
      const { url: photoUrl, thumbnailUrl, filename } = await uploadFile(photo, shop, "product-notes");

      // Save photo record
      const photoRecord = await prisma.productNotePhoto.create({
        data: {
          noteId: noteId!,
          url: photoUrl,
          thumbnailUrl,
          filename,
          uploadedBy: "extension-user",
        },
      });

      await createAuditLog({
        shopDomain: shop,
        userId: "extension-user",
        userEmail: null,
        action: "CREATE",
        entityType: "PRODUCT_NOTE_PHOTO",
        entityId: photoRecord.id,
        newValue: photoRecord,
        productNoteId: noteId,
      });

      return addCorsHeaders(json({ photo: photoRecord }), request);
    } catch (error: any) {
      console.error("[Photo Upload] Error:", error);
      return addCorsHeaders(json({ error: error.message || "Upload failed" }, { status: 500 }), request);
    }
  }

  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const photoId = formData.get("photoId") as string;

      if (!photoId) {
        return addCorsHeaders(json({ error: "Photo ID required" }, { status: 400 }), request);
      }

      // Find and delete the photo
      const photo = await prisma.productNotePhoto.findUnique({
        where: { id: photoId },
      });

      if (!photo || photo.noteId !== noteId) {
        return addCorsHeaders(json({ error: "Photo not found" }, { status: 404 }), request);
      }

      // Delete from storage (both original and thumbnail)
      await deleteFile(photo.url, photo.thumbnailUrl || undefined);

      // Delete from database
      await prisma.productNotePhoto.delete({
        where: { id: photoId },
      });

      await createAuditLog({
        shopDomain: shop,
        userId: "extension-user",
        userEmail: null,
        action: "DELETE",
        entityType: "PRODUCT_NOTE_PHOTO",
        entityId: photoId,
        oldValue: photo,
        productNoteId: noteId,
      });

      return addCorsHeaders(json({ success: true }), request);
    } catch (error: any) {
      console.error("[Photo Delete] Error:", error);
      return addCorsHeaders(json({ error: error.message || "Delete failed" }, { status: 500 }), request);
    }
  }

  return addCorsHeaders(json({ error: "Method not allowed" }, { status: 405 }), request);
}
