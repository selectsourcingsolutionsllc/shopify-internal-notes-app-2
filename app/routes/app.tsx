import { Outlet, useLoaderData } from "@remix-run/react";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import enTranslations from "@shopify/polaris/locales/en.json";

// Routes that don't require an active subscription
const BILLING_EXEMPT_ROUTES = [
  "/app/billing",
  "/app/billing-status",
];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { billing, session } = await authenticate.admin(request);

    // Check if current route is exempt from billing check
    const url = new URL(request.url);
    const isExemptRoute = BILLING_EXEMPT_ROUTES.some(route =>
      url.pathname.startsWith(route)
    );

    // If not exempt, check for active subscription
    if (!isExemptRoute) {
      const isTestBilling = process.env.IS_TEST_BILLING === "true";

      // Check if merchant has any active subscription
      const { hasActivePayment } = await billing.check({
        plans: ["Starter Plan", "Basic Plan", "Pro Plan", "Titan Plan"],
        isTest: isTestBilling,
      });

      // If no active subscription, redirect to billing page
      if (!hasActivePayment) {
        console.log("[BILLING GATE] No active subscription for", session.shop, "- redirecting to billing");
        return redirect("/app/billing");
      }
    }

    return json({
      apiKey: process.env.SHOPIFY_API_KEY || "",
    });
  } catch (error) {
    console.error("[APP.TSX] Auth error:", error);
    throw error;
  }
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <PolarisAppProvider i18n={enTranslations}>
      <ShopifyAppProvider isEmbeddedApp apiKey={apiKey}>
        <ui-nav-menu>
          <a href="/app" rel="home">Home</a>
          <a href="/app/billing">Subscription</a>
          <a href="/app/settings">Settings</a>
        </ui-nav-menu>
        <Outlet />
      </ShopifyAppProvider>
    </PolarisAppProvider>
  );
}