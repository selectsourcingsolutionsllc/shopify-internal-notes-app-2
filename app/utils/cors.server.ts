// Allowed origins for CORS - only Shopify admin domains
const ALLOWED_ORIGINS = [
  /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
  /^https:\/\/admin\.shopify\.com$/,
  /^https:\/\/[a-zA-Z0-9-]+\.spin\.dev$/,  // Shopify development
];

// Check if origin is allowed
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(pattern => pattern.test(origin));
}

// Get the allowed origin to return (must match the request origin exactly)
function getAllowedOrigin(request: Request): string {
  const origin = request.headers.get("Origin");
  if (origin && isAllowedOrigin(origin)) {
    return origin;
  }
  // Default to admin.shopify.com if no valid origin
  return "https://admin.shopify.com";
}

export function addCorsHeaders(response: Response, request?: Request) {
  const origin = request ? getAllowedOrigin(request) : "https://admin.shopify.com";
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopify-Access-Token");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export function createCorsResponse(request?: Request) {
  const origin = request ? getAllowedOrigin(request) : "https://admin.shopify.com";
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}