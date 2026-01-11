import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createAuditLog } from "../utils/audit.server";
import { createCorsResponse, addCorsHeaders } from "../utils/cors.server";

// Handle CORS preflight requests
export async function options() {
  return createCorsResponse();
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Handle CORS for direct requests
  if (request.headers.get("Origin")) {
    try {
      const { session } = await authenticate.admin(request);
    } catch (error) {
      // If auth fails, still return CORS headers
      return createCorsResponse();
    }
  }
  
  const { session } = await authenticate.admin(request);
  const { productId } = params;
  
  const notes = await prisma.productNote.findMany({
    where: {
      productId: productId!,
      shopDomain: session.shop,
    },
    include: {
      photos: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  
  const response = json({ notes });
  return addCorsHeaders(response);
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { productId } = params;
  const method = request.method;
  
  if (method === "POST") {
    const { content } = await request.json();
    
    const note = await prisma.productNote.create({
      data: {
        productId: productId!,
        shopDomain: session.shop,
        content,
        createdBy: session.email || session.id,
        updatedBy: session.email || session.id,
      },
    });
    
    await createAuditLog({
      shopDomain: session.shop,
      userId: session.id,
      userEmail: session.email,
      action: "CREATE",
      entityType: "PRODUCT_NOTE",
      entityId: note.id,
      newValue: note,
      productNoteId: note.id,
    });
    
    return json({ note });
  }
  
  if (method === "PUT") {
    const { content, noteId } = await request.json();

    // SECURITY: Verify the note exists AND belongs to this shop before updating
    const oldNote = await prisma.productNote.findUnique({
      where: { id: noteId },
    });

    if (!oldNote) {
      return json({ error: "Note not found" }, { status: 404 });
    }

    if (oldNote.shopDomain !== session.shop) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    const note = await prisma.productNote.update({
      where: { id: noteId },
      data: {
        content,
        updatedBy: session.email || session.id,
      },
    });
    
    await createAuditLog({
      shopDomain: session.shop,
      userId: session.id,
      userEmail: session.email,
      action: "UPDATE",
      entityType: "PRODUCT_NOTE",
      entityId: note.id,
      oldValue: oldNote,
      newValue: note,
      productNoteId: note.id,
    });
    
    return json({ note });
  }
  
  return new Response("Method not allowed", { status: 405 });
}