import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { shop_id, shop_domain } = await request.json();

  console.log(`Shop redaction request received for shop: ${shop_domain}`);

  try {
    // This is called 48 hours after app uninstall
    // Delete all data associated with the shop
    const results = await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { shopDomain: shop_domain } }),
      prisma.productNotePhoto.deleteMany({
        where: { note: { shopDomain: shop_domain } },
      }),
      prisma.productNote.deleteMany({ where: { shopDomain: shop_domain } }),
      prisma.orderAcknowledgment.deleteMany({ where: { shopDomain: shop_domain } }),
      prisma.appSetting.deleteMany({ where: { shopDomain: shop_domain } }),
      prisma.billingSubscription.deleteMany({ where: { shopDomain: shop_domain } }),
      prisma.session.deleteMany({ where: { shop: shop_domain } }),
    ]);

    const totalDeleted = results.reduce((sum, result) => sum + result.count, 0);

    console.log(`Shop redaction completed for ${shop_domain}. Total records deleted: ${totalDeleted}`);

    return json({
      shop_id,
      shop_domain,
      records_deleted: totalDeleted,
      status: "completed",
    });
  } catch (error) {
    console.error(`Shop redaction failed for ${shop_domain}:`, error);
    
    return json({
      shop_id,
      shop_domain,
      status: "failed",
      error: error.message,
    }, { status: 500 });
  }
}