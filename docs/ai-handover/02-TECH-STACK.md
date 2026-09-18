# 02 — TECH STACK

> همهٔ نسخه‌ها مستقیماً از `wholesale-api/package.json` و `wholesale-mobile/package.json`
> خوانده شده‌اند (`CONFIRMED`). برای نسخهٔ **واقعا نصب‌شده** به `package-lock.json` مراجعه کنید.

---

## 1. نمای کلی

| لایه | تکنولوژی | نسخه |
|---|---|---|
| Backend runtime | Node.js + NestJS | `^11.0.1` |
| Language | TypeScript | API `^5.7.3` · Mobile `~6.0.3` |
| Database | PostgreSQL | 16 (در `docker-compose.yml`) |
| ORM | Prisma | `^5.22.0` |
| Mobile | Expo SDK 56 / React Native | `~56.0.13` / `0.85.3` |
| Mobile UI | React + react-native-web | `19.2.3` / `~0.21.0` |
| Routing (mobile) | expo-router | `~56.2.12` |
| Admin Panel | Vanilla JS (بدون framework) | — |
| Test (API) | Jest + ts-jest | `^30.0.0` / `^29.2.5` |
| Test (Mobile) | — | ❌ **NOT FOUND** |

---

## 2. بک‌اند — وابستگی‌های runtime

`CONFIRMED` از `wholesale-api/package.json` → `dependencies`

### ۲-۱. هستهٔ NestJS
| پکیج | نسخه | کاربرد |
|---|---|---|
| `@nestjs/core` | `^11.0.1` | هستهٔ DI/ماژول |
| `@nestjs/common` | `^11.0.1` | decorator، `HttpException` |
| `@nestjs/platform-express` | `^11.0.1` | آداپتور Express 5 |
| `@nestjs/config` | `^4.0.4` | خواندن `.env` |
| `@nestjs/swagger` | `^11.4.7` | مستندات API روی `/api/docs` |
| `@nestjs/serve-static` | `^5.0.5` | سرو `public/admin` و `uploads/` |
| `@nestjs/event-emitter` | `^3.1.0` | رویدادهای `kyc.*` / `order.*` |
| `@nestjs/schedule` | `^6.1.3` | `@Cron` برای بکاپ |
| `@nestjs/throttler` | `^6.5.0` | ⚠️ **ثبت شده ولی اعمال نشده** → `15-SECURITY.md` §S1 |

### ۲-۲. احراز هویت
| پکیج | نسخه | کاربرد |
|---|---|---|
| `@nestjs/jwt` | `^11.0.2` | ساخت/verify توکن |
| `@nestjs/passport` | `^11.0.5` | پل Passport |
| `passport` | `^0.7.0` | هستهٔ استراتژی |
| `passport-jwt` | `^4.0.1` | `JwtStrategy` |
| `bcrypt` | `^6.0.0` | ⚠️ **نصب شده ولی صفر ارجاع در `src/`** |

⚠️ `CONFIRMED` **`bcrypt` استفاده نمی‌شود.** این پروژه **password ندارد** —
احراز هویت فقط OTP است. پکیج و `@types/bcrypt` را بدون بررسی حذف نکنید
(شاید برای آینده در نظر گرفته شده) ولی بدانید که dead dependency است.

### ۲-۳. اعتبارسنجی و تبدیل داده
| پکیج | نسخه | کاربرد |
|---|---|---|
| `class-validator` | `^0.15.1` | `@IsPhoneNumber`، `@IsEnum` و... در DTOها |
| `class-transformer` | `^0.5.1` | `plainToInstance` در `ValidationPipe` |

⚠️ `CONFIRMED` `ValidationPipe` سراسری در `main.ts` **`transform: true`** دارد.
این یعنی payloadهای خام به instance کلاس تبدیل می‌شوند.

### ۲-۴. فایل و تصویر
| پکیج | نسخه | کاربرد |
|---|---|---|
| `multer` | `^2.2.0` | آپلود multipart (KYC، بنر، تصویر محصول) |
| `sharp` | `^0.35.4` | resize/بهینه‌سازی تصویر |

### ۲-۵. سرویس‌های خارجی
| پکیج | نسخه | کاربرد | وضعیت واقعی |
|---|---|---|---|
| `soap` | `^1.9.3` | ارسال پیامک از طریق ملی‌پیامک | ✅ استفاده می‌شود (`sms.service.ts`) |
| `expo-server-sdk` | `^6.1.0` | Push notification | ✅ استفاده می‌شود (`notifications.service.ts`) |
| `axios` | `^1.18.1` | HTTP client | `grep` → در `src/` **صفر ارجاع** ⚠️ |
| `@sentry/node` | `^10.66.0` | گزارش خطا | ⚠️ **`SENTRY_DSN` در `.env` نیست** → `SentryFilter` غیرفعال |
| `@sentry/profiling-node` | `^10.66.0` | profiling | `INFERRED` همراه Sentry |

⚠️ `CONFIRMED` **`axios` در بک‌اند dead dependency است.**
`grep -rn "from 'axios'\|require('axios')" wholesale-api/src` → هیچ نتیجه‌ای.
کد بک‌اند از `soap` و `expo-server-sdk` استفاده می‌کند، نه axios مستقیم.

⚠️ `CONFIRMED` WSDL ملی‌پیامک روی **HTTP ساده** است:
```
http://api.payamak-panel.com/post/send.asmx?wsdl
```

### ۲-۶. سایر
| پکیج | نسخه | کاربرد |
|---|---|---|
| `reflect-metadata` | `^0.2.2` | الزامی برای DI در NestJS |
| `rxjs` | `^7.8.1` | الزامی برای NestJS (`Observable`) |

---

## 3. بک‌اند — وابستگی‌های development

| پکیج | نسخه | نکته |
|---|---|---|
| `@nestjs/cli` | `^11.0.1` | `nest build` / `nest start` |
| `@nestjs/testing` | `^11.0.1` | `Test.createTestingModule` در specها |
| `jest` | `^30.0.0` | ⚠️ **نسخهٔ اصلی ۳۰** — مستندات قدیمی «Jest 3/3» می‌گفتند |
| `ts-jest` | `^29.2.5` | ⚠️ ts-jest روی ۲۹ است در حالی که jest روی ۳۰ |
| `supertest` | `^7.0.0` | نصب شده ولی **هیچ `*.e2e-spec.ts` وجود ندارد** |
| `eslint` | `^9.18.0` | flat config |
| `typescript-eslint` | `^8.20.0` | — |
| `eslint-plugin-prettier` | `^5.2.2` | — |
| `eslint-config-prettier` | `^10.0.1` | — |
| `prettier` | `^3.4.2` | — |
| `prisma` (CLI) | `^5.22.0` | ⚠️ باید با `@prisma/client` هم‌نسخه بماند |
| `ts-node` | `^10.9.2` | اجرای `seed.ts` و `scripts/` |
| `source-map-support` | `^0.5.21` | — |

---

## 4. موبایل — وابستگی‌ها

`CONFIRMED` از `wholesale-mobile/package.json`

### ۴-۱. هسته
| پکیج | نسخه |
|---|---|
| `expo` | `~56.0.13` |
| `react` / `react-dom` | `19.2.3` |
| `react-native` | `0.85.3` |
| `react-native-web` | `~0.21.0` |
| `expo-router` | `~56.2.12` |

### ۴-۲. Navigation و Gesture
| پکیج | نسخه |
|---|---|
| `react-native-screens` | `~4.26.0` |
| `react-native-gesture-handler` | `~2.31.1` |
| `react-native-safe-area-context` | `~5.7.0` |
| `react-native-reanimated` | `4.3.1` |
| `react-native-worklets` | `0.8.3` |

⚠️ `CONFIRMED` Reanimated 4 به `react-native-worklets` وابسته است — این جفت را جدا نکنید.

### ۴-۳. State و ذخیره‌سازی
| پکیج | نسخه | کاربرد |
|---|---|---|
| `@react-native-async-storage/async-storage` | `2.2.0` | cart، تنظیمات، lastSeenAt |
| `expo-secure-store` | `~56.0.4` | توکن JWT (`authStorage.ts`) |

⚠️ `CONFIRMED` **دو مکانیزم ذخیره‌سازی متفاوت** — توکن در SecureStore، بقیه در AsyncStorage.
`authStorage.ts` هر دو را wrap می‌کند.

### ۴-۴. قابلیت‌های دستگاه
| پکیج | نسخه |
|---|---|
| `expo-notifications` | `~56.0.25` |
| `expo-image-picker` | `~56.0.25` |
| `expo-image` | `~56.0.12` |
| `expo-font` | `~56.0.7` |
| `expo-constants` | `~56.0.21` |
| `expo-device` | `~56.0.4` |
| `expo-linking` | `~56.0.14` |
| `expo-splash-screen` | `~56.0.11` |
| `expo-status-bar` | `~56.0.4` |
| `expo-system-ui` | `~56.0.5` |
| `expo-web-browser` | `~56.0.6` |
| `@react-native-community/netinfo` | `12.0.1` |

### ۴-۵. UI و افکت
| پکیج | نسخه |
|---|---|
| `@expo/vector-icons` | `^15.1.1` |
| `@expo/ui` | `~56.0.19` |
| `expo-glass-effect` | `~56.0.4` |
| `expo-symbols` | `~56.0.6` |

### ۴-۶. Build و OTA
| پکیج | نسخه | نکته |
|---|---|---|
| `expo-updates` | `~56.0.26` | OTA |
| `expo-dev-client` | `~56.0.26` | build توسعه |
| `expo-build-properties` | **`^57.0.17`** | ⚠️ **نسخهٔ SDK 57 روی پروژهٔ SDK 56** |
| `babel-plugin-module-resolver` | `^5.0.3` | alias `@/` |

🔴 `CONFIRMED` **عدم تطابق نسخه:** همهٔ پکیج‌های `expo-*` روی `~56.x` هستند
ولی `expo-build-properties` روی `^57.0.17`. این در تغییرات commit‌نشده اضافه شده
(برای `usesCleartextTraffic`). `UNVERIFIED` — نتوانستم build واقعی بگیرم که ببینم کار می‌کند یا نه.

### ۴-۷. سایر
| پکیج | نسخه |
|---|---|
| `axios` | `^1.18.1` | ✅ استفاده می‌شود (`httpClient.ts`) |
| `@sentry/react-native` | `~7.11.0` | ✅ `Sentry.wrap(RootLayout)` در `_layout.tsx` |

⚠️ `CONFIRMED` Sentry سمت موبایل **فعال است** ولی سمت بک‌اند (`SENTRY_DSN`) **غیرفعال**.

### ۴-۸. devDependencies موبایل
| پکیج | نسخه | نکته |
|---|---|---|
| `typescript` | **`~6.0.3`** | ⚠️ TS 6 (بک‌اند روی 5.7 است) |
| `eslint` | `^9.0.0` | — |
| `eslint-config-expo` | `~56.0.4` | منبع ۱۴۰ هشدار |
| `@types/react` | `~19.2.2` | — |
| `@expo/ngrok` | `^4.1.3` | tunnel برای تست روی دستگاه |

---

## 5. ابزار build و زیرساخت

### ۵-۱. بک‌اند
```
docker-compose.yml      ← PostgreSQL 16 + pgAdmin
nest-cli.json           ← تنظیمات nest build
tsconfig.json           ← experimentalDecorators + emitDecoratorMetadata + strict
tsconfig.build.json     ← حذف spec و test
```
`CONFIRMED` خروجی build → `dist/` (با `dist/src/main.js`، چون `rootDir` ریشهٔ پروژه است).
اسکریپت `start:prod` → `node dist/src/main`.

⚠️ `CONFIRMED` **پسوند مسیر `dist/src/main` عمدی است** و با ساختار nest-cli معمول
(`dist/main`) فرق دارد. اگر `tsconfig` را تغییر دهید، این مسیر می‌شکند.

### ۵-۲. موبایل
```
app.json                ← نام، آیکون، پلاگین‌ها، EAS projectId، runtimeVersion
babel.config.js         ← babel-preset-expo + module-resolver برای @/
tsconfig.json           ← extends expo/tsconfig.base + jsx: react-native + paths
metro.config.js         ← تنظیمات Metro
```
✅ `CONFIRMED` **`wholesale-mobile/eas.json` وجود دارد و در git track است** (از کامیت `4b8a847`).
پروفایل‌ها: `development` / `preview` / `production` — دوتای آخر `channel` دارند.
اسکریپت‌های `update` و `update:preview` در `package.json` با آن سازگارند. **مسیر OTA کامل است.**
و `app.json` یک `projectId` دارد. `UNVERIFIED` — پیکربندی EAS احتمالاً فقط سمت سرور Expo است.

### ۵-۳. CI/CD
❌ `CONFIRMED` **NOT FOUND** — هیچ `.github/workflows/`، `Jenkinsfile`، یا pipeline دیگری
در این snapshot وجود ندارد.

---

## 6. محیط اجرا

### ۶-۱. متغیرهای محیط بک‌اند
`CONFIRMED` فقط **نام** کلیدها از `wholesale-api/.env` (مقادیر هرگز در مستندات نوشته نمی‌شوند):

```
# ── دیتابیس و سرور ──
DATABASE_URL  PORT  NODE_ENV  CORS_ORIGINS

# ── احراز هویت ──
JWT_SECRET  JWT_EXPIRES_IN  ADMIN_PHONE

# ── پیامک (ملی‌پیامک) ──
MELIPAYAMAK_USERNAME  MELIPAYAMAK_PASSWORD  MELIPAYAMAK_BODY_ID
MELIPAYAMAK_FROM       ← ⚠️ صفر ارجاع در src/
MELIPAYAMAK_OTP_TOKEN  ← ⚠️ صفر ارجاع در src/

# ── نسخهٔ اپ ──
LATEST_APP_VERSION  MIN_APP_VERSION  EXPO_PUBLIC_API_URL

# ── بکاپ ──
BACKUP_DIR  BACKUP_INTERVAL  BACKUP_MAX_COUNT

# ── کسب‌وکار (تعریف‌شده ولی بی‌اثر) ──
MIN_ORDER_AMOUNT           ← ⚠️ صفر ارجاع در src/
FREE_SHIPPING_MIN_AMOUNT   ← ⚠️ صفر ارجاع در src/
```

⚠️ `CONFIRMED` **کلیدهایی که در `.env` نیستند:**
```
SENTRY_DSN   ← 🔴 غایب → SentryFilter غیرفعال
OTP_TTL / OTP_MAX_ATTEMPTS / OTP_LOCK_MINUTES / OTP_COOLDOWN
             ← 🔴 غایب → OTP_CONFIG در auth.service.ts:25 hardcode است
VISITOR1_PHONE / VISITOR2_PHONE
             ← در .env.example هستند ولی در .env نیستند (seed ادمین تستی)
```

⚠️ `CONFIRMED` **کلیدهای `.env.example` که در `.env` نیستند:** `VISITOR1_PHONE`, `VISITOR2_PHONE`
`CONFIRMED` کامنت `.env.example` دربارهٔ آن‌ها:
«فقط برای تست دستی (مثل تست IDOR) — در production خالی بگذارید تا چیزی ساخته نشود»

⚠️ `CONFIRMED` `.env` و `.env.example` **هم‌تراز نیستند** — ۸ کلید در `.env` هست
که در `.env.example` مستند نشده (`MELIPAYAMAK_*`, `*_APP_VERSION`, `EXPO_PUBLIC_API_URL`).

🔴 `CONFIRMED` **`.env` حاوی مقادیر واقعی (secret زنده) است و داخل زیپِ push‌شده به گیت‌هاب قرار دارد.**
`JWT_SECRET` طول ۲۳ و غیر-placeholder است. **باید rotate شود.** → `15-SECURITY.md` §S13.

⚠️ `CONFIRMED` `NODE_ENV=development` است → API فیلد `testCode` را در پاسخ OTP برمی‌گرداند.

### ۶-۲. متغیرهای محیط موبایل
`CONFIRMED` `wholesale-mobile/.env` شامل `EXPO_PUBLIC_API_URL` است.

🔴 `CONFIRMED` **تناقض IP:** `.env` مقدار `10.73.183.83` دارد ولی
`httpClient.ts` یک `DEV_IP = '10.75.109.83'` hardcode دارد. → `17-KNOWN-ISSUES.md`.

---

## 7. تست

### ۷-۱. بک‌اند
`CONFIRMED` config در `package.json` → `jest`:
```json
{
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": {
    "^expo-server-sdk$": "<rootDir>/../test/mocks/expo-server-sdk.mock.ts"
  },
  "testEnvironment": "node"
}
```

| فایل spec | تعداد تست |
|---|---|
| `src/orders/orders.service.spec.ts` (674 خط) | بیشترین |
| `src/auth/auth.service.spec.ts` | — |
| `src/auth/auth.controller.spec.ts` | — |
| `src/prisma/prisma.service.spec.ts` | — |
| **جمع** | **۴ suite / ۱۸ تست — همه pass** |

🔴 `CONFIRMED` **تست e2e وجود ندارد.** `npm run test:e2e` به `./test/jest-e2e.json`
ارجاع می‌دهد که **فایلش وجود ندارد**. دستور شکست می‌خورد.

⚠️ `CONFIRMED` `moduleNameMapper` برای `expo-server-sdk` یک **mock** در
`test/mocks/expo-server-sdk.mock.ts` قرار می‌دهد. اگر آن فایل را حذف کنید تست‌ها می‌شکنند.

### ۷-۲. موبایل
❌ `CONFIRMED` **هیچ تستی ندارد.** `jest` در devDependencies نیست و
هیچ `*.test.tsx` / `*.spec.ts` در `app/` یا `src/` وجود ندارد.

---

## 8. نسخه‌هایی که باید هم‌نسخه بمانند

`INFERRED` (بر اساس قرارداد اکوسیستم، نه بر اساس خطایی که مشاهده شد)

| گروه | چرا |
|---|---|
| `prisma` CLI ↔ `@prisma/client` | هر دو `^5.22.0` — schema generate باید با client بخواند |
| `@nestjs/*` | همه روی `^11` — NestJS بین majorها breaking است |
| `expo` ↔ `react-native` ↔ `react` | SDK 56 ↔ RN 0.85.3 ↔ React 19.2.3 — `npx expo install` را برای ارتقا استفاده کنید |
| `react-native-reanimated` ↔ `react-native-worklets` | Reanimated 4 به worklets نیاز دارد |
| `jest@30` ↔ `ts-jest@29` | ⚠️ الان mismatch است ولی تست‌ها pass می‌شوند |
