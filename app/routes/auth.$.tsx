import { authenticate, login } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (url.pathname === "/auth/login") {
    return login(request);
  }

  await authenticate.admin(request);

  return null;
}