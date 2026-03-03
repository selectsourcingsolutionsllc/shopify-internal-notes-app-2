// Simple logger that suppresses verbose debug output in production.
// console.error is NOT gated — errors should always be visible.

const IS_DEV = process.env.NODE_ENV !== "production";

/** Logs only in non-production environments. Use for routine/verbose output. */
export function debug(...args: unknown[]): void {
  if (IS_DEV) console.log(...args);
}
