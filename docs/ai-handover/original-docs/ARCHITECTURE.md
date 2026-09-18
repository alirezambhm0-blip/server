# معماری Bonko Market

## نمای کلی

```
┌──────────────────┐      HTTPS / JSON (REST)      ┌────────────────────┐      Prisma      ┌────────────┐
│  اپ موبایل        │  ───────────────────────────▶ │  wholesale-api      │ ─────────────▶ │ PostgreSQL │
│  Expo / RN        │ ◀───────────────────────────  │  NestJS 11          │                │            │
│  (مشتری B2B)      │      JWT Bearer (OTP login)   │  + پنل ادمین /admin  │                │            │
└──────────────────┘                                └────────────────────┘                └────────────┘
```

- **قرارداد مشترک:** API فقط JSON برمی‌گرداند؛ تغییر شکل خروجی = شکستن قرارداد با موبایل → هر تغییر سرویس باید با مصرف‌کننده موبایل (grep روی `wholesale-mobile/src/api`) سازگاری‌اش اثبات شود.
- **احراز هویت:** ورود دومرحله‌ای با OTP پیامکی (`auth/request-otp` → `auth/verify-otp`) و صدور JWT. گاردها: `JwtAuthGuard` (ایجباری)، `OptionalJwtAuthGuard` (مسیرهای عمومی-شخصی)، `RolesGuard`.
- **نقش‌ها (`UserRole`):** `CUSTOMER` (فروشگاه‌دار؛ نیازمند `Customer.status=APPROVED` برای خرید)، `ADMIN` (مدیریت کامل)، `VISITOR` (ویزیتور فروش حضوری — فقط ماژول visitor-sales).
- **جداسازی داده (tenant isolation):** هر کوئری سمت مشتری با `userId`/`customerId`ِ استخراج‌شده از JWT محدود می‌شود؛ هرگز از body/query برای هویت کاربر استفاده نمی‌کنیم.

## ماژول‌های بک‌اند (`wholesale-api/src`)

| ماژول | مسئولیت |
|---|---|
| `auth` | OTP، JWT، پروفایل، درخواست تغییر فیلد حساس (تایید ادمین)، گاردها/دکوریتورها |
| `products` / `categories` / `search` / `banners` | کاتالوگ: لیست/جزئیات کالا، مشابه‌ها، علاقه‌مندی، جستجو، بنر |
| `cart` | سبد خرید مشتری |
| `orders` | ثبت سفارش از سبد (تراکنش اتمیک + قفل موجودی)، پیگیری/لغو/فاکتور، مدیریت ادمین، سفارش دستی |
| `visitor-sales` | ثبت فروش حضوری توسط ویزیتور + گزارش عملکرد |
| `tickets` | تیکت پشتیبانی دوطرفه (مشتری ↔ ادمین) |
| `notifications` | اعلان‌ها: رویدادمحور (`EventEmitter`) + ارسال Push از طریق Expo |
| `profile` | داده‌های تکمیلی پروفایل مشتری |
| `files` | آپلود/سرو فایل (KYC خصوصی-فقط‌ادمین، تصاویر کالا/دسته عمومی) |
| `admin` | داشبورد و عملیات مدیریتی تجمیعی |
| `app-version` | بررسی نسخه اپ و اجبار به‌روزرسانی |
| `backup` | بکاپ‌گیری زمان‌بندی‌شده (Schedule) |
| `sms` | ارسال پیامک (سرویس SOAP) |
| `prisma` / `common` | سرویس Prisma و ابزارهای مشترک (Sentry filter و...) |

## الگوهای کلیدی (به‌هیچ‌وجه دور نزنید)

1. **تراکنش سفارش** (`orders.service.createFromCart`): داخل یک `$transaction` با قفل `pessimistic_write` روی کالاها → بررسی موجودی → ساخت سفارش → کسر موجودی → پاک‌سازی سبد. هر خطا = rollback کامل.
2. **رویدادها به‌جای جفت‌شدگی:** تغییر وضعیت سفارش رویداد `OrderStatusChanged` منتشر می‌کند؛ listener نوتیفیکیشن جداگانه Push می‌فرستد (non-blocking).
3. **کوئری‌های لیست:** خواندنی‌های چندبخشی (total + items + counts) داخل `$transaction` آرایه‌ای = یک رفت‌وبرگشت DB.
4. **select لاغر (فاز ۵-۲):** کوئری‌ها فقط فیلدهای مصرفی پاسخ را می‌خوانند؛ قبل از افزودن فیلد، مصرف‌کننده موبایل را چک کنید.
5. **اعتبارسنجی ورودی:** هر `@Body()` کلاس DTO با decoratorهای `class-validator`؛ `ValidationPipe` سراسری با `whitelist + forbidNonWhitelisted` → **mass assignment ممنوع**.
6. **فیلدهای حساس پروفایل:** فقط از مسیر `auth/profile/sensitive-change` و با **تایید ادمین** تغییر می‌کنند (قانون محصولی).
7. **خطا و مانیتورینگ:** Sentry در `main.ts` (در صورت وجود `SENTRY_DSN`) + Throttler سراسری ضد سوءاستفاده.

## جریان داده نمونه: ثبت سفارش

`Mobile → POST /orders (JWT) → OrdersController → OrdersService.createFromCart → [tr.lock + stock check] → DB` → پاسخ `warnings/order` → رویداد → Push به مشتری/ادمین.

## مستندات زنده API

Swagger UI روی `/docs` — **فقط localhost (حتی روی سرور؛ دسترسی با SSH tunnel سپس localhost:3000/docs)** — خودکار از روی کنترلرها + کامنت‌های JSDoc؛ پلاگین در `nest-cli.json`. جزئیات فنی هر فاز در `RELEASE-PROGRESS.md` و تصمیمات عملکردی در `PERFORMANCE.md`.
