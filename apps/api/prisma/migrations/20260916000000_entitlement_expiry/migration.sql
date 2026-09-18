-- AlterTable
ALTER TABLE "entitlement" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill: existing grants expire 180 days after they were created
UPDATE "entitlement" SET "expiresAt" = "createdAt" + INTERVAL '180 days';

-- DropIndex
DROP INDEX "entitlement_userId_productId_type_key";

-- CreateIndex
CREATE INDEX "entitlement_userId_productId_type_idx" ON "entitlement"("userId", "productId", "type");
