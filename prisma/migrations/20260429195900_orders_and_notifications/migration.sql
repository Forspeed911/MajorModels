-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'NOTIFIED');

-- CreateTable
CREATE TABLE "OrderRequest" (
    "id" UUID NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "telegramFullName" TEXT,
    "comment" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "total" DECIMAL(12,2) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "notificationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderRequest_telegramUserId_idx" ON "OrderRequest"("telegramUserId");

-- CreateIndex
CREATE INDEX "OrderRequest_status_idx" ON "OrderRequest"("status");

-- CreateIndex
CREATE INDEX "OrderRequest_createdAt_idx" ON "OrderRequest"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "OrderItem"("orderId", "productId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

