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

### 3.2 Extension Shows but Data Not Loading

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

### 3.3 Extension Components Not Rendering

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

### 3.4 Deploying Extension Changes

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

---

*Last Updated: January 2025*
*Based on 50+ commits of debugging sessions*
*This document should be the FIRST reference when debugging this Shopify app.*
