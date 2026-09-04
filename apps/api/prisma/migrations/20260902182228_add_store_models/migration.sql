-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('FLOOR_PLAN', 'INTERIOR_PLAN');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('FLOOR_PLAN', 'ELEVATION_IMAGE', 'WORKING_DRAWING');

-- CreateEnum
CREATE TYPE "InteriorCategory" AS ENUM ('KITCHEN', 'HALL', 'LIVING_ROOM', 'BEDROOM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_plan" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lengthFt" INTEGER NOT NULL,
    "widthFt" INTEGER NOT NULL,
    "floorAreaSqFt" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "floors" INTEGER NOT NULL,
    "floorPlanPriceCents" INTEGER NOT NULL,
    "elevationPriceCents" INTEGER NOT NULL,
    "bundlePriceCents" INTEGER,
    "floorPlanKey" TEXT,
    "elevationKey" TEXT,

    CONSTRAINT "floor_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interior_plan" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "category" "InteriorCategory" NOT NULL,
    "workingDrawingPriceCents" INTEGER NOT NULL,
    "previewKey" TEXT,
    "workingDrawingKey" TEXT,

    CONSTRAINT "interior_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "entitlementType" "EntitlementType" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "id" TEXT NOT NULL,
    "type" "EntitlementType" NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE INDEX "product_type_published_idx" ON "product"("type", "published");

-- CreateIndex
CREATE UNIQUE INDEX "floor_plan_productId_key" ON "floor_plan"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "interior_plan_productId_key" ON "interior_plan"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "order_paymentRef_key" ON "order"("paymentRef");

-- CreateIndex
CREATE INDEX "order_userId_idx" ON "order"("userId");

-- CreateIndex
CREATE INDEX "order_item_productId_idx" ON "order_item"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_orderItemId_key" ON "entitlement"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_userId_productId_type_key" ON "entitlement"("userId", "productId", "type");

-- AddForeignKey
ALTER TABLE "floor_plan" ADD CONSTRAINT "floor_plan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interior_plan" ADD CONSTRAINT "interior_plan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
