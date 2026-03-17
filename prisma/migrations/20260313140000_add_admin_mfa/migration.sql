-- AlterTable: add MFA fields to User
ALTER TABLE "User" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "mfaSecret" TEXT;
