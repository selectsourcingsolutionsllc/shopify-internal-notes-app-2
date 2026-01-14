# Product Notes for Staff - Shopify App

A production-ready Shopify embedded admin app for product notes and order fulfillment tracking. This app allows store staff to add private notes and photos to products, and ensures these notes are acknowledged during the fulfillment process.

## Features

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
- **Billing Integration**: 7-day free trial with tiered subscription pricing

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Shopify Partner account

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/selectsourcingsolutionsllc/product-notes-for-staff.git
   cd product-notes-for-staff
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

## Shopify Partner Account Setup

### 1. Create a Shopify Partner Account
1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Sign up for a partner account
3. Verify your email and complete the setup

### 2. Create a New App
1. In your Partner Dashboard, click "Apps" → "Create App"
2. Choose "Custom app" or "Public app" depending on your needs
3. Fill in the app details:
   - **App name**: Product Notes for Staff
   - **App URL**: Your app URL (e.g., https://product-notes-for-staff.up.railway.app)
   - **Allowed redirection URLs**: Add your callback URLs

### 3. Configure App Settings
1. **App setup** tab:
   - Set your app URL
   - Configure webhooks endpoints
2. **App scopes**: Ensure required scopes are selected

### 4. Get API Credentials
1. Copy the API key and API secret key
2. Add them to your `.env` file

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SHOPIFY_API_KEY` | Your app's API key from Partner Dashboard | Yes |
| `SHOPIFY_API_SECRET` | Your app's API secret from Partner Dashboard | Yes |
| `SHOPIFY_APP_URL` | Your app's public URL | Yes |
| `SCOPES` | Comma-separated list of required scopes | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |

## Deployment

### Deploy to Railway (Recommended)

See `DEPLOY_TO_RAILWAY.md` for detailed instructions.

### Deploy to Render.com

1. **Create a Render account** at [render.com](https://render.com)
2. **Connect your GitHub repository**
3. **Create a new Web Service** using the included `render.yaml` configuration

### Docker Deployment

```bash
# Build the Docker image
docker build -t product-notes-for-staff .

# Run with environment variables
docker run -d -p 3000:3000 --env-file .env product-notes-for-staff
```

## Architecture

### Database Schema
- **Sessions**: Shopify OAuth sessions
- **ProductNote**: Product notes with content and metadata
- **ProductNotePhoto**: Photo attachments for notes
- **OrderAcknowledgment**: Acknowledgment records for orders
- **AuditLog**: Complete audit trail of all actions
- **AppSetting**: Per-shop configuration settings
- **BillingSubscription**: Subscription management

### UI Extensions
- **Product Details Block**: Shows on product detail pages
- **Order Fulfillment Block**: Shows during order fulfillment
- **Order Details Block**: Shows acknowledgment history

## Security & Compliance

### Data Security
- All data encrypted in transit (HTTPS)
- Database encryption at rest
- Session-based authentication via Shopify OAuth

### GDPR Compliance
- Complete audit logging
- Data export capabilities
- Data deletion on app uninstall
- Customer data request/redaction endpoints
- Privacy policy and DPA included

## Development

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
- `npm run deploy` - Deploy to Shopify

## Support

For technical support:
- Email: support@selectsourcingsolutions.com

For GDPR/Privacy questions:
- Email: privacy@selectsourcingsolutions.com

## License

This project is proprietary software owned by Select Sourcing Solutions LLC. All rights reserved.

---

Built with love by Select Sourcing Solutions LLC
