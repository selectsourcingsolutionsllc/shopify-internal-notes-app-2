import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

// Audit log export is hidden from users - redirect to dashboard
export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/app");
}

// CodeRabbit review trigger - safe to remove
