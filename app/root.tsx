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

// Error boundary - hides stack traces in production for security
export function ErrorBoundary() {
  const error = useRouteError();
  const isProduction = process.env.NODE_ENV === "production";

  // Always log the full error server-side
  console.error("[ROOT ERROR BOUNDARY]", error);

  let errorMessage = "Unknown error";
  let errorDetails = "";
  let statusCode = 500;

  if (isRouteErrorResponse(error)) {
    statusCode = error.status;
    errorMessage = `${error.status} ${error.statusText}`;
    // Only show error data in development
    errorDetails = isProduction ? "" : (error.data?.toString() || "");
  } else if (error instanceof Error) {
    // In production, show generic message. In development, show actual error.
    errorMessage = isProduction ? "An unexpected error occurred" : error.message;
    // Never show stack traces in production
    errorDetails = isProduction ? "" : (error.stack || "");
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
        {!isProduction && errorDetails && (
          <pre style={{
            background: "#f5f5f5",
            padding: "20px",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
          }}>
            {errorDetails}
          </pre>
        )}
        {isProduction ? (
          <p>Please try again or contact support if the problem persists.</p>
        ) : (
          <p>Check Railway logs for more details.</p>
        )}
      </body>
    </html>
  );
}