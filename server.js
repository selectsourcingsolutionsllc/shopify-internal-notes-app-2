const { createRequestHandler } = require("@remix-run/express");
const express = require("express");
const path = require("path");

const app = express();

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
app.all("*", createRequestHandler({
  build: require("./build/index.js")
}));

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Express server listening on http://0.0.0.0:${port}`);
});
