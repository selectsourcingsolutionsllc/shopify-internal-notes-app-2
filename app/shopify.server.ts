import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
  BillingInterval,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Billing plan constants - must match keys in billing config below
export const STARTER_PLAN = "Starter Plan";
export const BASIC_PLAN = "Basic Plan";
export const PRO_PLAN = "Pro Plan";
export const TITAN_PLAN = "Titan Plan";
export const ENTERPRISE_PLAN = "Enterprise Plan";

// For backwards compatibility
export const MONTHLY_PLAN = PRO_PLAN;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  appUrl: process.env.SHOPIFY_APP_URL!,
  scopes: process.env.SCOPES!.split(","),
  apiVersion: ApiVersion.January25,
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  // Use offline tokens so webhooks can make API calls
  // Online tokens only work for embedded app requests, not background/webhook calls
  useOnlineTokens: false,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
    FULFILLMENT_ORDERS_HOLD_RELEASED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      // Register webhooks
      shopify.registerWebhooks({ session });

      // Create default app settings if they don't exist
      // This ensures settings are active immediately after install without needing to visit settings page
      try {
        await prisma.appSetting.upsert({
          where: { shopDomain: session.shop },
          update: {}, // Don't update if exists - preserve user's settings
          create: {
            shopDomain: session.shop,
            requireAcknowledgment: true,
            requirePhotoProof: false,
            blockFulfillment: true,
          },
        });
        console.log(`[AFTER_AUTH] Default settings created/verified for ${session.shop}`);
      } catch (error) {
        console.error(`[AFTER_AUTH] Error creating default settings for ${session.shop}:`, error);
      }
    },
  },
  billing: {
    [STARTER_PLAN]: {
      trialDays: 7,
      lineItems: [
        {
          amount: 9.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [BASIC_PLAN]: {
      trialDays: 7,
      lineItems: [
        {
          amount: 14.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [PRO_PLAN]: {
      trialDays: 7,
      lineItems: [
        {
          amount: 19.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [TITAN_PLAN]: {
      trialDays: 7,
      lineItems: [
        {
          amount: 24.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    [ENTERPRISE_PLAN]: {
      trialDays: 7,
      lineItems: [
        {
          amount: 29.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;