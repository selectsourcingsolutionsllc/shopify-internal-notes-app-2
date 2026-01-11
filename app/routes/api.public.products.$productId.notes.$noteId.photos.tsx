import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";
import { uploadFile, deleteFile } from "../utils/storage.server";
import { validateShopInstalled } from "../utils/shop-validation.server";
import { addCorsHeaders, createCorsResponse } from "../utils/cors.server";

export async function loader({ request, params }: ActionFunctionArgs) {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return createCorsResponse(request);
  }

  const { noteId } = params;
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return addCorsHeaders(json({ error: "Shop parameter required" }, { status: 400 }), request);
  }

  // SECURITY: Validate that this shop has installed the app
  const isValidShop = await validateShopInstalled(shop);
  if (!isValidShop) {
    return addCorsHeaders(json({ error: "Unauthorized" }, { status: 403 }), request);
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
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return addCorsHeaders(json({ error: "Shop parameter required" }, { status: 400 }), request);
  }

  // SECURITY: Validate that this shop has installed the app
  const isValidShop = await validateShopInstalled(shop);
  if (!isValidShop) {
    return addCorsHeaders(json({ error: "Unauthorized" }, { status: 403 }), request);
  }

  // Verify the note exists and belongs to this shop
  const note = await prisma.productNote.findUnique({
    where: { id: noteId },
  });

  if (!note || note.shopDomain !== shop) {
    return addCorsHeaders(json({ error: "Note not found" }, { status: 404 }), request);
  }

  if (request.method === "POST") {
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
