-- AlterTable
ALTER TABLE "order" ADD COLUMN "razorpayOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "order_razorpayOrderId_key" ON "order"("razorpayOrderId");
