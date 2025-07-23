-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductNote" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "ProductNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductNotePhoto" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,

    CONSTRAINT "ProductNotePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAcknowledgment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "acknowledgedBy" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proofPhotoUrl" TEXT,
    "proofPhotoName" TEXT,
    "noteId" TEXT,

    CONSTRAINT "OrderAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productNoteId" TEXT,
    "acknowledgmentId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "requireAcknowledgment" BOOLEAN NOT NULL DEFAULT true,
    "requirePhotoProof" BOOLEAN NOT NULL DEFAULT false,
    "blockFulfillment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductNote_productId_shopDomain_idx" ON "ProductNote"("productId", "shopDomain");

-- CreateIndex
CREATE INDEX "ProductNotePhoto_noteId_idx" ON "ProductNotePhoto"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAcknowledgment_orderId_productId_key" ON "OrderAcknowledgment"("orderId", "productId");

-- CreateIndex
CREATE INDEX "OrderAcknowledgment_orderId_shopDomain_idx" ON "OrderAcknowledgment"("orderId", "shopDomain");

-- CreateIndex
CREATE INDEX "AuditLog_shopDomain_timestamp_idx" ON "AuditLog"("shopDomain", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_shopDomain_key" ON "AppSetting"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_shopDomain_key" ON "BillingSubscription"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_subscriptionId_key" ON "BillingSubscription"("subscriptionId");

-- AddForeignKey
ALTER TABLE "ProductNotePhoto" ADD CONSTRAINT "ProductNotePhoto_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ProductNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_productNoteId_fkey" FOREIGN KEY ("productNoteId") REFERENCES "ProductNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_acknowledgmentId_fkey" FOREIGN KEY ("acknowledgmentId") REFERENCES "OrderAcknowledgment"("id") ON DELETE SET NULL ON UPDATE CASCADE;