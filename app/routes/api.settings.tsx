import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  let settings = await prisma.appSetting.findUnique({
    where: { shopDomain: session.shop },
  });
  
  // Create default settings if they don't exist
  if (!settings) {
    settings = await prisma.appSetting.create({
      data: {
        shopDomain: session.shop,
        requireAcknowledgment: true,
        requirePhotoProof: false,
        blockFulfillment: true,
      },
    });
  }
  
  return json({ settings });
}
// CodeRabbit review trigger - safe to remove
