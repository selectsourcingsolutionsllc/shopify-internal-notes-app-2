import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Unauthenticated billing callback route.
 *
 * After a merchant approves a plan on Shopify's managed pricing page,
 * Shopify redirects them to this URL OUTSIDE the admin iframe.
 * Since we're outside the iframe, authenticate.admin() would fail.
 *
 * Instead, this route reads the `shop` parameter and bounces the merchant
 * back into the Shopify admin where our embedded app loads properly.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const chargeId = url.searchParams.get("charge_id");

  console.log("[BILLING-CALLBACK] Received redirect from Shopify billing");
  console.log("[BILLING-CALLBACK] shop:", shop, "charge_id:", chargeId);

  if (!shop) {
    console.error("[BILLING-CALLBACK] No shop parameter found, redirecting to root");
    return redirect("/");
  }

  // Extract the store handle from the shop domain
  // e.g., "my-store.myshopify.com" → "my-store"
  const storeHandle = shop.replace(".myshopify.com", "");

  // Build the URL to redirect back into the Shopify admin embedded context
  // This takes the merchant back into the admin where our app loads inside the iframe
  const billingStatusPath = chargeId
    ? `/app/billing-status?charge_id=${chargeId}`
    : "/app/billing-status";

  const adminUrl = `https://admin.shopify.com/store/${storeHandle}/apps/product-notes-for-staff${billingStatusPath}`;

  console.log("[BILLING-CALLBACK] Redirecting to admin URL:", adminUrl);

  return redirect(adminUrl);
}
