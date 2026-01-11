# Production Readiness Checklist

This checklist contains issues found by CodeRabbit that should be fixed before going to production.

---

## Critical (Must Fix)

- [x] **JWT Token Verification** - FIXED: Proper JWT signature verification using HS256 algorithm and app's secret key. Verifies signature, audience (aud), expiration (exp), and not-before (nbf) claims before trusting token. Uses `jsonwebtoken` library.
  - Files: `app/utils/shop-validation.server.ts` (new `verifySessionToken()` function), all `api.public.*.tsx` files now use `getVerifiedShop()`

- [x] **CORS Too Permissive** - FIXED: Changed from `"*"` to only allow Shopify admin domains (*.myshopify.com, admin.shopify.com, *.spin.dev).
  - Files: `app/utils/cors.server.ts`, `server.js`

- [x] **File Upload Validation** - FIXED: Added 10MB file size limit and image type validation (jpg, jpeg, png, gif, webp only).
  - File: `app/utils/storage.server.ts`

- [x] **Path Traversal Vulnerability** - FIXED: Added `sanitizePath()` function that validates paths stay within UPLOAD_DIR.
  - File: `app/utils/storage.server.ts`

- [x] **Test Route Accessible in Production** - FIXED: Added production check that returns 404 in production environment.
  - File: `app/routes/test.create-sample-data.tsx`

---

## High Priority (Should Fix)

- [x] **Duplicate Variable Declaration** - FIXED: Removed duplicate, now properly exported from `shopify.server.ts`.
  - File: `app/routes/app.billing.tsx`, `app/shopify.server.ts`

- [x] **SSR Window Error** - FIXED: Using `useSearchParams` hook from Remix instead of `window.location.search`.
  - Files: `app/routes/app.billing.tsx`, `app/routes/app.settings.tsx`

- [x] **Stack Traces Exposed** - FIXED: Stack traces only shown in development, hidden in production.
  - File: `app/root.tsx`

- [x] **Prisma Singleton Bug** - FIXED: Now reuses the same client instance in development.
  - File: `app/db.server.ts`

- [x] **Missing Validation Before Update** - FIXED: Added shop ownership check before updating notes.
  - File: `app/routes/api.products.$productId.notes.tsx`

- [x] **Undefined productId Bug** - FIXED: Added validation to return 400 error if productId is missing.
  - File: `app/routes/api.acknowledgments.tsx`

- [x] **Undefined orders_to_redact Bug** - FIXED: Added optional chaining to handle undefined/null.
  - File: `app/routes/api.gdpr.customer-redact.tsx`

---

## Medium Priority (Good to Fix)

- [ ] **Hardcoded Production URLs** - Makes development and testing harder.
  - Files: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`, `extensions/product-notes-ui/src/ProductNotesBlock.tsx`

- [ ] **N+1 Query Pattern** - Fetches product titles one at a time instead of in batch (slow for large orders).
  - File: `app/routes/api.orders.$orderId.notes.tsx`

- [ ] **Checkbox Always False** - The acknowledgment checkbox doesn't visually toggle.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

- [ ] **Unused trackUsage Function** - Dead code that should be removed or implemented.
  - File: `app/utils/analytics.server.ts`

- [ ] **Missing orderId Validation** - Could send "undefined" to the server.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

---

## Low Priority (Nice to Have)

- [ ] **Privacy Policy Date** - Shows today's date instead of when policy was actually updated.
  - File: `app/routes/privacy-policy.tsx`

- [ ] **Placeholder Address** - `[Your Business Address]` still in privacy policy.
  - File: `app/routes/privacy-policy.tsx`

- [ ] **Character Limit 211** - Unusual number, should document why or use standard like 200 or 255.
  - File: `extensions/product-notes-ui/src/ProductNotesBlock.tsx`

- [ ] **Sensitive Data in Logs** - Full payloads logged could leak customer info.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

- [ ] **Native File Input** - May not work in Shopify extension sandbox.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

---

## Notes

- This checklist was generated from CodeRabbit's automated code review on January 9, 2026
- Items are ordered by severity/impact
- Check off items as you fix them
- Critical items should be fixed before any production deployment with real customer data
