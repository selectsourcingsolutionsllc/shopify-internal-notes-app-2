import { Outlet, useLoaderData } from "@remix-run/react";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-remix/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import enTranslations from "@shopify/polaris/locales/en.json";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[APP.TSX] Loader starting, URL:", request.url);
  try {
    const { session } = await authenticate.admin(request);
    console.log("[APP.TSX] Auth successful, shop:", session.shop);
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
        <Outlet />
      </ShopifyAppProvider>
    </PolarisAppProvider>
  );
}