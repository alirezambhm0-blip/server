/*
  Warnings:

  - You are about to drop the `error_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costPrice" INTEGER;

-- DropTable
DROP TABLE "error_logs";
