import { Outlet } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return json({});
}

export default function App() {
  return (
    <AppProvider isEmbeddedApp apiKey={process.env.SHOPIFY_API_KEY!}>
      <Outlet />
    </AppProvider>
  );
}