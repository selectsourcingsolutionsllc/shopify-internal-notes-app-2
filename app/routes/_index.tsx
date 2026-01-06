import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[_INDEX.TSX] Loader starting, URL:", request.url);
  try {
    const { session } = await authenticate.admin(request);
    console.log("[_INDEX.TSX] Auth successful, shop:", session.shop, "- redirecting to /app");
    return redirect("/app");
  } catch (error) {
    console.error("[_INDEX.TSX] Auth error:", error);
    throw error;
  }
}