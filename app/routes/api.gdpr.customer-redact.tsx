import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { shop_id, shop_domain, customer, orders_to_redact } = await request.json();

  console.log(`Customer redaction request received for shop: ${shop_domain}`);
  console.log(`Customer ID: ${customer.id}`);

  let redactedCount = 0;

  if (orders_to_redact && orders_to_redact.length > 0) {
    const orderIds = orders_to_redact.map((order: any) => order.id.toString());

    // Find and redact acknowledgments for these orders
    const acknowledgments = await prisma.orderAcknowledgment.findMany({
      where: {
        orderId: { in: orderIds },
        shopDomain: shop_domain,
      },
    });

    // Redact personal information from acknowledgments
    for (const ack of acknowledgments) {
      await prisma.orderAcknowledgment.update({
        where: { id: ack.id },
        data: {
          acknowledgedBy: "[REDACTED]",
          proofPhotoUrl: null,
          proofPhotoName: null,
        },
      });
      redactedCount++;
    }

    // Redact from audit logs
    await prisma.auditLog.updateMany({
      where: {
        shopDomain: shop_domain,
        entityType: "ORDER_ACKNOWLEDGMENT",
        entityId: { in: acknowledgments.map(a => a.id) },
      },
      data: {
        userEmail: "[REDACTED]",
        userId: "[REDACTED]",
      },
    });
  }

  // Create audit log for the redaction
  await prisma.auditLog.create({
    data: {
      shopDomain: shop_domain,
      userId: "GDPR_SYSTEM",
      userEmail: "gdpr@system",
      action: "CUSTOMER_REDACT",
      entityType: "GDPR_REDACTION",
      entityId: customer.id.toString(),
      newValue: {
        customer_id: customer.id,
        orders_redacted: orders_to_redact?.length || 0,
        records_redacted: redactedCount,
      },
    },
  });

  return json({
    shop_id,
    shop_domain,
    customer,
    records_redacted: redactedCount,
  });
}