import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  
  return null;
}