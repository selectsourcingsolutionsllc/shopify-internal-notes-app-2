-- CreateTable
CREATE TABLE "OrderReleaseAuthorization" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrderReleaseAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderReleaseAuthorization_orderId_shopDomain_idx" ON "OrderReleaseAuthorization"("orderId", "shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReleaseAuthorization_orderId_shopDomain_key" ON "OrderReleaseAuthorization"("orderId", "shopDomain");
