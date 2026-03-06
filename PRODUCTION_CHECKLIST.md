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

- [x] **Hardcoded Production URLs** - FIXED: Created shared config (`extensions/shared/config.ts`) that uses `SHOPIFY_APP_URL` environment variable with production fallback.
  - Files: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`, `extensions/product-notes-ui/src/ProductNotesBlock.tsx`

- [x] **N+1 Query Pattern** - FIXED: Changed to single batch query using GraphQL `nodes` field.
  - File: `app/routes/api.orders.$orderId.notes.tsx`

- [x] **Checkbox Always False** - FIXED: Added `pendingAcknowledgments` state to show immediate visual feedback when checkbox is clicked.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

- [x] **Unused trackUsage Function** - FIXED: Removed dead code file.
  - File: `app/utils/analytics.server.ts` (deleted)

- [x] **Missing orderId Validation** - FIXED: Added validation check before submitting acknowledgments and releasing holds.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

---

## Low Priority (Nice to Have)

- [x] **Privacy Policy Date** - FIXED: Changed from dynamic `new Date()` to static date "January 11, 2026".
  - Files: `app/routes/privacy-policy.tsx`, `app/routes/terms-of-service.tsx`

- [x] **Placeholder Address** - FIXED: Replaced with company name "Select Sourcing Solutions LLC". Updated governing law to "Delaware, USA".
  - Files: `app/routes/privacy-policy.tsx`, `app/routes/terms-of-service.tsx`

- [x] **Character Limit 211** - FIXED: Changed to 200 characters (standard number). Created `MAX_NOTE_LENGTH` constant for maintainability.
  - File: `extensions/product-notes-ui/src/ProductNotesBlock.tsx`

- [x] **Sensitive Data in Logs** - FIXED: Removed all `console.log` statements that could leak customer data. Kept only `console.error` for error debugging.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

- [x] **Native File Input** - DOCUMENTED: Added comment noting potential sandbox limitations. Photo proof feature is currently disabled so impact is minimal. Test before enabling.
  - File: `extensions/order-fulfillment-ui/src/OrderFulfillmentBlock.tsx`

---

## Production Deployment Checks (March 2026)

These issues were discovered when deploying to a real production store (clockspring-experts.myshopify.com).

- [x] **Billing page null safety** - FIXED: Added optional chaining (`?.`) on all `.toLocaleString()` calls. Without this, the billing page crashes for stores that don't have a billing subscription record yet (e.g., new installs).
  - Files: `app/routes/app.billing.tsx`, `app/routes/app._index.tsx`

- [x] **Billing page error handling** - FIXED: Added try/catch to `app.billing.tsx` loader with fallback error data and error banner in UI (matching the pattern already used in `app.billing-status.tsx`).
  - File: `app/routes/app.billing.tsx`

- [x] **"Choose a Plan" button routing** - FIXED: Dashboard button was pointing to `/app/billing` (internal route that could crash) instead of `MANAGED_PRICING_URL` (Shopify's managed pricing page). Changed to use `MANAGED_PRICING_URL` directly.
  - File: `app/routes/app._index.tsx`

- [x] **Setup Guide for block activation** - ADDED: Shopify admin blocks require manual "Add block" + pin by the merchant. Added a Setup Guide card with steps, thumbnail images, and embedded YouTube video so merchants know how to activate the app.
  - File: `app/routes/app._index.tsx`
  - Images: `public/images/setup-step2-add-block.jpg`, `public/images/setup-step3-pin-block.jpg`

- [ ] **Configure support email in Partner Dashboard** - The "Get Support" button in Shopify admin shows a message form but doesn't deliver messages unless a support email is configured in Partner Dashboard → App → App Setup → Support section.

- [ ] **Remove dead IS_TEST_BILLING env var** - The `IS_TEST_BILLING=true` environment variable on Railway is not used anywhere in the current codebase (removed during managed pricing migration). Can be safely deleted from Railway environment variables to avoid confusion.

---

## Notes

- This checklist was generated from CodeRabbit's automated code review on January 9, 2026
- Production deployment section added March 5, 2026
- Items are ordered by severity/impact
- Check off items as you fix them
- Critical items should be fixed before any production deployment with real customer data
