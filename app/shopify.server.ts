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
  apiVersion: ApiVersion.October24,
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
      shopify.registerWebhooks({ session });
    },
  },
  billing: {
    [STARTER_PLAN]: {
      interval: BillingInterval.Every30Days,
      trialDays: 7,
      lineItems: [
        {
          amount: 9.99,
          currencyCode: "USD",
        },
      ],
    },
    [BASIC_PLAN]: {
      interval: BillingInterval.Every30Days,
      trialDays: 7,
      lineItems: [
        {
          amount: 14.99,
          currencyCode: "USD",
        },
      ],
    },
    [PRO_PLAN]: {
      interval: BillingInterval.Every30Days,
      trialDays: 7,
      lineItems: [
        {
          amount: 19.99,
          currencyCode: "USD",
        },
      ],
    },
    [TITAN_PLAN]: {
      interval: BillingInterval.Every30Days,
      trialDays: 7,
      lineItems: [
        {
          amount: 24.99,
          currencyCode: "USD",
        },
      ],
    },
    [ENTERPRISE_PLAN]: {
      interval: BillingInterval.Every30Days,
      trialDays: 7,
      lineItems: [
        {
          amount: 29.99,
          currencyCode: "USD",
        },
      ],
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;