import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { noteId } = params;
  
  if (request.method === "DELETE") {
    const note = await prisma.productNote.findUnique({
      where: { id: noteId },
      include: { photos: true },
    });
    
    if (!note || note.shopDomain !== session.shop) {
      return new Response("Not found", { status: 404 });
    }
    
    // Delete associated photos first
    await prisma.productNotePhoto.deleteMany({
      where: { noteId: noteId },
    });
    
    // Delete the note
    await prisma.productNote.delete({
      where: { id: noteId },
    });
    
    await createAuditLog({
      shopDomain: session.shop,
      userId: session.id,
      userEmail: session.email,
      action: "DELETE",
      entityType: "PRODUCT_NOTE",
      entityId: noteId!,
      oldValue: note,
    });
    
    return json({ success: true });
  }
  
  return new Response("Method not allowed", { status: 405 });
}