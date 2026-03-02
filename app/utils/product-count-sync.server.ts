// Product count sync utility
// Queries Shopify for the store's product count and caches it in BillingSubscription

import prisma from "../db.server";

/**
 * Sync the product count from Shopify to the BillingSubscription table.
 * Uses productsCount(limit: null) to get the full count (not capped at 10k).
 * Wrapped in try/catch so a GraphQL failure never crashes the page.
 */
export async function syncProductCount(admin: any, shopDomain: string): Promise<number | null> {
  try {
    const response = await admin.graphql(`
      query GetProductCount {
        productsCount(limit: null) {
          count
        }
      }
    `);

    const data = await response.json();
    const count = data.data?.productsCount?.count;

    if (typeof count !== "number") {
      console.error("[ProductCountSync] Unexpected response:", JSON.stringify(data));
      return null;
    }

    // Save to database (only if a subscription record exists for this shop)
    await prisma.billingSubscription.updateMany({
      where: { shopDomain },
      data: {
        productCount: count,
        productCountSyncedAt: new Date(),
      },
    });

    console.log(`[ProductCountSync] Synced product count for ${shopDomain}: ${count}`);
    return count;
  } catch (error) {
    console.error("[ProductCountSync] Failed to sync product count:", error);
    // Fail open — return null, don't crash the page
    return null;
  }
}

/**
 * Get the cached product count from the database (no Shopify API call).
 */
export async function getCachedProductCount(shopDomain: string): Promise<number | null> {
  try {
    const subscription = await prisma.billingSubscription.findUnique({
      where: { shopDomain },
      select: { productCount: true },
    });
    return subscription?.productCount ?? null;
  } catch {
    return null;
  }
}
