import jwt from "jsonwebtoken";
import prisma from "../db.server";

// Interface for the decoded JWT payload from Shopify
interface ShopifySessionToken {
  iss: string;      // Issuer (shop admin URL)
  dest: string;     // Destination (shop URL)
  aud: string;      // Audience (app client ID)
  sub: string;      // Subject (user ID)
  exp: number;      // Expiration time
  nbf: number;      // Not before time
  iat: number;      // Issued at time
  jti: string;      // JWT ID (unique identifier)
  sid?: string;     // Session ID (optional)
}

// Result of session token verification
interface VerificationResult {
  valid: boolean;
  shop?: string;
  userId?: string;
  error?: string;
}

/**
 * Verify a Shopify session token from the Authorization header
 * This properly validates the JWT signature using the app's secret
 *
 * Per Shopify docs:
 * 1. Verify signature using HS256 algorithm + app's shared secret
 * 2. Check exp claim is in the future (not expired)
 * 3. Check nbf claim is in the past (token is active)
 * 4. Check aud matches our app's client ID
 * 5. THEN trust the claims
 *
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */
export async function verifySessionToken(request: Request): Promise<VerificationResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.substring(7);

  try {
    // Verify the JWT signature using the app's secret key
    // jwt.verify() automatically checks:
    // - Signature validity (using HS256 algorithm)
    // - exp claim (token not expired)
    // - nbf claim (token is active)
    const decoded = jwt.verify(token, process.env.SHOPIFY_API_SECRET!, {
      algorithms: ["HS256"],
    }) as ShopifySessionToken;

    // Verify audience matches our app's client ID
    if (decoded.aud !== process.env.SHOPIFY_API_KEY) {
      console.error("[JWT] Invalid audience:", decoded.aud, "expected:", process.env.SHOPIFY_API_KEY);
      return { valid: false, error: "Invalid token audience" };
    }

    // Extract shop domain from the dest claim
    const shopUrl = new URL(decoded.dest);
    const shop = shopUrl.hostname;

    // Now verify this shop has actually installed our app
    const hasSession = await validateShopInstalled(shop);
    if (!hasSession) {
      console.error("[JWT] Shop not installed:", shop);
      return { valid: false, error: "Shop has not installed this app" };
    }

    // Token is valid
    return {
      valid: true,
      shop,
      userId: decoded.sub,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: "Token expired" };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      console.error("[JWT] Verification failed:", error.message);
      return { valid: false, error: "Invalid token signature" };
    }
    console.error("[JWT] Unexpected error:", error);
    return { valid: false, error: "Token verification failed" };
  }
}

/**
 * Get shop from request - verifies JWT session token
 *
 * SECURITY: In production, ONLY accepts JWT-verified requests.
 * URL param fallback is only available in development for testing.
 *
 * @returns shop domain and whether it was verified via JWT
 */
export async function getVerifiedShop(request: Request): Promise<{
  shop: string | null;
  verified: boolean;
  error?: string;
}> {
  // First, try to verify via JWT (the secure way)
  const jwtResult = await verifySessionToken(request);
  if (jwtResult.valid && jwtResult.shop) {
    return { shop: jwtResult.shop, verified: true };
  }

  // DEV ONLY: Fall back to URL parameter for local testing
  // This is disabled in production to prevent security bypass
  if (process.env.NODE_ENV === "development") {
    const url = new URL(request.url);
    const shopParam = url.searchParams.get("shop");

    if (shopParam) {
      console.warn("[SECURITY] DEV-ONLY: Using URL shop param instead of JWT:", shopParam);

      // Still validate the shop has installed the app
      const isValid = await validateShopInstalled(shopParam);
      if (isValid) {
        return { shop: shopParam, verified: false };
      }
      return { shop: null, verified: false, error: "Shop not installed" };
    }
  }

  return { shop: null, verified: false, error: jwtResult.error || "No authentication provided" };
}

/**
 * Validate that a shop has installed the app (has an active session)
 * This prevents unauthorized access to the API from arbitrary shops
 */
export async function validateShopInstalled(shopDomain: string): Promise<boolean> {
  if (!shopDomain) return false;

  // Check if this shop has a session (meaning they installed the app)
  const session = await prisma.session.findFirst({
    where: {
      shop: shopDomain,
    },
  });

  return !!session;
}

/**
 * Validate shop and return error response if invalid
 * Returns null if valid, or a Response object if invalid
 */
export async function validateShopOrError(shopDomain: string | null): Promise<Response | null> {
  if (!shopDomain) {
    return new Response(JSON.stringify({ error: "Missing shop parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isValid = await validateShopInstalled(shopDomain);
  if (!isValid) {
    // Return 403 Forbidden - shop hasn't installed the app
    return new Response(JSON.stringify({ error: "Unauthorized shop" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null; // Valid shop
}
