-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "businessLicenseImage" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "nationalCardImage" TEXT,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfieWithIdCardImage" TEXT,
ADD COLUMN     "storefrontImage" TEXT;
