import prisma from "../db.server";

/**
 * Validate that a shop has installed the app (has an active session)
 * This prevents unauthorized access to the API from arbitrary shops
 */
export async function validateShopInstalled(shopDomain: string): Promise<boolean> {
  if (!shopDomain) return false;

  // Check if this shop has a session (meaning they installed the app)
  const session = await prisma.session.findFirst({
    where: {
      shop: shopDomain,
    },
  });

  return !!session;
}

/**
 * Validate shop and return error response if invalid
 * Returns null if valid, or a Response object if invalid
 */
export async function validateShopOrError(shopDomain: string | null): Promise<Response | null> {
  if (!shopDomain) {
    return new Response(JSON.stringify({ error: "Missing shop parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isValid = await validateShopInstalled(shopDomain);
  if (!isValid) {
    // Return 403 Forbidden - shop hasn't installed the app
    return new Response(JSON.stringify({ error: "Unauthorized shop" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null; // Valid shop
}
