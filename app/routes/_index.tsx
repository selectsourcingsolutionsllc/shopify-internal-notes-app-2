import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  console.log("[_INDEX.TSX] Loader starting, URL:", request.url);

  try {
    const { session } = await authenticate.admin(request);
    console.log("[_INDEX.TSX] Auth successful, shop:", session.shop);

    // Preserve query params when redirecting to /app
    const searchParams = url.searchParams.toString();
    const redirectUrl = searchParams ? `/app?${searchParams}` : "/app";
    console.log("[_INDEX.TSX] Redirecting to:", redirectUrl);

    return redirect(redirectUrl);
  } catch (error) {
    console.error("[_INDEX.TSX] Auth error:", error);
    throw error;
  }
}