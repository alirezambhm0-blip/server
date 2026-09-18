-- Migration: OTP hardening + OtpAttempt log
-- =====================================================
-- 1) تغییر نام جدول "Otp" (با حروف بزرگ) به otps استاندارد
-- 2) افزودن فیلدهای امنیتی: attempts, lastAttemptAt, usedAt, resendCount
-- 3) ساخت جدول otp_attempts برای لاگ کامل تلاش‌ها (جهت پنل ادمین)

-- چون جدول قبلی با نام "Otp" (با حروف بزرگ و نقل‌قول) ساخته شده، باید با quotes به آن دسترسی بزنیم
ALTER TABLE "Otp" RENAME TO "otps";
ALTER INDEX "Otp_phone_key" RENAME TO "otps_phone_key";
ALTER INDEX "Otp_pkey" RENAME TO "otps_pkey";

-- افزودن فیلدهای جدید
ALTER TABLE "otps"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "usedAt" TIMESTAMP(3),
  ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- برای رکوردهای موجود مقدار updatedAt را مقداردهی اولیه می‌کنیم
UPDATE "otps" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- =====================================================
-- جدول لاگ تلاش‌های OTP (برای پنل ادمین و مانیتورینگ)
-- =====================================================
CREATE TYPE "OtpAction" AS ENUM ('RESEND', 'VERIFY');

CREATE TABLE "otp_attempts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "code" TEXT,
    "action" "OtpAction" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "otp_attempts_phone_createdAt_idx" ON "otp_attempts"("phone", "createdAt");

-- Foreign key به customers (اگر customerId ارائه شد)
ALTER TABLE "otp_attempts"
  ADD CONSTRAINT "otp_attempts_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- برای راحتی پنل ادمین، یک VIEW هم اضافه می‌کنیم که آخرین
-- وضعیت هر شماره موبایل را همراه با تعداد تلاش‌ها نشان بدهد
-- (اختیاری، اما به پرسش آتی پنل ادمین کمک می‌کند)
-- =====================================================
