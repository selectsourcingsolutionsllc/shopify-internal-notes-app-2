const { createRequestHandler } = require("@remix-run/express");
const express = require("express");
const path = require("path");

const app = express();

// Allowed origins for CORS - only Shopify admin domains
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/,
  /^https:\/\/admin\.shopify\.com$/,
  /^https:\/\/[a-zA-Z0-9-]+\.shopify\.com$/,  // Any Shopify subdomain
  /^https:\/\/extensions\.shopifycdn\.com$/,  // Extensions CDN
  /^https:\/\/[a-zA-Z0-9-]+\.shopifycdn\.com$/,  // Any Shopify CDN
  /^https:\/\/[a-zA-Z0-9-]+\.spin\.dev$/,  // Shopify development
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

// Enable CORS for Shopify UI extensions - RESTRICTED to Shopify domains only
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Debug log to see incoming origins
  if (origin) {
    console.log(`[CORS] Origin: ${origin}, Allowed: ${isAllowedOrigin(origin)}`);
  }

  // Only allow Shopify domains
  if (origin && isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopify-Access-Token");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint (BEFORE static files and Remix handler)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug endpoint to test HTML rendering
app.get("/debug", (req, res) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><title>Debug Test</title></head>
      <body>
        <h1>Debug Page Works!</h1>
        <p>Express is serving HTML correctly.</p>
        <p>Time: ${new Date().toISOString()}</p>
      </body>
    </html>
  `);
});

// Serve static files from public/build (where Remix 2.7.1 puts client assets)
app.use("/build", express.static(path.join(__dirname, "public/build"), {
  maxAge: "1y",
  immutable: true,
}));

// Serve uploaded files from Railway Volume with CORS headers (restricted to Shopify)
const uploadDir = process.env.UPLOAD_DIR || "/data/uploads";
app.use("/uploads", (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(uploadDir, {
  maxAge: "1h",
}));
console.log("[Server] Serving uploads from:", uploadDir);

// Serve other public files
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1h",
}));

// Handle all routes with Remix
const remixHandler = createRequestHandler({
  build: require("./build/index.js")
});

// Wrap Remix handler with logging
app.all("*", async (req, res, next) => {
  console.log(`[REMIX] Incoming request: ${req.method} ${req.url}`);
  try {
    await remixHandler(req, res, next);
    console.log(`[REMIX] Response sent for: ${req.url}`);
  } catch (error) {
    console.error(`[REMIX] Error handling ${req.url}:`, error);
    next(error);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Express server listening on http://0.0.0.0:${port}`);
});
