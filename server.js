const { createRequestHandler } = require("@remix-run/express");
const express = require("express");
const path = require("path");

const app = express();

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
