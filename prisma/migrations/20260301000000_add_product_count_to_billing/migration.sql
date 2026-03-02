-- AlterTable
ALTER TABLE "BillingSubscription" ADD COLUMN "productCount" INTEGER,
ADD COLUMN "productCountSyncedAt" TIMESTAMP(3);
