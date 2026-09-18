-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('APP', 'ADMIN', 'VISITOR_IN_PERSON');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'VISITOR';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "itemsPerPackageLabel" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "orderSource" "OrderSource" NOT NULL DEFAULT 'APP',
ADD COLUMN     "placedByName" TEXT,
ADD COLUMN     "placedByUserId" TEXT,
ADD COLUMN     "visitorNote" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "itemsPerPackage" INTEGER,
ADD COLUMN     "packageType" TEXT;
