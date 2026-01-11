# Production Readiness Checklist

This checklist contains issues found by CodeRabbit that should be fixed before going to production.

---

## Critical (Must Fix)

- [x] **JWT Token Verification** - FIXED: Added shop validation to verify the shop has installed the app (has active session) before allowing API access. Created `shop-validation.server.ts` utility.
  - Files: All `api.public.*.tsx` files now use `validateShopInstalled()`

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

- [ ] **Duplicate Variable Declaration** - `MONTHLY_PLAN` is declared twice, could cause errors.
  - File: `app/routes/app.billing.tsx`

- [ ] **SSR Window Error** - Using `window.location.search` causes errors during server-side rendering.
  - Files: `app/routes/app.billing.tsx`, `app/routes/app.settings.tsx`

- [ ] **Stack Traces Exposed** - Error details shown to users could reveal sensitive info to hackers.
  - File: `app/root.tsx`

- [ ] **Prisma Singleton Bug** - Creates two database connections instead of one in development.
  - File: `app/db.server.ts`

- [ ] **Missing Validation Before Update** - Notes could potentially be updated by wrong shop.
  - File: `app/routes/api.products.$productId.notes.tsx`

- [ ] **Undefined productId Bug** - Could cause database errors if productId is missing.
  - File: `app/routes/api.acknowledgments.tsx`

- [ ] **Undefined orders_to_redact Bug** - Could crash when processing GDPR redact requests.
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
