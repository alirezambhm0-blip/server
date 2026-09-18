# Bonko Market — پلتفرم عمده‌فروشی B2B

سامانه سفارش‌گیری عمده برای فروشگاه‌ها: مشتریان (فروشگاه‌داران) از طریق اپ موبایل کاتالوگ را می‌بینند، سفارش ثبت می‌کنند و وضعیت سفارش/تیکت را دنبال می‌کنند؛ ادمین از پنل وب مدیریت می‌کند و ویزیتورها فروش حضوری ثبت می‌کنند.

## ساختار مخزن (Monorepo)

| پوشه | تکنولوژی | نقش |
|---|---|---|
| `wholesale-api/` | NestJS 11 + Prisma 5 + PostgreSQL | بک‌اند (REST API) + سرو پنل ادمین از مسیر `/admin` |
| `wholesale-mobile/` | Expo SDK 56 / React Native 0.85 | اپ موبایل مشتری (Android/iOS) |
| `*.md` (ریشه) | — | مستندات فازها و گزارش پیشرفت (`RELEASE-PROGRESS.md`) |

## پیش‌نیازها

- Node.js 20+ و npm
- PostgreSQL (دارای دیتابیس خالی + connection string)

## راه‌اندازی بک‌اند

```bash
cd wholesale-api
cp .env.example .env        # مقدار DATABASE_URL و سایر سکرت‌ها را پر کنید (از placeholderهای <REPLACE_ME_XXX>)
npm ci                      # نصب دقیق از روی lockfile — همیشه ci، نه install
npm run db:generate         # تولید Prisma Client
npm run db:migrate          # اعمال مایگریشن‌ها (محیط توسعه)
npm run db:seed             # داده اولیه (اختیاری)
npm run start:dev           # اجرا با watch — پیش‌فرض: http://localhost:3000
```

- **مستندات تعاملی API (Swagger UI):** بعد از اجرا در `http://localhost:3000/docs` (خروجی OpenAPI JSON در `/docs-json`)
- **پنل ادمین:** `http://localhost:3000/admin`

### اسکریپت‌های دیتابیس

| دستور | کار |
|---|---|
| `npm run db:generate` | تولید Prisma Client بعد از هر تغییر schema |
| `npm run db:migrate` | ساخت/اعمال مایگریشن در محیط توسعه (`prisma migrate dev`) |
| `npm run db:studio` | رابط گرافیکی مرور دیتابیس |
| `npm run db:seed` | اجرای `prisma/seed.ts` |

## راه‌اندازی موبایل

```bash
cd wholesale-mobile
npm ci
npx expo start              # سپس با Expo Go یا emulator اجرا کنید
```

## چک‌های کیفیت (قبل از هر کامیت)

```bash
# بک‌اند
cd wholesale-api
npx eslint src && npx tsc --noEmit && npm run build

# موبایل
cd wholesale-mobile
npx tsc --noEmit && npm run lint
```

## مستندات بیشتر

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — نقشه معماری، ماژول‌ها و قواعد داده‌ای
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — قوانین تغییر کد و سبک کامیت
- [`RELEASE-PROGRESS.md`](RELEASE-PROGRESS.md) — سوابق همه فازها و راستی‌آزمایی‌ها
