# Deploy Your Shopify App to Railway

## Prerequisites Completed ✓
- Removed ngrok files and configurations
- Updated shopify.app.toml with placeholder URLs
- Removed local .env file
- Updated vite.config.ts for production

## Step 1: Create Railway Account
1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub (recommended)

## Step 2: Deploy from GitHub
1. Click "Deploy from GitHub repo"
2. Select your `shopify-internal-notes-app` repository
3. Railway will detect it's a Node.js app automatically

## Step 3: Add PostgreSQL Database
1. In your project dashboard, click "+ New"
2. Select "Database" > "Add PostgreSQL"
3. Railway will automatically set the DATABASE_URL

## Step 4: Set Environment Variables
Click on your app service, go to "Variables" tab, and add:

```
SHOPIFY_API_KEY=759aead17dfbcb721121009dacc43ce2
SHOPIFY_API_SECRET=[Get from Partners Dashboard]
SCOPES=read_orders,read_products,write_orders,write_products
SHOPIFY_APP_URL=https://[your-app-name].up.railway.app
NODE_ENV=production
```

## Step 5: Get Your Railway URL
1. Go to Settings tab
2. Under "Domains", click "Generate Domain"
3. Copy your URL (like: https://your-app-name.up.railway.app)

## Step 6: Update Shopify Partners Dashboard
1. Go to https://partners.shopify.com
2. Select your app "Internal notes for listings"
3. Go to Configuration
4. Update ALL these URLs with your Railway URL:
   - App URL: `https://your-app-name.up.railway.app`
   - Allowed redirection URL(s): `https://your-app-name.up.railway.app/api/auth`
   - App proxy URL: `https://your-app-name.up.railway.app`

## Step 7: Update shopify.app.toml
Before pushing to GitHub, update these in shopify.app.toml:
- Replace `https://your-app.up.railway.app/` with your actual Railway URL

## Step 8: Push Changes
```bash
git add .
git commit -m "Configure for Railway deployment"
git push origin master
```

Railway will automatically deploy!

## Step 9: Install on Your Store
1. Once deployed, go to your Railway app URL
2. Install the app on your development store
3. The app should now work without any local server!

## Troubleshooting
- **Build failed?** Check "Deploy Logs" in Railway
- **App not loading?** Verify all URLs match in Partners Dashboard
- **Database errors?** Check if PostgreSQL is connected
- **Missing UI Extensions?** Run `shopify app deploy` locally first

## Important Notes
- Railway provides free $5 credits monthly
- Your app URL won't change unless you delete the project
- All logs are available in Railway dashboard
- No need for ngrok or local tunnels anymore!