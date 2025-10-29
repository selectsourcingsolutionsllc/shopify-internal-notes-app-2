const { createRequestHandler } = require("@remix-run/express");
const express = require("express");

const app = express();

// Serve static files from the build/client directory
app.use(express.static("build/client"));

// Handle all routes with Remix
app.all("*", createRequestHandler({
  build: require("./build/index.js")
}));

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Express server listening on http://0.0.0.0:${port}`);
});
