import prisma from "../db.server";

interface CreateAuditLogParams {
  shopDomain: string;
  userId: string;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  productNoteId?: string;
  acknowledgmentId?: string;
}

export async function createAuditLog(params: CreateAuditLogParams) {
  return prisma.auditLog.create({
    data: {
      shopDomain: params.shopDomain,
      userId: params.userId,
      userEmail: params.userEmail || "",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      productNoteId: params.productNoteId,
      acknowledgmentId: params.acknowledgmentId,
    },
  });
}
// CodeRabbit review trigger - safe to remove
