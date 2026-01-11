import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { getVerifiedShop } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - get settings
// NOTE: CORS headers are handled by Express middleware in server.js

export async function loader({ request }: LoaderFunctionArgs) {
  // SECURITY: Verify the session token signature before trusting claims
  const { shop, verified, error } = await getVerifiedShop(request);

  console.log("[PUBLIC API] Settings - shop:", shop, "verified:", verified);

  if (!shop) {
    return json({ error: error || "Authentication required" }, { status: 403 });
  }

  try {
    let settings = await prisma.appSetting.findUnique({
      where: { shopDomain: shop },
    });

    // Return default settings if they don't exist
    if (!settings) {
      settings = {
        id: "",
        shopDomain: shop,
        requireAcknowledgment: true,
        requirePhotoProof: false,
        blockFulfillment: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return json({ settings });
  } catch (error) {
    console.error("[PUBLIC API] Error:", error);
    return json({ error: "Database error" }, { status: 500 });
  }
}
