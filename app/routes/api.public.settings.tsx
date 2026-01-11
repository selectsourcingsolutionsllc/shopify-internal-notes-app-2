import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { validateShopInstalled } from "../utils/shop-validation.server";

// Public endpoint for UI extensions - get settings
// NOTE: CORS headers are handled by Express middleware in server.js

// Helper to extract shop domain from session token
function getShopFromToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    if (payload.dest) {
      const url = new URL(payload.dest);
      return url.hostname;
    }
    return null;
  } catch (e) {
    console.error("[PUBLIC API] Error decoding token:", e);
    return null;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = getShopFromToken(request) || url.searchParams.get("shop");

  console.log("[PUBLIC API] Settings - shop:", shop);

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  // SECURITY: Validate that this shop has installed the app
  const isValidShop = await validateShopInstalled(shop);
  if (!isValidShop) {
    return json({ error: "Unauthorized" }, { status: 403 });
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
