// Simple debug route - no authentication required
export async function loader() {
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head><title>Debug Test</title></head>
      <body>
        <h1>Debug Page Works!</h1>
        <p>If you see this, the server is rendering HTML correctly.</p>
        <p>Time: ${new Date().toISOString()}</p>
      </body>
    </html>`,
    {
      headers: { "Content-Type": "text/html" },
    }
  );
}
