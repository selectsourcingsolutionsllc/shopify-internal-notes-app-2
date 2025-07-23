import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { shop_id, shop_domain, customer, orders_requested } = await request.json();

  // Log the data request for compliance
  console.log(`Customer data request received for shop: ${shop_domain}`);
  console.log(`Customer ID: ${customer.id}`);
  console.log(`Orders requested: ${orders_requested.length}`);

  // Since we don't store customer data directly (only staff data), 
  // we need to check if there's any data related to this customer's orders
  const customerData = {
    shop_id,
    shop_domain,
    customer,
    data_found: false,
    notes_data: [],
    acknowledgments_data: []
  };

  if (orders_requested && orders_requested.length > 0) {
    const orderIds = orders_requested.map((order: any) => order.id.toString());

    // Check for acknowledgments related to these orders
    const acknowledgments = await prisma.orderAcknowledgment.findMany({
      where: {
        orderId: { in: orderIds },
        shopDomain: shop_domain,
      },
    });

    if (acknowledgments.length > 0) {
      customerData.data_found = true;
      customerData.acknowledgments_data = acknowledgments.map(ack => ({
        order_id: ack.orderId,
        product_id: ack.productId,
        acknowledged_at: ack.acknowledgedAt,
        acknowledged_by: ack.acknowledgedBy,
        proof_photo_url: ack.proofPhotoUrl,
      }));
    }
  }

  // Create audit log for the data request
  await prisma.auditLog.create({
    data: {
      shopDomain: shop_domain,
      userId: "GDPR_SYSTEM",
      userEmail: "gdpr@system",
      action: "CUSTOMER_DATA_REQUEST",
      entityType: "GDPR_REQUEST",
      entityId: customer.id.toString(),
      newValue: {
        customer_id: customer.id,
        customer_email: customer.email,
        orders_requested: orders_requested.length,
        data_found: customerData.data_found,
      },
    },
  });

  return json(customerData);
}