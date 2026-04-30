-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('CDEK', 'OZON');

-- AlterTable
ALTER TABLE "OrderRequest"
ADD COLUMN "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "promoCode" TEXT,
ADD COLUMN "promoDiscountPercent" INTEGER,
ADD COLUMN "deliveryMethod" "DeliveryMethod",
ADD COLUMN "pickupPointAddress" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "customerFullName" TEXT;

-- Backfill existing rows so subtotal matches the historical payable total.
UPDATE "OrderRequest"
SET "subtotal" = "total"
WHERE "subtotal" = 0;
