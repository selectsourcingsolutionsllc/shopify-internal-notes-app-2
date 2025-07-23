# Internal Notes App for Shopify

A production-ready Shopify embedded admin app for internal product notes and order fulfillment tracking. This app allows store staff to add private notes and photos to products, and ensures these notes are acknowledged during the fulfillment process.

## 🎯 Features

### Core Functionality
- **Product Notes**: Add, edit, and delete internal notes on product detail pages
- **Photo Attachments**: Upload photos to document product issues or information
- **Order Fulfillment Integration**: Display relevant notes during order fulfillment
- **Acknowledgment System**: Require staff to acknowledge notes before fulfilling orders
- **Audit Trail**: Complete logging of all actions for compliance and training
- **Export Capabilities**: Export audit logs as CSV for reporting

### Advanced Features
- **Photo Proof**: Optional requirement for photo evidence when acknowledging notes
- **Fulfillment Blocking**: Prevent order fulfillment until all notes are acknowledged
- **Multi-tenant**: Supports multiple Shopify stores
- **GDPR Compliant**: Full GDPR compliance with data export/deletion endpoints
- **Billing Integration**: 14-day free trial with $19.99/month subscription

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Shopify Partner account
- AWS S3 bucket (for production file storage)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/selectsourcingsolutionsllc/shopify-internal-notes-app.git
   cd shopify-internal-notes-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🏗️ Shopify Partner Account Setup

### 1. Create a Shopify Partner Account
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Sign up for a partner account
3. Verify your email and complete the setup

### 2. Create a New App
1. In your Partner Dashboard, click "Apps" → "Create App"
2. Choose "Custom app" or "Public app" depending on your needs
3. Fill in the app details:
   - **App name**: Internal Notes App
   - **App URL**: Your app URL (e.g., https://your-app.onrender.com)
   - **Allowed redirection URLs**: Add your callback URLs:
     - `https://your-app.onrender.com/auth/callback`
     - `https://your-app.onrender.com/auth/shopify/callback`
     - `http://localhost:3000/auth/callback` (for development)

### 3. Configure App Settings
1. **App setup** tab:
   - Set your app URL
   - Configure webhooks endpoints:
     - `https://your-app.onrender.com/webhooks` (for app uninstall)
2. **App scopes**: Ensure these scopes are selected:
   - `read_products`
   - `write_products` 
   - `read_orders`
   - `write_orders`

### 4. Get API Credentials
1. Copy the API key and API secret key
2. Add them to your `.env` file:
   ```env
   SHOPIFY_API_KEY=your_api_key_here
   SHOPIFY_API_SECRET=your_api_secret_here
   ```

## 🔧 Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Description | Required |
|----------|-------------|----------|
| `SHOPIFY_API_KEY` | Your app's API key from Partner Dashboard | Yes |
| `SHOPIFY_API_SECRET` | Your app's API secret from Partner Dashboard | Yes |
| `SHOPIFY_APP_URL` | Your app's public URL | Yes |
| `SCOPES` | Comma-separated list of required scopes | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SESSION_SECRET` | Random secret for session encryption | Yes |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 storage | Optional* |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 storage | Optional* |
| `AWS_REGION` | AWS region for S3 bucket | Optional* |
| `S3_BUCKET_NAME` | S3 bucket name for file storage | Optional* |

*AWS variables are optional for development (files stored locally) but required for production.

## 📦 Deployment

### Deploy to Render.com

1. **Create a Render account** at [render.com](https://render.com)

2. **Connect your GitHub repository**

3. **Create a new Web Service**
   - Connect your repository
   - Use the included `render.yaml` configuration
   - Render will automatically detect the configuration

4. **Set up environment variables** in Render dashboard:
   ```env
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_APP_URL=https://your-app-name.onrender.com
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   S3_BUCKET_NAME=your_bucket_name
   ```

5. **Deploy**
   - Render will automatically deploy when you push to your main branch
   - Database and migrations will run automatically

### Alternative: Docker Deployment

```bash
# Build the Docker image
docker build -t internal-notes-app .

# Run with environment variables
docker run -d -p 3000:3000 --env-file .env internal-notes-app
```

## 🏪 Shopify App Store Submission

### Pre-submission Checklist

- [ ] App tested in multiple development stores
- [ ] All required scopes properly configured
- [ ] Privacy policy, Terms of Service, and DPA pages accessible
- [ ] GDPR compliance endpoints working
- [ ] Billing integration tested (trial and subscription)
- [ ] App handles uninstall webhook properly
- [ ] UI extensions working in both product detail and order pages
- [ ] Audit logging functioning correctly
- [ ] Photo upload and storage working
- [ ] CSV export functionality tested

### Required Pages
The following pages are accessible at these URLs:
- Privacy Policy: `https://your-app-url.com/privacy-policy`
- Terms of Service: `https://your-app-url.com/terms-of-service`
- Data Processing Agreement: `https://your-app-url.com/data-processing-agreement`

### Submission Steps

1. **Complete Partner Dashboard setup**
   - Fill in all app details
   - Upload app screenshots and icon
   - Write compelling app description
   - Set pricing ($19.99/month with 14-day trial)

2. **Test thoroughly**
   - Install in multiple development stores
   - Test all features end-to-end
   - Verify billing flows work correctly

3. **Submit for review**
   - Navigate to "App submission" in Partner Dashboard
   - Complete all required fields
   - Submit for Shopify review

4. **Address review feedback**
   - Respond to any feedback from Shopify review team
   - Make requested changes
   - Resubmit if necessary

## 🏗️ Architecture

### Database Schema
- **Sessions**: Shopify OAuth sessions
- **ProductNote**: Product notes with content and metadata
- **ProductNotePhoto**: Photo attachments for notes
- **OrderAcknowledgment**: Acknowledgment records for orders
- **AuditLog**: Complete audit trail of all actions
- **AppSetting**: Per-shop configuration settings
- **BillingSubscription**: Subscription management

### API Endpoints
- `GET/POST /api/products/:id/notes` - Manage product notes
- `DELETE /api/products/:id/notes/:noteId` - Delete notes
- `POST /api/products/:id/notes/:noteId/photos` - Upload photos
- `POST /api/orders/:id/notes` - Get notes for order products
- `POST /api/acknowledgments` - Create acknowledgments
- `GET /api/settings` - Get app settings
- `GET /app/audit/export` - Export audit logs
- GDPR endpoints for compliance

### UI Extensions
- **Product Details Block**: Shows on product detail pages
- **Order Fulfillment Block**: Shows during order fulfillment
- **Order Details Block**: Shows acknowledgment history

## 🔒 Security & Compliance

### Data Security
- All data encrypted in transit (HTTPS)
- Database encryption at rest
- Secure file storage (S3 with proper IAM)
- Session-based authentication via Shopify OAuth

### GDPR Compliance
- Complete audit logging
- Data export capabilities
- Data deletion on app uninstall
- Customer data request/redaction endpoints
- Privacy policy and DPA included

### Shopify Requirements
- Proper webhook handling
- Secure session storage
- Required policy pages
- GDPR compliance endpoints
- Billing API integration

## 🛠️ Development

### Project Structure
```
├── app/                    # Remix application
│   ├── routes/            # Route handlers
│   ├── components/        # React components  
│   ├── utils/            # Utility functions
│   └── services/         # Business logic
├── extensions/           # Shopify UI Extensions
│   ├── product-notes-ui/ # Product detail extension
│   └── order-fulfillment-ui/ # Order fulfillment extension
├── prisma/              # Database schema and migrations
├── public/              # Static assets
└── build/               # Built application
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run prisma` - Prisma CLI commands
- `npm run lint` - Lint code
- `npm run deploy` - Deploy to Shopify

### Testing
```bash
# Run database migrations
npm run setup

# Start development server
npm run dev

# Access your app at http://localhost:3000
```

## 🐛 Troubleshooting

### Common Issues

**App won't install in development store**
- Check that your app URL is correct in Partner Dashboard
- Verify SHOPIFY_API_KEY and SHOPIFY_API_SECRET are correct
- Ensure your app is set to development mode

**Database connection errors**
- Verify DATABASE_URL is correct
- Check that PostgreSQL is running
- Run `npx prisma migrate dev` to apply migrations

**File upload not working**
- For development: Check that `public/uploads` directory exists
- For production: Verify AWS credentials and S3 bucket permissions

**Billing not working**
- Ensure billing integration is properly configured in Partner Dashboard
- Check that your app has proper billing scopes
- Verify subscription webhook endpoints are set up

### Getting Help

For technical support:
- Email: support@selectsourcingsolutions.com
- Response time: Within 24 hours during business days

For GDPR/Privacy questions:
- Email: privacy@selectsourcingsolutions.com

## 📄 License

This project is proprietary software owned by Select Sourcing Solutions LLC. All rights reserved.

## 🔄 Updates

This app automatically handles updates through the standard deployment process. Database migrations are run automatically on deployment.

### Version History
- v1.0.0 - Initial release with core functionality
- Billing integration and UI extensions
- GDPR compliance and audit logging
- Full Shopify App Store readiness

---

Built with ❤️ by Select Sourcing Solutions LLC