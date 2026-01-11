# Troubleshooting Guide: Shopify App (LLM Reference)

**IMPORTANT: This document contains ALL major issues encountered while building this Shopify app with Railway deployment. Future LLM models should read this FIRST before debugging any issues.**

---

## ⚠️ STOP! READ THIS FIRST BEFORE DOING ANYTHING ⚠️

### Check for Duplicate/Similar Files BEFORE Troubleshooting!

**We wasted HOURS editing the wrong file because two similarly-named files existed:**
- `OrderFulfillmentBlock.tsx` ← We kept editing this one
- `OrderDetailsBlock.tsx` ← Shopify was actually using THIS one

**BEFORE you start debugging or making ANY changes:**

1. **Search for similar filenames:**
   ```bash
   # Find files with similar names
   find . -name "*Block*" -o -name "*Notes*" -o -name "*Order*"

   # Or use glob patterns
   ls -la extensions/*/src/*.tsx
   ```

2. **Check configuration files to see which file is ACTUALLY used:**
   ```bash
   # For Shopify extensions - check the module field!
   cat extensions/*/shopify.extension.toml | grep -A2 "module"

   # For Remix routes - check what's registered
   ls -la app/routes/
   ```

3. **If you find multiple similar files, ASK:**
   - Which one is actually being used?
   - Why do both exist?
   - Should one be deleted?

**Don't be a dumbass like us. Check for duplicates FIRST.**

---

## 🛑 STUPID SHIT CHECKLIST - ASK THESE FIRST 🛑

Before writing a SINGLE line of code or suggesting ANY fix, verify these basics:

### The Obvious Stuff We Forgot To Check:

| # | Question | How to Check |
|---|----------|--------------|
| 1 | **Is the dev server even running?** | Look for `npm run dev` in terminal. No server = nothing works. |
| 2 | **Did you SAVE the file?** | Ctrl+S. Unsaved changes = old code runs. |
| 3 | **Did you deploy to Shopify?** | `npx shopify app deploy --force` - Railway and Shopify are SEPARATE! |
| 4 | **Did you push to git?** | `git status` - Railway deploys from git, not your local files. |
| 5 | **Is Railway actually deploying?** | Check Railway dashboard - green = deployed, building = wait. |
| 6 | **Did you hard refresh the browser?** | Ctrl+Shift+R or incognito. Browser cache lies to you. |
| 7 | **Are you on the right store?** | Dev store vs production. Check the URL. |
| 8 | **Is the app installed on the store?** | Apps > Your App. Not installed = nothing shows. |
| 9 | **Are environment variables set?** | Railway dashboard > Variables. Missing vars = silent failures. |
| 10 | **Are you on the right git branch?** | `git branch` - editing code on wrong branch = wasted time. |
| 11 | **Is Railway watching the right branch?** | Railway settings > check which branch triggers deploys. |
| 12 | **Did the build actually succeed?** | Railway logs - build errors = old code still running. |
| 13 | **Are you checking the right logs?** | Browser console vs Railway logs vs terminal - errors hide in different places. |
| 14 | **Is the database migrated?** | `npx prisma migrate deploy` - schema changes need migration. |
| 15 | **Did you restart after .env changes?** | Environment variables need server restart to take effect. |

### Quick Sanity Checks:

```bash
# Is git up to date?
git status

# What branch am I on?
git branch

# Is the server running?
# (Look at your terminal - should see "Server running on port...")

# Did I push my changes?
git log origin/master..HEAD  # Shows unpushed commits

# What does Shopify think the extension is?
cat extensions/*/shopify.extension.toml | grep module
```

### The Golden Rule:

**If you're about to change code to "fix" something, first verify:**
1. The code you're changing is actually being executed
2. The server running that code has your latest changes
3. You're looking at the right environment/store/logs

**90% of "bugs" are actually deployment/environment issues, not code issues.**

---

## Table of Contents
1. [Critical Discovery: Extension File Mismatch](#1-critical-discovery-extension-file-mismatch)
2. [The {} Rendering Issue (ESM/CommonJS)](#2-the--rendering-issue-esmcommonjs)
3. [Shopify Extension Issues](#3-shopify-extension-issues)
4. [Extension Authentication & CORS](#4-extension-authentication--cors)
5. [Photo Upload and Display Issues](#5-photo-upload-and-display-issues)
6. [Photo Storage Journey](#6-photo-storage-journey)
7. [Route Naming Conflicts](#7-route-naming-conflicts)
8. [Railway Deployment Failures](#8-railway-deployment-failures)
9. [Railway Volume (Persistent Storage)](#9-railway-volume-persistent-storage)
10. [Database and Prisma Issues](#10-database-and-prisma-issues)
11. [Common Debugging Steps](#11-common-debugging-steps)
12. [Image Sizing in Admin Extensions - THE THUMBNAIL SOLUTION](#12-image-sizing-in-admin-extensions---the-thumbnail-solution)
13. [Text Coloring in Admin Extensions - USE BADGE FOR GREEN TEXT](#13-text-coloring-in-admin-extensions---use-badge-for-green-text)
14. [Navigation in Embedded Apps - BACK BUTTON ISSUES](#14-navigation-in-embedded-apps---back-button-issues)
15. [App Installation and Uninstallation - HIDDEN UNINSTALL BUTTON](#15-app-installation-and-uninstallation)
16. [Session-Based Hold Logic - THE TIMER AUTHORIZATION DISASTER](#16-session-based-hold-logic---the-timer-authorization-disaster)
17. [Multi-Note Acknowledgment - THE ONE vs ALL BUG](#17-multi-note-acknowledgment---the-one-vs-all-bug)
18. [Fulfilled Order Handling - THE ZOMBIE HOLD BUG](#18-fulfilled-order-handling---the-zombie-hold-bug)
19. [Delayed Webhook Handling - THE RACE CONDITION BUG](#19-delayed-webhook-handling---the-race-condition-bug)
20. [Acknowledgment Checkbox Persistence - THE DATA TRANSFORMATION BUG](#20-acknowledgment-checkbox-persistence---the-data-transformation-bug)
21. [Extension Deployment - THE NULL SESSION ID BUG](#21-extension-deployment---the-null-session-id-bug)

---

## 1. Critical Discovery: Extension File Mismatch

### THE MOST IMPORTANT LESSON LEARNED

**Problem**: Changes to Shopify UI extension code were not appearing in the store, no matter how many times we deployed.

**What Happened**: We spent significant time editing `OrderFulfillmentBlock.tsx`, adding banners, photo displays, and debug code. Nothing ever showed up on the order page.

**Root Cause**: The `shopify.extension.toml` file determines which source file Shopify actually uses. It was pointing to a DIFFERENT file than we were editing!

```toml
# File: extensions/order-fulfillment-ui/shopify.extension.toml

[[extensions.targeting]]
target = "admin.order-details.block.render"
module = "./src/OrderDetailsBlock.tsx"  # <-- THIS is what Shopify uses!
```

We were editing `OrderFulfillmentBlock.tsx`, but Shopify was using `OrderDetailsBlock.tsx`.

**Solution**:
1. ALWAYS check `shopify.extension.toml` FIRST to see which file is actually being used
2. Edit the file that matches the `module` path
3. The `module` field in `shopify.extension.toml` is the source of truth

**How to Verify**:
```bash
# Check which file the extension is actually using
cat extensions/order-fulfillment-ui/shopify.extension.toml
# Look for the "module" field under [[extensions.targeting]]
```

---

## 2. The {} Rendering Issue (ESM/CommonJS)

### THE SECOND MOST FRUSTRATING ISSUE

**Problem**: After deploying to Railway, the app showed just `{}` instead of the actual React UI. No errors, just empty braces.

**What Happened**: The app built successfully, Railway showed green status, but visiting the app showed only `{}`.

**Root Causes Found** (Multiple issues combined):

#### 2.1 Static File Path Mismatch

The server was looking for client files in the wrong location:

```javascript
// WRONG - This is where Vite outputs files
app.use(express.static('build/client'));

// CORRECT - This is where Remix 2.7.1 with esbuild outputs files
app.use(express.static('public/build'));
```

**Why It Happened**: Different build tools output to different directories:
- Vite → `build/client`
- Remix with esbuild → `public/build`

#### 2.2 ESM vs CommonJS Module Conflicts

**Error**: `require() of ES Module not supported` or `Cannot use import statement outside a module`

**The Problem**: Mixing ES Modules (`import/export`) with CommonJS (`require/module.exports`) causes crashes.

**Solution**: Pick ONE format and stick with it. For Railway + Remix 2.7.1, CommonJS works best:

```javascript
// package.json - DO NOT add "type": "module"
{
  "name": "shopify-app",
  // NO "type": "module" here!
}

// server.js - Use CommonJS
const express = require('express');
const { createRequestHandler } = require('@remix-run/express');

// remix.config.js - Force CommonJS output
module.exports = {
  serverModuleFormat: "cjs",
  // ...
};
```

#### 2.3 Vite vs Remix Config Conflict

**Problem**: Having both `vite.config.ts` AND `remix.config.js` causes conflicts.

**Solution**: Use ONLY `remix.config.js` for Remix 2.7.1 with esbuild:

```bash
# Delete vite.config.ts if using remix.config.js
rm vite.config.ts
```

```javascript
// remix.config.js
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  serverModuleFormat: "cjs",
  future: {
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};
```

#### 2.4 Railway Cache Issues

**Problem**: Railway caches old builds, so even after fixing code, the old broken build deploys.

**Solution**: Force a clean rebuild:

```bash
# Create/update a cache bust file
echo $(date +%s) > .railway-cache-bust
git add .railway-cache-bust
git commit -m "Force Railway rebuild"
git push
```

Or in `nixpacks.toml`:
```toml
[phases.build]
cmds = [
  "rm -rf node_modules/.cache",
  "rm -rf build",
  "npm run build"
]
```

### Complete Working Configuration

**package.json** (no "type": "module"):
```json
{
  "scripts": {
    "build": "remix build",
    "start": "node server.js"
  }
}
```

**server.js** (CommonJS):
```javascript
const express = require('express');
const { createRequestHandler } = require('@remix-run/express');

const app = express();
app.use(express.static('public/build'));  // CORRECT PATH!
app.all('*', createRequestHandler({ build: require('./build') }));

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0');
```

**remix.config.js**:
```javascript
module.exports = {
  serverModuleFormat: "cjs",
};
```

---

## 3. Shopify Extension Issues

### 3.1 Extension Not Showing in Admin

**Symptoms**:
- Extension block doesn't appear on order details page
- No errors, just nothing shows

**Possible Causes**:
1. App not installed on the dev store
2. Extension not deployed (need `npx shopify app deploy --force`)
3. Wrong extension target (check `shopify.extension.toml`)
4. Server not running

**Solution Checklist**:
```bash
# 1. Make sure app is running
npm run dev

# 2. Deploy extension to Shopify
npx shopify app deploy --force

# 3. Check extension target matches where you expect it
# admin.order-details.block.render = shows on order details page
```

### 3.2 "App Preview Has Ended" Error - Extension Reverts to Old Version

**Symptoms**:
- Terminal shows: `❌ Error - The app preview has ended on the specified store`
- Extension suddenly stops showing your local changes
- Features that were working (like thumbnails) suddenly revert to old behavior

**What's Happening**:
When you run `npm run dev`, Shopify creates a temporary tunnel between your local code and your dev store. When this tunnel drops (timeout, network issue, etc.):
- Your dev store LOSES connection to your local extension code
- It falls back to the LAST DEPLOYED version of the extension
- Any local changes you made are no longer visible

**Why This Is Confusing**:
- You think your local code is running, but it's not
- The store is showing old deployed code
- You make changes locally but nothing happens

**Solution**:

1. **To restore local preview**: Restart `npm run dev`

2. **To make changes permanent**: Deploy your extension to Shopify
   ```bash
   npx shopify app deploy --force
   ```
   This uploads your extension code to Shopify's servers so it works even without the dev preview.

**Key Lesson**:
- `npm run dev` = temporary local preview (can drop at any time)
- `npx shopify app deploy` = permanent deployment to Shopify
- Always deploy after testing to make changes stick!

---

### 3.3 Extension Shows but Data Not Loading

**Symptoms**:
- Extension appears but shows "Loading..." forever
- Or shows "No notes found" when notes exist

**Possible Causes**:
1. Shop domain not being detected correctly
2. API endpoint not accessible (CORS issues)
3. GraphQL query failing silently

**Solution**:
The extension needs the shop domain to call the API. Use Direct API Access (the Shopify-approved method):

```typescript
// Correct way to get shop domain in UI extensions
const fetchShopDomain = async (): Promise<string> => {
  const response = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({
      query: `
        query GetShop {
          shop {
            myshopifyDomain
          }
        }
      `
    }),
  });
  const result = await response.json();
  return result?.data?.shop?.myshopifyDomain || '';
};
```

### 3.4 Extension Components Not Rendering

**Symptoms**:
- Some UI components don't appear
- Image component shows nothing

**Possible Causes**:
1. Component not imported
2. Wrong props passed
3. Data is null/undefined

**Solution**:
Always import ALL components you use:
```typescript
import {
  reactExtension,
  BlockStack,
  Button,
  Checkbox,
  Text,
  InlineStack,
  Badge,
  Banner,
  Box,
  Image,  // Don't forget Image!
  useApi,
} from '@shopify/ui-extensions-react/admin';
```

### 3.5 Deploying Extension Changes

**Important**: Railway deployment and Shopify extension deployment are SEPARATE!

- **Railway**: Deploys your backend server (git push or Railway CLI)
- **Shopify**: Deploys your UI extensions (`npx shopify app deploy --force`)

After changing extension code:
```bash
# Deploy to Shopify (this is separate from Railway!)
npx shopify app deploy --force

# Then refresh your browser (sometimes need incognito or hard refresh)
```

---

## 4. Extension Authentication & CORS

### THE EXTENSION AUTH NIGHTMARE

**Problem**: Extensions couldn't fetch data from our backend API. Various errors including CORS failures, authentication errors, and empty responses.

**The Journey**:

1. **First Attempt**: Use session tokens from Shopify
   - Extensions can get session tokens via `useApi()`
   - But our API couldn't validate them properly

2. **Second Attempt**: Pass shop as query parameter
   - Extensions get shop domain and pass it to API
   - Works but authentication was still failing

3. **Final Solution**: Create PUBLIC API endpoints (no auth)

### Why Public Endpoints Work

UI Extensions run in a sandboxed iframe. They can't share cookies or sessions with your main app. The cleanest solution is:

1. Create separate `/api/public/*` routes that don't require authentication
2. Use the shop domain as a "soft" identifier
3. Extensions call these public endpoints

**Example Public Endpoint**:

```typescript
// app/routes/api.public.orders.$orderId.notes.tsx
export async function action({ request, params }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  // No authentication check - public endpoint
  const notes = await prisma.productNote.findMany({
    where: { shopDomain: shop },
  });

  return json({ notes });
}
```

### CORS Configuration

Extensions need CORS headers to access your API:

```javascript
// server.js
app.use((req, res, next) => {
  // Allow Shopify admin extensions
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

### Getting Shop Domain in Extensions

Use Direct API Access (the Shopify-approved method):

```typescript
const fetchShopDomain = async (): Promise<string> => {
  const response = await fetch('shopify:admin/api/graphql.json', {
    method: 'POST',
    body: JSON.stringify({
      query: `query { shop { myshopifyDomain } }`
    }),
  });
  const result = await response.json();
  return result?.data?.shop?.myshopifyDomain || '';
};
```

---

## 5. Photo Upload and Display Issues

### 5.1 Photos Not Saving

**Symptoms**: Upload appears to work but photo not accessible later

**Possible Causes**:
1. Railway ephemeral filesystem (files deleted on redeploy)
2. Wrong upload directory
3. File permissions

**Solution**: Use Railway Volume for persistent storage

```javascript
// In storage.server.ts
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
```

Environment variable in Railway:
```
UPLOAD_DIR=/data/uploads
```

### 5.2 Photos Saving but Not Displaying in Extension

**Symptoms**:
- Railway logs show "File saved to..."
- API returns notes with photos
- But extension doesn't show the image

**Root Cause Found**: We were editing the WRONG FILE! (See Section 1)

**Additional Causes**:
1. Image component not imported
2. URL construction wrong (missing base URL)
3. No Box wrapper to control image size

**Solution**:
```typescript
// Make sure Image is imported
import { Image, Box } from '@shopify/ui-extensions-react/admin';

// Photo display with size control
{note.photos && note.photos.length > 0 && (
  <InlineStack blockAlignment="center" gap="tight">
    <Box maxInlineSize={100}>
      <Image
        source={note.photos[0].url}
        alt="Note photo"
      />
    </Box>
    {note.photos.length > 1 && (
      <Badge tone="info">+{note.photos.length - 1} more</Badge>
    )}
  </InlineStack>
)}
```

### 5.3 Photo URL Format

Photos can be stored in different ways. Check the URL format:

```typescript
// If URL starts with /, prepend the base URL
const imageUrl = photo.url.startsWith('/')
  ? `${BASE_URL}${photo.url}`
  : photo.url;
```

---

## 6. Photo Storage Journey

### THE PATH TO WORKING PHOTO STORAGE

We tried THREE different approaches before finding one that worked:

### 6.1 Attempt 1: Local Filesystem (FAILED)

**Approach**: Save uploaded photos to the local filesystem on Railway.

```javascript
const uploadDir = './uploads';
fs.writeFileSync(`${uploadDir}/${filename}`, buffer);
```

**Why It Failed**: Railway's filesystem is **ephemeral**. Every time you deploy, all files are deleted. Photos would work temporarily, then disappear after the next deployment.

### 6.2 Attempt 2: Shopify CDN (FAILED)

**Approach**: Use Shopify's Files API to store photos on their CDN.

```typescript
// Tried to use Shopify's stagedUploadsCreate mutation
const result = await admin.graphql(`
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
      }
    }
  }
`);
```

**Why It Failed**:
1. Needed `write_files` and `read_files` scopes in `shopify.app.toml`
2. Even after adding scopes, the Files API has strict requirements
3. Complex multi-step upload process (get staged URL, upload, then create file record)
4. Not designed for user-uploaded content in apps

### 6.3 Attempt 3: Railway Volume (SUCCESS!)

**Approach**: Use a Railway Volume - a persistent disk that survives deployments.

**Setup Steps**:

1. In Railway dashboard, click your service
2. Go to "Volumes" tab
3. Click "New Volume"
4. Set mount path: `/data`
5. Click "Create"
6. Add environment variable: `UPLOAD_DIR=/data/uploads`

**Working Code**:

```typescript
// storage.server.ts
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

export async function saveFile(file: File, shop: string, category: string) {
  const dir = `${UPLOAD_DIR}/${shop}/${category}`;
  await fs.promises.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${file.name}`;
  const filepath = `${dir}/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(filepath, buffer);

  return `/uploads/${shop}/${category}/${filename}`;
}
```

**Serving Files**:

```javascript
// server.js
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';
app.use('/uploads', express.static(UPLOAD_DIR));
```

### Key Lesson

For persistent file storage on Railway, you MUST use a Volume. The default filesystem is ephemeral!

---

## 7. Route Naming Conflicts

### THE MYSTERY OF THE MISSING ROUTE

**Problem**: Created a photo management page at `app/routes/app.notes.$noteId.photos.tsx` but it was never accessible. Requests would go to the wrong route handler.

**Root Cause**: Remix route naming conventions caused a conflict.

```
app.notes.tsx          → /app/notes
app.notes.$noteId.photos.tsx  → /app/notes/:noteId/photos
```

The `app.notes.tsx` route was catching all `/app/notes/*` requests before they could reach the photos route.

**Solution**: Rename the route to avoid the conflict:

```bash
# Before (conflicting)
app/routes/app.notes.$noteId.photos.tsx

# After (working)
app/routes/app.photo-manager.$noteId.tsx
```

The new route becomes `/app/photo-manager/:noteId` which doesn't conflict with anything.

### Remix Route Naming Rules to Remember

1. `app.notes.tsx` handles `/app/notes`
2. `app.notes._index.tsx` handles `/app/notes` (index)
3. `app.notes.$id.tsx` handles `/app/notes/:id`
4. Parent routes can "swallow" child routes if not careful

**When in Doubt**: Use completely different route prefixes to avoid conflicts.

---

## 8. Railway Deployment Failures

### 8.1 Missing or Incorrect Start Command

**Error**: `ERROR: No start command detected` or `Error: Cannot find module 'index.js'`

**Cause**: Railway can't determine how to start the application.

**Solution**:
- Add start script in `package.json`:
  ```json
  "scripts": {
    "start": "node server.js"
  }
  ```
- Or create a `Procfile`:
  ```
  web: node server.js
  ```

### 8.2 Port Binding Failure

**Error**: `Error: listen EADDRINUSE` or `EADDRNOTAVAIL` or `Application failed to respond on PORT`

**Cause**: App is using hardcoded port instead of Railway's dynamic PORT.

**Solution**:
```javascript
// In server.js
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

**Important**: Must bind to `0.0.0.0`, not `localhost`!

### 8.3 Build Command Execution Failure

**Error**: `npm ERR! missing script: build` or compilation errors

**Cause**: Build script doesn't exist or has errors.

**Solution**:
- Verify build script exists in `package.json`
- Check for TypeScript/syntax errors
- Run build locally first: `npm run build`

### 8.4 Missing Environment Variables

**Error**: `Error: DATABASE_URL is not defined`

**Cause**: Required environment variables not set in Railway.

**Solution**:
1. Go to Railway project settings
2. Add all required variables:
   - `DATABASE_URL`
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `UPLOAD_DIR=/data/uploads`
   - etc.

### 8.5 Dependency Installation Failure

**Error**: `npm ERR! 404 Not Found`

**Cause**: Package doesn't exist or wrong version.

**Solution**:
- Check package names and versions in `package.json`
- Delete `package-lock.json` and reinstall locally
- Push updated lock file

### 8.6 Memory Limit Exceeded

**Error**: `JavaScript heap out of memory` or `Process exited with code 137`

**Cause**: App using more memory than Railway plan allows.

**Solution**:
- Optimize memory usage
- Add to Railway environment:
  ```
  NODE_OPTIONS=--max-old-space-size=512
  ```
- Upgrade Railway plan if needed

### 8.7 Health Check Timeout

**Error**: `Health check failed: connection timeout`

**Cause**: App takes too long to start or isn't responding on correct port.

**Solution**:
- Ensure app responds quickly on startup
- Use correct PORT environment variable
- Defer heavy initialization until after server starts

### 8.8 Database Connection Refused

**Error**: `ECONNREFUSED` or `connect ETIMEDOUT`

**Cause**: Can't connect to database.

**Solution**:
- Verify `DATABASE_URL` is correct
- Check database service is running
- Ensure database allows connections from Railway

### 8.9 esbuild/Import Assertions Error

**Error**: `Unexpected "with"` or errors about import assertions

**Cause**: esbuild version too old for `with { type: "json" }` syntax.

**Solution**: Force newer esbuild in `package.json`:
```json
"overrides": {
  "esbuild": "0.24.0"
}
```

### 8.10 Native Dependency Compilation Failure

**Error**: `node-gyp: build error`

**Cause**: Native modules need compilation but tools aren't available.

**Solution**:
- Use pure-JS alternatives when possible
- Or use Docker with build tools pre-installed

---

## 9. Railway Volume (Persistent Storage)

### Why It's Needed

Railway's filesystem is **ephemeral** - files are deleted on every redeploy. For persistent file storage (like uploaded photos), you MUST use a Railway Volume.

### Setting Up Railway Volume

1. In Railway dashboard, click "New" → "Volume"
2. Set mount path: `/data`
3. Attach to your service
4. Set environment variable: `UPLOAD_DIR=/data/uploads`

### Verifying Volume Works

Check Railway logs for:
```
[Storage] Using upload directory: /data/uploads
[Storage] File saved to: /data/uploads/shop/photos/filename.jpg
```

### File URL Structure

```
Upload path: /data/uploads/{shop}/{category}/{filename}
Public URL: https://your-app.up.railway.app/uploads/{shop}/{category}/{filename}
```

---

## 10. Database and Prisma Issues

### 10.1 Prisma Migration Errors

**Error**: `Migration failed` or schema out of sync

**Solution**:
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (dev only)
npx prisma db push

# Or run migrations
npx prisma migrate deploy
```

### 10.2 Photos Not Included in Query Results

**Symptom**: API returns notes but `photos` array is empty

**Cause**: Prisma needs explicit `include` for relations

**Solution**:
```typescript
const notes = await prisma.productNote.findMany({
  where: { productId: { in: productIds } },
  include: {
    photos: true,  // Must explicitly include photos!
  },
});
```

---

## 11. Common Debugging Steps

### Before Making ANY Code Changes

1. **Is the app server running?**
   ```bash
   npm run dev
   ```

2. **Is Railway deployment successful?**
   - Check Railway dashboard for green status
   - Check deployment logs for errors

3. **Is the extension deployed to Shopify?**
   ```bash
   npx shopify app deploy --force
   ```

4. **Which file is the extension actually using?**
   ```bash
   cat extensions/order-fulfillment-ui/shopify.extension.toml
   # Look at the "module" field!
   ```

### Adding Debug Output

**In Extension** (visible in browser console):
```typescript
console.log('[Extension] Data:', JSON.stringify(data));
```

**In Server** (visible in Railway logs):
```typescript
console.log('[API] Request received:', req.url);
```

**Test Banner** (to confirm extension code is loading):
```typescript
<Banner tone="critical">
  <Text>VERSION TEST - If you see this, new code is loaded!</Text>
</Banner>
```

### Verifying API Responses

Test the API directly:
```bash
curl -X POST "https://your-app.up.railway.app/api/public/orders/ORDER_ID/notes?shop=your-shop.myshopify.com" \
  -H "Content-Type: application/json" \
  -d '{"productIds": ["gid://shopify/Product/123"]}'
```

### Checking Railway Logs

1. Go to Railway dashboard
2. Click on your service
3. Click "View Logs"
4. Look for:
   - `[Storage]` - file upload logs
   - `[PUBLIC API]` - API request logs
   - `Error:` - any errors

---

## Quick Reference: File Locations

| What | File Path |
|------|-----------|
| Extension config | `extensions/order-fulfillment-ui/shopify.extension.toml` |
| Extension UI (CHECK MODULE!) | `extensions/order-fulfillment-ui/src/OrderDetailsBlock.tsx` |
| API routes | `app/routes/api.*.tsx` |
| Storage utilities | `app/utils/storage.server.ts` |
| Database schema | `prisma/schema.prisma` |
| Server entry | `server.js` |
| Railway config | `railway.toml`, `nixpacks.toml` |

---

## 12. Image Sizing in Admin Extensions - THE THUMBNAIL SOLUTION

### THE IMAGE SIZE THAT WOULDN'T CHANGE

**Problem**: Tried to resize images in the Shopify admin extension using Box component with `maxInlineSize` and `maxBlockSize`. The image size NEVER changed no matter what values were used.

**What We Tried (ALL FAILED)**:
```typescript
// Attempt 1: Box wrapper with size constraints
<Box maxInlineSize={25} maxBlockSize={25}>
  <Image source={photo.url} alt="Photo" />
</Box>

// Attempt 2: Smaller values
<Box maxInlineSize={8} maxBlockSize={8}>
  <Image source={photo.url} alt="Photo" />
</Box>

// Attempt 3: Direct props on Image
<Image source={photo.url} width={50} fit="contain" aspectRatio={1} />
```

**Why It Failed**: Shopify intentionally restricts image sizing in admin UI extensions to maintain consistent design patterns. The Image component ignores size constraints.

**Source**: https://community.shopify.dev/t/can-you-adjust-the-image-size-within-the-app-block-of-admin-ui-extensions/19383

### THE SOLUTION: SERVER-SIDE THUMBNAILS

Since you can't resize images in the extension, you must **serve a pre-resized image** (thumbnail).

**Implementation Steps**:

1. **Install sharp** (image processing library):
   ```bash
   npm install sharp
   ```

2. **Add thumbnailUrl field to database**:
   ```prisma
   model ProductNotePhoto {
     id            String  @id @default(cuid())
     url           String
     thumbnailUrl  String?  // Add this field!
     filename      String
     // ...
   }
   ```

3. **Create thumbnails on upload** (storage.server.ts):
   ```typescript
   import sharp from "sharp";

   const THUMBNAIL_SIZE = 50;

   export async function uploadFile(file, shopDomain, category) {
     const buffer = Buffer.from(await file.arrayBuffer());

     // Save original
     await writeFile(fullPath, buffer);

     // Create thumbnail
     const thumbnailBuffer = await sharp(buffer)
       .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
         fit: "cover",
         position: "center",
       })
       .toBuffer();
     await writeFile(thumbnailPath, thumbnailBuffer);

     return { url, thumbnailUrl, filename };
   }
   ```

4. **Use thumbnailUrl in extension**:
   ```typescript
   <Image
     source={photo.thumbnailUrl || photo.url}
     alt="Note photo"
   />
   ```

### Key Points

1. **Box sizing doesn't work on Image** - Shopify prevents this intentionally
2. **You MUST resize server-side** - Create thumbnails when uploading
3. **sharp is fast and reliable** - Use it for image processing
4. **Fallback to original** - Use `thumbnailUrl || url` in case thumbnail is missing
5. **Old photos won't have thumbnails** - Only new uploads get them

### The Full Flow

```
User uploads photo
    ↓
Server receives file
    ↓
sharp creates 50x50 thumbnail
    ↓
Both original and thumbnail saved to Railway Volume
    ↓
Both URLs saved to database
    ↓
Extension displays thumbnailUrl (small)
    ↓
Click opens url (full size) in new tab
```

---

## 13. Text Coloring in Admin Extensions - USE BADGE FOR GREEN TEXT

### THE TEXT COLOR THAT WOULDN'T CHANGE

**Problem**: Wanted to make the word "Acknowledged" appear in green after user checks a checkbox. Tried using `Text` component with `tone="success"` but it didn't work.

**What We Tried (FAILED)**:
```typescript
// Attempt 1: Text with tone prop
<Text tone="success">Acknowledged</Text>
<Text emphasis="subdued">at {timestamp}</Text>

// Result: No green color, AND the words ran together as "acknowledgedat"
```

**Why It Failed**:
1. The `Text` component in Shopify admin UI extensions does NOT support the `tone` prop for coloring
2. Using `InlineStack` with `gap="extraTight"` didn't add enough space between elements
3. Text components don't have built-in color options like "success" green

### THE SOLUTION: USE BADGE COMPONENT

The `Badge` component DOES support `tone="success"` and displays as green. Use Badge for colored status text.

**Working Code**:
```typescript
{isAcknowledged && ack.acknowledgedAt && (
  <InlineStack gap="tight">
    <Badge tone="success">Acknowledged</Badge>
    <Text emphasis="subdued">at {new Date(ack.acknowledgedAt).toLocaleString()}</Text>
  </InlineStack>
)}
```

**Why Badge Works**:
1. Badge supports `tone` prop with values like "success" (green), "critical" (red), "warning" (yellow), "info" (blue)
2. Badge has proper padding/margins so text doesn't run together
3. Badge is designed for status indicators - exactly what we needed

### Key Lessons

| Component | Supports Color? | Use For |
|-----------|----------------|---------|
| `Text` | NO (only `emphasis="subdued"` for gray) | Regular text content |
| `Badge` | YES (`tone="success/critical/warning/info"`) | Status indicators, labels |
| `Banner` | YES (`tone="success/critical/warning/info"`) | Larger notifications, alerts |

### When to Use What

- **Need green/red/yellow text?** → Use `Badge` with `tone` prop
- **Need a colored alert box?** → Use `Banner` with `tone` prop
- **Need plain text?** → Use `Text` (only gray subdued option available)

**Remember**: If you need colored text in a Shopify admin extension, reach for `Badge` or `Banner`, NOT `Text`!

---

## 14. Navigation in Embedded Apps - BACK BUTTON ISSUES

### THE BACK BUTTON THAT WOULDN'T WORK

**Problem**: Tried to add a back button to the photo manager page that would return to the product listing. Multiple approaches failed because the app runs inside Shopify's iframe.

**What We Tried (ALL FAILED)**:

```typescript
// Attempt 1: Direct URL to product page
backAction={{ content: "Back", url: `https://${shop}/admin/products/${productId}` }}
// Result: "Firefox can't open this page" - embedded apps can't navigate to external URLs

// Attempt 2: Browser history.back()
const handleBack = () => { window.history.back(); };
backAction={{ content: "Back", onAction: handleBack }}
// Result: Button was inactive - iframe blocks window.history

// Attempt 3: App Bridge navigate(-1)
import { useNavigate } from "@shopify/app-bridge-react";
const navigate = useNavigate();
const handleBack = () => { navigate(-1); };
// Result: Didn't test - user realized simpler solution
```

**Why These Failed**:
1. **Direct URLs**: Embedded apps run in an iframe and can't navigate the parent window to external URLs
2. **window.history.back()**: The iframe has its own history stack that may not work as expected
3. **Complex navigation**: Often overkill for the actual use case

### THE SOLUTION: CONSIDER THE USER FLOW

**Key Realization**: The photo manager opens in a NEW TAB (via `target="_blank"` on the "Edit Image" link). Users don't need a back button - they just close the tab!

**Final Solution**:
```typescript
// Just remove the backAction entirely
<Page
  title="Manage Note Photos"
  subtitle={`Note: "${note.content.substring(0, 50)}..."`}
>
  {/* No backAction needed - page opens in new tab */}
</Page>
```

### Key Lessons

| Scenario | Solution |
|----------|----------|
| Page opens in new tab | Don't add back button - let user close tab |
| Page opens in same context | Use Remix's `useNavigate` or `<Link>` for in-app navigation |
| Need to navigate to Shopify admin page | Use App Bridge's `Redirect` action |
| Need to go to previous page in embedded app | Use App Bridge's `useNavigate(-1)` |

### When to Use What

1. **New tab pages**: No navigation needed - user closes tab
2. **In-app navigation**: Use Remix's routing (`<Link to="/app/somewhere">`)
3. **External Shopify pages**: Use App Bridge Redirect:
   ```typescript
   import { useAppBridge } from "@shopify/app-bridge-react";
   import { Redirect } from "@shopify/app-bridge/actions";

   const app = useAppBridge();
   const redirect = Redirect.create(app);
   redirect.dispatch(Redirect.Action.ADMIN_PATH, '/products/123');
   ```

### The Lesson

**Before adding navigation controls, ask**: How did the user get here?
- If via new tab → they'll close it when done
- If via in-app link → use Remix routing
- If you need Shopify admin pages → use App Bridge

**Don't overcomplicate navigation!**

---

## 15. App Installation and Uninstallation

### FINDING THE UNINSTALL BUTTON (IT'S HIDDEN!)

**Problem**: Needed to uninstall the app to re-register new webhooks, but couldn't find the uninstall button anywhere in the Shopify admin.

**Why We Needed To Uninstall**: When you add new webhooks to `shopify.server.ts`, they only get registered with Shopify during the OAuth/install flow. To register new webhooks, you MUST uninstall and reinstall the app.

**Where We Looked (Couldn't Find It)**:
- App detail page - no uninstall button visible
- Settings page - nothing obvious
- Various menus - nothing clear

### THE SOLUTION: DIRECT URL OR THREE DOTS MENU

**Method 1: Direct URL (FASTEST)**

Go directly to this URL in your browser:
```
https://admin.shopify.com/store/YOUR-STORE-NAME/settings/apps
```

For example:
```
https://admin.shopify.com/store/test-app-projects/settings/apps
```

**Method 2: Through Shopify Admin**

1. Go to **Settings** (gear icon, bottom left corner)
2. Click **Apps and sales channels**
3. Find your app in the list
4. Click the **three dots (⋮)** icon next to the app name - THIS IS THE KEY!
5. Click **Uninstall** from the dropdown
6. Click the red **Uninstall** button to confirm

**The Hidden UI Element**: The uninstall option is behind the three-dot "Action" menu (⋮), NOT on the app detail page itself!

### After Uninstalling - How to Reinstall

1. Go to https://partners.shopify.com
2. Click on your app
3. Click "Select store" or "Test on development store"
4. Choose your development store
5. Click **Install**
6. Accept the permissions

### When You Need to Reinstall

You MUST uninstall and reinstall the app when:
- Adding new webhook subscriptions
- Adding new OAuth scopes
- Changing app permissions in `shopify.app.toml`

The app's webhooks and scopes are registered during OAuth. Changes only take effect after reinstall!

### Key Lessons

1. **Uninstall is hidden behind three dots (⋮)** - not on the app page itself
2. **Use direct URL** - `https://admin.shopify.com/store/YOUR-STORE/settings/apps`
3. **New webhooks require reinstall** - webhook registration happens during OAuth
4. **New scopes require reinstall** - permission grants happen during OAuth

---

## Summary: The Most Common Mistakes

1. **Editing the wrong extension file** - Always check `shopify.extension.toml` first!
2. **The {} rendering issue** - Static file path, ESM/CommonJS conflicts, Vite vs Remix config
3. **Forgetting to deploy to Shopify** - Railway and Shopify deployments are separate!
4. **Extension auth failures** - Use public API endpoints with shop query param
5. **Using ephemeral storage** - Use Railway Volume for persistent files!
6. **Route naming conflicts** - Remix routes can shadow each other unexpectedly
7. **Not including relations in Prisma** - Use `include: { photos: true }`!
8. **Hardcoding ports** - Use `process.env.PORT` and bind to `0.0.0.0`!
9. **Railway cache issues** - Use `.railway-cache-bust` file to force clean rebuilds
10. **Not checking logs** - Railway logs show exactly what's happening!
11. **Trying to resize images in admin extensions** - Use server-side thumbnails instead!
12. **Using Text for colored text** - Text doesn't support colors! Use Badge with `tone` prop instead!
13. **Adding back buttons to new-tab pages** - If page opens in new tab, don't add navigation - let user close tab!
14. **Can't find uninstall button** - It's hidden behind three dots (⋮)! Use direct URL: `https://admin.shopify.com/store/YOUR-STORE/settings/apps`
15. **Using timer-based authorization** - Time is not a proxy for user presence! Use session tokens (UUID) to track if user is still on the page.
16. **Unique constraint on wrong field** - If multiple notes per product, constraint must be per-note not per-product!
17. **Not checking fulfillment status** - Always check if order is already fulfilled before modifying holds!
18. **Assuming webhooks are real-time** - Shopify webhooks can be delayed by minutes! Always check current state before acting.
19. **Raw DB records missing UI fields** - Transform data at API boundary to add fields UI expects (like `acknowledged: true`)
20. **Extension code not deployed** - Changed extension code? Must run `npx shopify app deploy --force` - git push only updates backend!

---

## Chronological Issue Timeline

Here's the order we encountered and solved issues:

1. **Initial Railway Deployment** - Port binding (EADDRNOTAVAIL), needed `0.0.0.0`
2. **esbuild Import Assertions** - Needed esbuild 0.24.0 override
3. **ESM/CommonJS Module Hell** - Removed `type: module`, used CommonJS
4. **The {} Rendering Issue** - Static path was wrong (`public/build` not `build/client`)
5. **Auth Route Crashes** - Simplified auth.$.tsx to just call `login()`
6. **Extension CORS Failures** - Added CORS headers to server.js
7. **Extension Auth Failures** - Created public API endpoints
8. **Photo Storage Failures** - Tried local → CDN → Railway Volume
9. **Route Conflicts** - Renamed `app.notes.$noteId.photos` → `app.photo-manager.$noteId`
10. **Extension File Mismatch** - Were editing wrong file! Check `shopify.extension.toml`
11. **Image Sizing in Admin Extensions** - Box/maxInlineSize doesn't work! Use server-side thumbnails with sharp
12. **Text Coloring in Admin Extensions** - Text `tone` prop doesn't work! Use Badge component instead
13. **Back Button in Embedded Apps** - Direct URLs, history.back(), all failed in iframe! Solution: page opens in new tab, so just remove back button
14. **Hidden Uninstall Button** - Can't find uninstall in Shopify admin! It's behind three dots (⋮) menu, or use direct URL
15. **Fulfillment Hold Feature** - Added webhook to re-apply holds when released without acknowledgment. Required reinstall to register new webhook.
16. **Timer Authorization Disaster** - Built a 60-second timer system, but user wanted session-based tracking. Timer approach fundamentally wrong - replaced with UUID session tokens.
17. **One-Note Releases Hold Bug** - Hold released after acknowledging 1 of 3 notes! Unique constraint was on productId, needed noteId. Changed to per-note tracking.
18. **Zombie Hold Bug** - Hold warning appeared on already-fulfilled orders. Added fulfilled status check before any hold operations.
19. **Delayed Webhook Race Condition** - ORDERS_CREATE webhook arrived 3 minutes late and re-applied hold after user acknowledged notes. Added acknowledgment check in webhook handler.
20. **Checkbox Persistence Bug** - Checkboxes showed unchecked after reload even though DB had records. Raw DB records don't have `acknowledged: true` field - added data transformation on load.
21. **Null SessionId Bug** - SessionId was null in logs. Extension code wasn't deployed! Must run `npx shopify app deploy --force` after changing extension code.

---

## 16. Session-Based Hold Logic - THE TIMER AUTHORIZATION DISASTER

### THE PROBLEM WITH TIMER-BASED AUTHORIZATION

**Original Broken Design**: We implemented a timer-based authorization system where:
1. User acknowledges notes → creates an "authorization token" with 60-second expiry
2. After 60 seconds, the authorization expires
3. Hold gets re-applied automatically

**Why the User Hated It**: The user explicitly said: "you can't put a timer that just puts the hold back on because the user took too long. the hold needs to come back ONLY if the user clicks off the page, reloads the page, or closes the window/tab"

The timer approach was fundamentally wrong because:
- User could be reading notes for 5 minutes (legitimate behavior)
- User could step away briefly
- Any delay beyond 60 seconds = hold comes back = frustrated user
- **The business logic should be about PAGE SESSION, not time elapsed**

### WHAT WE TRIED (MULTIPLE FAILED ATTEMPTS)

**Attempt 1: Timer-Based Authorization Tokens**
```typescript
// WRONG APPROACH
const authorization = await prisma.fulfillmentAuthorization.create({
  data: {
    orderId,
    expiresAt: new Date(Date.now() + 60 * 1000), // 60 second expiry
  },
});
```

**Why It Failed**: Time-based expiry is the wrong model entirely. User activity != time elapsed.

**Attempt 2: Extending Timer on Each Action**
```typescript
// STILL WRONG
// Tried to reset the 60-second timer on each acknowledgment
await prisma.fulfillmentAuthorization.update({
  where: { orderId },
  data: { expiresAt: new Date(Date.now() + 60 * 1000) },
});
```

**Why It Failed**: Still fundamentally broken. User could acknowledge all notes, then wait 61 seconds, and hold comes back.

### THE SOLUTION: SESSION-BASED TRACKING

The correct approach is to track the BROWSER SESSION, not time:

**How It Works**:
1. When extension loads, generate a unique `sessionId` (UUID)
2. This sessionId stays the same as long as the page is open
3. Store sessionId with each acknowledgment
4. When user returns to the page (new sessionId), clear old acknowledgments and re-apply hold

**Implementation**:

```typescript
// Extension: Generate sessionId on mount (stays stable for page lifetime)
const sessionId = useMemo(() => generateSessionId(), []);

function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Pass sessionId with every API call
formData.append('sessionId', sessionId);
```

**Server-Side Check**:
```typescript
// api.public.check-hold.tsx
const existingAcknowledgments = await prisma.orderAcknowledgment.findMany({
  where: { shopDomain: shop, orderId },
  select: { sessionId: true },
});

if (existingAcknowledgments.length > 0) {
  // Check if any acknowledgment has the same sessionId
  const sameSession = existingAcknowledgments.some(ack => ack.sessionId === sessionId);

  if (sameSession) {
    // Same session = user is still on the page, don't re-apply hold
    return json({ holdApplied: false, reason: "same session" });
  }

  // Different session = user left and came back
  // Clear old acknowledgments so they must re-acknowledge
  await prisma.orderAcknowledgment.deleteMany({
    where: { shopDomain: shop, orderId },
  });
}

// Apply hold since it's a new session
await applyHoldsToOrder(admin, numericOrderId);
```

### KEY LESSONS

| Approach | Why It's Wrong/Right |
|----------|---------------------|
| Timer expiry (60 seconds) | WRONG - Time is not a proxy for user leaving the page |
| Session tokens (UUID) | RIGHT - Tracks actual browser session lifecycle |
| Resetting timer on activity | WRONG - Still expires when user is idle but on page |
| Checking sessionId match | RIGHT - Detects same vs different page session |

### THE MENTAL MODEL

Think of it like a physical clipboard in a warehouse:
- **Timer approach**: "You have 60 seconds to read this, then I take it away" (terrible UX)
- **Session approach**: "As long as you're holding the clipboard, it's yours. When you put it down and walk away, it goes back to the rack." (correct UX)

The sessionId IS the "holding the clipboard" - it exists as long as the page is open.

---

## 17. Multi-Note Acknowledgment - THE ONE vs ALL BUG

### THE PROBLEM

**Symptom**: User has 3 notes on an order. They acknowledge ONE note, and the hold is released! It should wait until ALL notes are acknowledged.

**What Happened in Testing**:
```
User: [Acknowledges note 1 of 3]
System: "Hold released! Order can now be fulfilled."
User: "WTF I still have 2 more notes!"
```

### WHY IT HAPPENED (DATABASE CONSTRAINT)

The original database schema had this unique constraint:
```prisma
model OrderAcknowledgment {
  orderId    String
  productId  String
  // ...
  @@unique([orderId, productId])  // <-- THE PROBLEM!
}
```

**The Logic Bug**:
- A product can have MULTIPLE notes attached to it
- The unique constraint was on `orderId` + `productId`
- So only ONE acknowledgment could exist per product, regardless of how many notes that product had
- When checking "are all notes acknowledged?", we were counting acknowledgments per product, not per note

**Example**:
- Product A has 3 notes (noteId: 1, 2, 3)
- User acknowledges note 1 → creates acknowledgment for Product A
- System checks: "Is there an acknowledgment for Product A? Yes!" → RELEASES HOLD
- But notes 2 and 3 were never acknowledged!

### THE SOLUTION: PER-NOTE TRACKING

Changed the schema to track acknowledgments PER NOTE, not per product:

```prisma
model OrderAcknowledgment {
  orderId    String
  productId  String
  noteId     String   // ADDED - each acknowledgment is for a specific note
  // ...
  @@unique([orderId, noteId])  // CHANGED - unique per note, not per product
}
```

**Updated Check Logic**:
```typescript
// fulfillment-hold.server.ts
export async function checkAllNotesAcknowledged(shop, orderId, productIds) {
  // Get ALL notes for these products
  const notes = await prisma.productNote.findMany({
    where: { shopDomain: shop, productId: { in: productIds } },
    select: { id: true },
  });

  // Get acknowledgments for this order
  const acknowledgments = await prisma.orderAcknowledgment.findMany({
    where: { shopDomain: shop, orderId },
    select: { noteId: true },
  });

  // Check that EVERY note has been acknowledged
  const acknowledgedNoteIds = new Set(acknowledgments.map(a => a.noteId));
  for (const note of notes) {
    if (!acknowledgedNoteIds.has(note.id)) {
      console.log("[FulfillmentHold] Note", note.id, "not acknowledged yet");
      return false;  // At least one note not acknowledged
    }
  }
  return true;  // All notes acknowledged
}
```

### KEY LESSONS

1. **Data model must match business logic**: If each note needs acknowledgment, the constraint must be per-note
2. **Think about multiplicity**: One product can have many notes - the schema must support this
3. **Test with multiple items**: Always test with 2+ notes to catch "one vs all" bugs

### THE FIX SEQUENCE

1. Add `noteId` field to `OrderAcknowledgment` model
2. Change unique constraint from `@@unique([orderId, productId])` to `@@unique([orderId, noteId])`
3. Run `npx prisma migrate dev` to create migration
4. Update acknowledgment creation to include `noteId`
5. Update check logic to verify each note individually
6. Run `npx prisma migrate deploy` on Railway

---

## 18. Fulfilled Order Handling - THE ZOMBIE HOLD BUG

### THE PROBLEM

**Symptom**: User acknowledges all notes, fulfills the order, clicks away, comes back to the order page - and sees "FULFILLMENT BLOCKED" warning again!

**What Happened**:
1. User acknowledges all notes → hold released
2. User fulfills order → order is now FULFILLED status
3. User clicks away from order page
4. User returns to order page (new sessionId)
5. check-hold endpoint sees "different session" → clears acknowledgments → tries to apply hold
6. User sees "Order On Hold" banner on an already-fulfilled order

**Why This Is Bad**: The order is already shipped! Why is it showing as blocked?

### ROOT CAUSE

The `check-hold` endpoint wasn't checking if the order was already fulfilled before attempting to re-apply holds:

```typescript
// OLD CODE (buggy)
if (existingAcknowledgments.length > 0 && !sameSession) {
  // Different session - clear acknowledgments and re-apply hold
  await prisma.orderAcknowledgment.deleteMany({ where: { orderId } });
  await applyHoldsToOrder(admin, orderId);  // <-- Tries to hold a fulfilled order!
}
```

### THE SOLUTION: CHECK FULFILLMENT STATUS FIRST

Before doing ANYTHING with holds, check if the order is already fulfilled:

```typescript
// api.public.check-hold.tsx
// CHECK IF ORDER IS ALREADY FULFILLED FIRST
const fulfillmentOrders = await getFulfillmentOrders(admin, numericOrderId);
const fulfillableStatuses = ["OPEN", "SCHEDULED", "ON_HOLD"];
const hasUnfulfilledItems = fulfillmentOrders.some(
  fo => fulfillableStatuses.includes(fo.status)
);

if (!hasUnfulfilledItems) {
  console.log("[CHECK-HOLD] Order is already fulfilled/closed - no action needed");
  console.log("[CHECK-HOLD] Fulfillment order statuses:",
    fulfillmentOrders.map(fo => fo.status));
  return json({ holdApplied: false, reason: "order already fulfilled" });
}

// Only AFTER confirming order is not fulfilled, proceed with session check...
```

### WHY THE ORDER MATTERS

The check sequence must be:
1. **Is blockFulfillment enabled?** → If no, skip everything
2. **Are there notes for this order?** → If no, skip everything
3. **Is the order already fulfilled?** → If yes, skip everything ← THIS WAS MISSING!
4. **Is this the same session?** → If yes, don't re-apply hold
5. **Different session** → Clear acknowledgments, re-apply hold

Adding the fulfilled check BEFORE the session check prevents zombie holds on completed orders.

### KEY LESSONS

1. **Check preconditions in order of importance**: Fulfilled status should be checked early
2. **Fulfilled orders should be immutable**: Don't modify holds on orders that are already shipped
3. **Log the status**: Logging fulfillment order statuses helped debug this quickly

---

## 19. Delayed Webhook Handling - THE RACE CONDITION BUG

### THE PROBLEM

**Symptom**: User acknowledges all notes, waits on the page for a few minutes, and suddenly the hold comes back! Even though they never left the page.

**The Confusing Log Sequence**:
```
[Order Extension] Check-hold result: { holdApplied: false, reason: "same session" }
// User waits 2-3 minutes...
[Webhook] ORDERS_CREATE for order gid://shopify/Order/6273953399097
[Webhook] Applying fulfillment hold...
[Webhook] Hold applied successfully!
// User's UI now shows "FULFILLMENT BLOCKED" again
```

### ROOT CAUSE: DELAYED WEBHOOKS

Shopify's ORDERS_CREATE webhook can be delayed by several minutes. Here's what happened:

**Timeline**:
1. T+0s: Order created in Shopify
2. T+0s: User opens order page, extension loads
3. T+5s: User acknowledges all 3 notes
4. T+10s: Hold released, user sees "Order can be fulfilled"
5. T+180s: **ORDERS_CREATE webhook finally arrives** (3 minutes late!)
6. T+180s: Webhook handler sees "new order" → applies hold
7. T+180s: User's UI suddenly shows "FULFILLMENT BLOCKED" again!

**Why Webhooks Are Delayed**: Shopify batches and delays webhooks for various reasons:
- High traffic on Shopify's side
- Retry logic if our server was briefly unavailable
- Shopify's internal queue processing

### THE SOLUTION: CHECK ACKNOWLEDGMENTS IN WEBHOOK

Before applying a hold in the ORDERS_CREATE webhook, check if notes are already acknowledged:

```typescript
// webhooks.tsx - ORDERS_CREATE handler
case "ORDERS_CREATE": {
  // ... get order details, product IDs, etc.

  // Check if notes are already acknowledged (handles delayed webhook scenario)
  const allAcknowledged = await checkAllNotesAcknowledged(shop, orderGid, productIds);
  if (allAcknowledged) {
    console.log("[Webhook] All notes already acknowledged - skipping hold (delayed webhook)");
    return;  // Don't apply hold - user already acknowledged everything!
  }

  // Only apply hold if notes aren't acknowledged
  await applyHoldsToOrder(admin, orderId);
}
```

### THE RACE CONDITION EXPLAINED

```
                   User opens page         User acknowledges notes
                         ↓                         ↓
Timeline: ─────────────────────────────────────────────────────────────→
                   ↑                                           ↑
            Order created                        Webhook arrives (delayed!)
                   │                                           │
                   └───────── 3 minute delay ──────────────────┘
```

Without the fix, the webhook "wins" and re-applies the hold even though the user already did everything right.

### KEY LESSONS

1. **Webhooks are NOT real-time**: They can be delayed by seconds or minutes
2. **Always check current state**: Don't assume webhook is "first" - user may have acted before it arrived
3. **Idempotent operations**: Code should handle receiving the same event multiple times
4. **Log the scenario**: Log "delayed webhook" cases to track how often this happens

---

## 20. Acknowledgment Checkbox Persistence - THE DATA TRANSFORMATION BUG

### THE PROBLEM

**Symptom**: User acknowledges all notes, fulfills order, leaves page, comes back. The acknowledgment checkboxes are now UNCHECKED even though the database has the acknowledgment records!

**What User Saw**:
- Checkboxes were empty (not checked)
- No "Acknowledged at..." timestamp shown
- But the "FULFILLMENT BLOCKED" banner was NOT showing (correct)
- Confusing mixed signals!

### ROOT CAUSE: MISSING DATA TRANSFORMATION

When loading acknowledgments from the API, the raw database records look like this:
```javascript
// Raw data from database
{
  noteId: "abc123",
  orderId: "gid://shopify/Order/123",
  acknowledgedAt: "2026-01-10T15:30:00Z"
}
```

But the UI expected this format:
```javascript
// What UI expected
{
  acknowledged: true,  // <-- This field doesn't exist in database!
  acknowledgedAt: "2026-01-10T15:30:00Z"
}
```

**The Bug**: We were passing raw database records directly to the UI. The UI checked `ack.acknowledged` which was `undefined`, so checkboxes showed as unchecked.

**The Correct Logic**: If an acknowledgment record EXISTS in the database, it means it's acknowledged. The existence of the record IS the "acknowledged: true".

### THE SOLUTION: TRANSFORM DATA WHEN LOADING

```typescript
// OrderDetailsBlock.tsx - when loading notes and acknowledgments
const acks: Record<string, any> = {};
(responseData.notes || []).forEach((note: any) => {
  const existingAck = (responseData.acknowledgments || []).find((ack: any) =>
    ack.noteId === note.id && ack.orderId === orderId
  );

  if (existingAck) {
    // Acknowledgment exists in database = it IS acknowledged
    // Transform to the format the UI expects
    acks[note.id] = {
      acknowledged: true,  // <-- ADD THIS FIELD
      acknowledgedAt: existingAck.acknowledgedAt,
    };
  } else {
    acks[note.id] = { acknowledged: false };
  }
});
setAcknowledgments(acks);
```

### WHY THE ORIGINAL CODE WORKED FOR NEW ACKNOWLEDGMENTS

When the user clicks a checkbox to acknowledge in the current session, we set the state directly:
```typescript
setAcknowledgments(prev => ({
  ...prev,
  [noteId]: {
    acknowledged: true,  // Set explicitly
    acknowledgedAt: new Date().toISOString(),
  },
}));
```

So new acknowledgments had the `acknowledged: true` field. But when LOADING from the database, we weren't adding it.

### KEY LESSONS

1. **Data shapes between DB and UI often differ**: Don't assume DB format matches UI expectations
2. **Transform data at the boundary**: When loading from API, transform to UI format immediately
3. **Existence can imply boolean**: A record existing in DB often means "true" for some boolean concept
4. **Test the reload scenario**: Always test: do action → reload page → verify state persists correctly

---

## 21. Extension Deployment - THE NULL SESSION ID BUG

### THE PROBLEM

**Symptom**: Railway logs showed `sessionId: null` even though the code clearly set it.

```
[CHECK-HOLD] Checking order: gid://shopify/Order/123 sessionId: null
```

### ROOT CAUSE: EXTENSION NOT DEPLOYED

The extension code (which generates the sessionId) was changed locally, but:
- **Railway** was deployed (backend code updated) ✓
- **Shopify extension** was NOT deployed (frontend code still old) ✗

The old extension code didn't have the sessionId logic, so it sent null.

### THE SOLUTION: DEPLOY TO SHOPIFY

```bash
npx shopify app deploy --force
```

### THE CRITICAL DISTINCTION

| What | Deployment Command | What It Updates |
|------|-------------------|-----------------|
| Backend (API routes, server code) | `git push` → Railway auto-deploys | Server-side code on Railway |
| Frontend (UI Extension) | `npx shopify app deploy --force` | Extension code on Shopify's servers |

**You MUST do BOTH when changing extension code!**

1. `git add . && git commit -m "message" && git push` → Updates Railway backend
2. `npx shopify app deploy --force` → Updates Shopify extension

### HOW TO TELL WHICH NEEDS UPDATING

| If you changed... | You need to deploy to... |
|-------------------|-------------------------|
| `app/routes/*.tsx` | Railway (git push) |
| `app/utils/*.ts` | Railway (git push) |
| `server.js` | Railway (git push) |
| `extensions/*/src/*.tsx` | **Shopify** (npx shopify app deploy) |
| `extensions/*/shopify.extension.toml` | **Shopify** (npx shopify app deploy) |

### KEY LESSONS

1. **Extension and backend are separate deploys**: Don't forget the extension!
2. **Check logs for "null" values**: Often means code isn't deployed
3. **Force deploy extensions**: `--force` ensures latest code is pushed
4. **Both deploys needed for full-stack changes**: Backend + extension changes need both commands

---

## Summary: Session 16 Issues (January 10, 2026)

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Timer-based authorization | Wrong mental model (time vs session) | Session tokens (UUID) instead of timers |
| One-note releases hold | Unique constraint on productId not noteId | Changed to per-note tracking |
| Hold on fulfilled orders | No fulfilled status check | Check fulfillment status before any action |
| Delayed webhook re-applies hold | ORDERS_CREATE webhook can be minutes late | Check acknowledgments before applying hold |
| Checkboxes not checked on reload | Missing data transformation | Transform DB records to add `acknowledged: true` |
| SessionId showing as null | Extension not deployed to Shopify | Run `npx shopify app deploy --force` |

---

*Last Updated: January 10, 2026*
*Based on 80+ commits of debugging sessions*
*This document should be the FIRST reference when debugging this Shopify app.*
