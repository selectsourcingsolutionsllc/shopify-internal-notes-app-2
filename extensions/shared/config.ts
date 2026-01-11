/**
 * Shared configuration for Shopify UI Extensions
 *
 * The BASE_URL is set at build time from environment variables.
 * In development: uses SHOPIFY_APP_URL from .env
 * In production: Railway sets this automatically during deploy
 */

// Use environment variable at build time, fallback to production URL
export const BASE_URL =
  process.env.SHOPIFY_APP_URL ||
  "https://shopify-internal-notes-app-production.up.railway.app";
