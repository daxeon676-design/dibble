-- Persist seller payout profile and Stripe Connect account on User
ALTER TABLE "User"
ADD COLUMN "stripeConnectAccountId" TEXT,
ADD COLUMN "payoutMethod" TEXT,
ADD COLUMN "payoutPayeeName" TEXT,
ADD COLUMN "payoutEmail" TEXT,
ADD COLUMN "payoutBankName" TEXT,
ADD COLUMN "payoutBankAccountLast4" TEXT,
ADD COLUMN "payoutBankSortCodeLast2" TEXT,
ADD COLUMN "payoutPaypalEmail" TEXT,
ADD COLUMN "payoutNotes" TEXT,
ADD COLUMN "payoutAdminNotes" TEXT,
ADD COLUMN "payoutUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_stripeConnectAccountId_key" ON "User"("stripeConnectAccountId");
