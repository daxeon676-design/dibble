-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PLATFORM_PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SellerPayout" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "sellerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "netAmountCents" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PLATFORM_PENDING',
    "payoutMethod" TEXT,
    "stripeTransferId" TEXT,
    "stripePayout" JSONB,
    "failureReason" TEXT,
    "failureCode" TEXT,
    "manualPayoutNotes" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayout_stripeTransferId_key" ON "SellerPayout"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayout_orderId_key" ON "SellerPayout"("orderId");

-- CreateIndex
CREATE INDEX "SellerPayout_sellerId_idx" ON "SellerPayout"("sellerId");

-- CreateIndex
CREATE INDEX "SellerPayout_status_idx" ON "SellerPayout"("status");

-- CreateIndex
CREATE INDEX "SellerPayout_createdAt_idx" ON "SellerPayout"("createdAt");

-- CreateIndex
CREATE INDEX "SellerPayout_settledAt_idx" ON "SellerPayout"("settledAt");

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
