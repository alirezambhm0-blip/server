/*
  Warnings:

  - You are about to drop the column `phone` on the `customers` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "customers_phone_key";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "phone";

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Otp_phone_key" ON "Otp"("phone");
