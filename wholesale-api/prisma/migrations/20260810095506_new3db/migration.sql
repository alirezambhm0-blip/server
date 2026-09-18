/*
  Warnings:

  - You are about to drop the column `androidChannel` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `deepLink` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `orderNumber` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `subtotalAmount` on the `orders` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[order_number]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_number` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal_amount` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "orders_orderNumber_key";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "name_normalized" TEXT;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "androidChannel",
DROP COLUMN "createdAt",
DROP COLUMN "deepLink",
ADD COLUMN     "android_channel" TEXT DEFAULT 'promotions',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deep_link" JSONB,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_broadcast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "type" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "originalPrice" INTEGER,
ADD COLUMN     "productImageUrl" TEXT;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "orderNumber",
DROP COLUMN "subtotalAmount",
ADD COLUMN     "alternativeAddress" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "order_number" TEXT NOT NULL,
ADD COLUMN     "subtotal_amount" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameNormalized" TEXT,
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "unitDetails" TEXT;

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "changedBy" TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "query_normalized" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "query" TEXT NOT NULL,
    "query_normalized" TEXT NOT NULL,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "hadResults" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "device_info" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_history_userId_searchedAt_idx" ON "search_history"("userId", "searchedAt");

-- CreateIndex
CREATE INDEX "search_logs_query_normalized_createdAt_idx" ON "search_logs"("query_normalized", "createdAt");

-- CreateIndex
CREATE INDEX "error_logs_created_at_idx" ON "error_logs"("created_at");

-- CreateIndex
CREATE INDEX "categories_name_normalized_idx" ON "categories"("name_normalized");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "products_nameNormalized_idx" ON "products"("nameNormalized");

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
