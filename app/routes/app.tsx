import { Outlet, useLoaderData } from "@remix-run/react";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import enTranslations from "@shopify/polaris/locales/en.json";

// Routes that don't require subscription (billing pages must be accessible to subscribe!)
const BILLING_EXEMPT_PATHS = ["/app/billing", "/app/billing-status"];

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { billing, session } = await authenticate.admin(request);
    const url = new URL(request.url);

    // Check if this route is exempt from billing requirement
    const isExempt = BILLING_EXEMPT_PATHS.some(path => url.pathname.startsWith(path));

    // If not exempt, check for active subscription
    if (!isExempt) {
      const { hasActivePayment } = await billing.check({
        plans: ["Starter Plan", "Basic Plan", "Pro Plan", "Titan Plan"],
        isTest: process.env.IS_TEST_BILLING === "true",
      });

      // No subscription? Redirect to billing (MUST preserve query params for auth!)
      if (!hasActivePayment) {
        console.log("[BILLING GATE] No subscription for", session.shop, "- redirecting to billing");
        return redirect(`/app/billing${url.search}`);
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
