import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import polarisStyles from "@shopify/polaris/build/esm/styles.css";

// Load Polaris styles globally
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "preconnect", href: "https://cdn.shopify.com" },
];

// NOTE: Do NOT add authenticate.admin() here!
// Authentication should only happen in /app routes, not in root.
// The root must allow unauthenticated access for OAuth callback to work.

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Error boundary to show actual error details
export function ErrorBoundary() {
  const error = useRouteError();

  console.error("[ROOT ERROR BOUNDARY]", error);

  let errorMessage = "Unknown error";
  let errorDetails = "";

  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText}`;
    errorDetails = error.data?.toString() || "";
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = error.stack || "";
  }

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "40px" }}>
        <h1 style={{ color: "red" }}>Application Error</h1>
        <p><strong>Error:</strong> {errorMessage}</p>
        <pre style={{
          background: "#f5f5f5",
          padding: "20px",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}>
          {errorDetails}
        </pre>
        <p>Check Railway logs for more details.</p>
      </body>
    </html>
  );
}