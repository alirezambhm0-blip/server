# فاز ۵-۱ (Type Safety) — راهنمای اعمال تغییرات

## محتویات این زیپ
- `wholesale-api/src/**` — ۳۸ فایل TypeScript اصلاح‌شده (type-safety)
- `wholesale-mobile/eslint.config.js` — **فایل جدید** (تنزل مستند قوانین React Compiler به warn)
- `wholesale-mobile/package.json` + `package-lock.json` — اضافه‌شدن devDependencyهای لینت
- `RELEASE-PROGRESS.md` (به‌روزرسانی) + `PHASE5-1-SUMMARY.md` (جدید)

## روش اعمال
محتویات زیپ را در **ریشه پروژه** (جایی که پوشه‌های `wholesale-api` و `wholesale-mobile` کنار هم هستند) استخراج و جایگزین کنید.

⚠️ پیش‌نیاز: وضعیت پروژه شما باید همان پایانیِ فاز ۴ باشد (قبل از فاز ۵-۱).

## دستورات لازم ترمینال

### ✅ اجباری — فقط برای موبایل (به‌خاطر تغییر package.json):
```bash
cd wholesale-mobile
npm install
```
دلیل: اضافه‌شدن `eslint` و `eslint-config-expo` به devDependencies تا `npm run lint` کار کند.

### ⭕ برای بک‌اند دستور اجباری جدیدی نیست
هیچ dependency جدیدی به `wholesale-api` اضافه نشده است؛
اگر تازه پروژه را کلون کرده‌اید همان مراحل معمول کافی است:
```bash
cd wholesale-api
npm install
npx prisma generate
```

## تأیید صحت فاز ۵-۱ (اختیاری ولی توصیه‌شده)

```bash
cd wholesale-api
npx eslint src        # انتظار: ۰ خطا / ۰ هشدار
npx tsc --noEmit      # انتظار: ۰ خطا
npm run build         # انتظار: موفق

cd ../wholesale-mobile
npx tsc --noEmit      # انتظار: ۰ خطا
npm run lint          # انتظار: ۰ خطا (فقط warningهای مستند/عمدی)
```

## نکات مهم
- **بدون نیاز به migration دیتابیس** — هیچ تغییری در `prisma/schema.prisma` وجود ندارد.
- **بدون تغییر رفتار کدها** — همه اصلاحات type-level هستند؛ تنها رفتاری که عوض شده، رفع ۲ باگ نهان است (جزئیات در PHASE5-1-SUMMARY.md):
  1. **[IDOR]** `visitor-sales.controller.ts`: `req.user.id` → `req.user.userId` (ویزیتور قبلاً همه سفارش‌ها را می‌دید!)
  2. `admin.controller.ts` → `replyToTicket`: `user.id` → `user.userId`
- بعد از جایگزینی، اپ موبایل و API را یک‌بار به‌صورت دستی باز کنید و فلوی‌های کلیدی (ورود OTP، ثبت سفارش، پنل ادمین) را تست کنید.
