# Railway Deployment Checklist

## After Deploying to Railway

### 1. Update SHOPIFY_APP_URL
Once Railway generates your app URL (e.g., `https://yourapp.up.railway.app`):

1. Go to Railway Dashboard → Your Project → Variables
2. Update `SHOPIFY_APP_URL` to your actual Railway domain
3. Redeploy the app

### 2. Update shopify.app.toml
Update the placeholder URL in `shopify.app.toml`:

```toml
application_url = "https://your-actual-railway-url.up.railway.app/"
```

Replace with your actual Railway domain.

### 3. Update Shopify Partner Dashboard
1. Go to your Shopify Partner Dashboard
2. Navigate to your app settings
3. Update the "App URL" to your Railway domain
4. Update "Allowed redirection URL(s)" to include:
   - `https://your-railway-url.up.railway.app/auth/callback`
   - `https://your-railway-url.up.railway.app/auth/shopify/callback`

### 4. Verify Environment Variables
Make sure these are set in Railway Dashboard:
- ✓ SHOPIFY_API_KEY
- ✓ SHOPIFY_API_SECRET
- ✓ SHOPIFY_APP_URL (updated to Railway domain)
- ✓ SCOPES
- ✓ DATABASE_URL (auto-provided by Railway when you add PostgreSQL)
- ✓ PORT (auto-provided by Railway)

### 5. Test Your Deployment
1. Visit your Railway URL
2. Test installing the app on a development store
3. Check Railway logs for any errors

## Common Issues

**App won't install?**
- Make sure SHOPIFY_APP_URL matches your Railway domain exactly
- Check that shopify.app.toml is updated
- Verify Shopify Partner Dashboard URLs are correct

**Database errors?**
- Ensure PostgreSQL service is added to your Railway project
- Check that DATABASE_URL is auto-populated in Railway variables

**Build failures?**
- Check Railway build logs
- Ensure all dependencies are in package.json
- Verify prisma schema is valid