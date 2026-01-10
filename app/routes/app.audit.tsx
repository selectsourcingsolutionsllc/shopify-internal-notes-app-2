import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

// Audit log is hidden from users - redirect to dashboard
export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/app");
}

export default function AuditLog() {
  return null;
}

// CodeRabbit review trigger - safe to remove
