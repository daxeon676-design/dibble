-- CreateTable
CREATE TABLE "ShopProfile" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "socialLinks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryProfile" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "serviceType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImmutableAuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmutableAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopProfile_sellerId_key" ON "ShopProfile"("sellerId");

-- CreateIndex
CREATE INDEX "ShopProfile_sellerId_idx" ON "ShopProfile"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryProfile_sellerId_key" ON "DeliveryProfile"("sellerId");

-- CreateIndex
CREATE INDEX "DeliveryProfile_sellerId_idx" ON "DeliveryProfile"("sellerId");

-- CreateIndex
CREATE INDEX "ImmutableAuditLog_actor_idx" ON "ImmutableAuditLog"("actor");

-- CreateIndex
CREATE INDEX "ImmutableAuditLog_action_idx" ON "ImmutableAuditLog"("action");

-- CreateIndex
CREATE INDEX "ImmutableAuditLog_targetType_targetId_idx" ON "ImmutableAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ImmutableAuditLog_timestamp_idx" ON "ImmutableAuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "ShopProfile" ADD CONSTRAINT "ShopProfile_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryProfile" ADD CONSTRAINT "DeliveryProfile_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
