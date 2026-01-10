import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";
import { uploadFile } from "../utils/storage.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { noteId } = params;
  
  if (request.method === "POST") {
    const formData = await request.formData();
    const photo = formData.get("photo") as File;
    
    if (!photo) {
      return json({ error: "No photo provided" }, { status: 400 });
    }
    
    const note = await prisma.productNote.findUnique({
      where: { id: noteId },
    });
    
    if (!note || note.shopDomain !== session.shop) {
      return new Response("Not found", { status: 404 });
    }
    
    // Upload the photo and create thumbnail
    const { url, thumbnailUrl, filename } = await uploadFile(photo, session.shop, "product-notes");

    // Save photo record
    const photoRecord = await prisma.productNotePhoto.create({
      data: {
        noteId: noteId!,
        url,
        thumbnailUrl,
        filename,
        uploadedBy: session.email || session.id,
      },
    });
    
    await createAuditLog({
      shopDomain: session.shop,
      userId: session.id,
      userEmail: session.email,
      action: "CREATE",
      entityType: "PRODUCT_NOTE_PHOTO",
      entityId: photoRecord.id,
      newValue: photoRecord,
      productNoteId: noteId,
    });
    
    return json({ photo: photoRecord });
  }
  
  return new Response("Method not allowed", { status: 405 });
}
// CodeRabbit review trigger - safe to remove
