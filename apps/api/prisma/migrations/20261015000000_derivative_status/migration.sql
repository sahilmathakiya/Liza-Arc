-- CreateEnum
CREATE TYPE "DerivativeStatus" AS ENUM ('NONE', 'PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "floor_plan" ADD COLUMN "thumbnailStatus" "DerivativeStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "interior_plan" ADD COLUMN "previewCardKey" TEXT,
ADD COLUMN "previewHeroKey" TEXT,
ADD COLUMN "thumbnailStatus" "DerivativeStatus" NOT NULL DEFAULT 'NONE';

-- Backfill: existing elevation thumbnails are already generated.
UPDATE "floor_plan" SET "thumbnailStatus" = 'READY' WHERE "elevationThumbKey" IS NOT NULL;
UPDATE "floor_plan" SET "thumbnailStatus" = 'FAILED'
  WHERE "elevationThumbKey" IS NULL AND "elevationKey" IS NOT NULL;

-- Interior previews uploaded before versioned derivatives keep serving the
-- original until an admin regenerates them (status NONE).
