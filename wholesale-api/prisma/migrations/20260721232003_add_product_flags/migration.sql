-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "landlinePhone" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isDiscounted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isNew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "oldPrice" INTEGER;
