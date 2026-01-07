import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";
import { uploadFile, deleteFile } from "../utils/storage.server";

// CORS headers for extension access
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function loader({ request, params }: ActionFunctionArgs) {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { noteId } = params;
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400, headers: corsHeaders });
  }

  // Get photos for this note
  const photos = await prisma.productNotePhoto.findMany({
    where: { noteId: noteId! },
    orderBy: { uploadedAt: "desc" },
  });

  return json({ photos }, { headers: corsHeaders });
}

export async function action({ request, params }: ActionFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { productId, noteId } = params;
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter required" }, { status: 400, headers: corsHeaders });
  }

  // Verify the note exists and belongs to this shop
  const note = await prisma.productNote.findUnique({
    where: { id: noteId },
  });

  if (!note || note.shopDomain !== shop) {
    return json({ error: "Note not found" }, { status: 404, headers: corsHeaders });
  }

  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const photo = formData.get("photo") as File;

      if (!photo) {
        return json({ error: "No photo provided" }, { status: 400, headers: corsHeaders });
      }

      // Upload the photo
      const { url: photoUrl, filename } = await uploadFile(photo, shop, "product-notes");

      // Save photo record
      const photoRecord = await prisma.productNotePhoto.create({
        data: {
          noteId: noteId!,
          url: photoUrl,
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

      return json({ photo: photoRecord }, { headers: corsHeaders });
    } catch (error: any) {
      console.error("[Photo Upload] Error:", error);
      return json({ error: error.message || "Upload failed" }, { status: 500, headers: corsHeaders });
    }
  }

  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const photoId = formData.get("photoId") as string;

      if (!photoId) {
        return json({ error: "Photo ID required" }, { status: 400, headers: corsHeaders });
      }

      // Find and delete the photo
      const photo = await prisma.productNotePhoto.findUnique({
        where: { id: photoId },
      });

      if (!photo || photo.noteId !== noteId) {
        return json({ error: "Photo not found" }, { status: 404, headers: corsHeaders });
      }

      // Delete from storage
      await deleteFile(photo.url);

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

      return json({ success: true }, { headers: corsHeaders });
    } catch (error: any) {
      console.error("[Photo Delete] Error:", error);
      return json({ error: error.message || "Delete failed" }, { status: 500, headers: corsHeaders });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
}
