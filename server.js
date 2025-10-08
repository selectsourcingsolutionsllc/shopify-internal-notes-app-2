import { createRequestHandler } from "@remix-run/express";
import express from "express";

const app = express();

// Serve static files from the build/client directory
app.use(express.static("build/client"));

// Handle all routes with Remix
app.all("*", createRequestHandler({ build: await import("./build/index.js") }));

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Express server listening on http://0.0.0.0:${port}`);
});
