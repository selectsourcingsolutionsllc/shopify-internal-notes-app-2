import { authenticate, login } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Only call login() for the login path
  // For all other /auth/* paths (like /auth/callback), let authenticate handle it
  if (url.pathname === "/auth/login") {
    return login(request);
  }

  // This handles /auth/callback and other auth routes
  // authenticate.admin() will handle redirects internally
  await authenticate.admin(request);

  return null;
}

// CodeRabbit review trigger - safe to remove
