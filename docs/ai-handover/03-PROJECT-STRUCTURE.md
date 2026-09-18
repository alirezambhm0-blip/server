# 03 — PROJECT STRUCTURE

> این نقشه با `find` روی درخت واقعی فایل‌ها ساخته شده (`CONFIRMED`).
> فایل‌هایی که در این snapshot وجود ندارند ولی در گیت HEAD هستند، جدا مشخص شده‌اند.

---

## 1. سطح بالا

```
project/src/                         ← ریشهٔ واقعی پروژه
├── .git/                            ← ریپازیتوری اصلی پروژه (۵۹ کامیت، ۳۱۰ فایل)
├── .gitignore
├── .expo/                           ← cache ابزار Expo (shipped در زیپ)
├── docker-compose.yml               ← PostgreSQL 16 + pgAdmin
├── package.json                     ← ⚠️ فقط { devDependencies: { @expo/ngrok } }
├── package-lock.json
├── docs/
│   └── ai-handover/                 ← 📍 همین مستندات (شما اینجا هستید)
├── wholesale-api/                   ← بک‌اند NestJS
└── wholesale-mobile/                ← اپ Expo
```

⚠️ `CONFIRMED` **`package.json` ریشه فقط `@expo/ngrok` دارد** — هیچ اسکریپتی ندارد.
این یک monorepo واقعی (npm workspaces / turborepo / lerna) **نیست**.
هر زیرپروژه `package.json` و `node_modules` و `package-lock.json` **مستقل** دارد.

> **پیامد عملی:** دستورات باید **داخل هر پوشه** اجرا شوند:
> ```bash
> cd wholesale-api && npm test
> cd wholesale-mobile && npx tsc --noEmit
> ```
> هیچ `npm run` در ریشه کار نمی‌کند.

---

## 2. بک‌اند — `wholesale-api/`

```
wholesale-api/
├── package.json                     ← scripts + jest config + prisma seed config
├── package-lock.json
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs                ← ESLint 9 flat config
├── .env                             ← 🔴 حاوی secret زنده — gitignore شده، هرگز commit نکنید
├── .env.example                     ← ✅ الگو (در گیت track شده) — فقط نام کلیدها
├── .env.test                        ← ✅ تنظیمات تست (در گیت track شده)
├── node_modules/                    ← (محلی، در گیت نیست)
├── dist/                            ← (محلی، خروجی build)
├── uploads/                         ← (runtime — تصویرهای آپلودشده)
├── backups/                         ← (runtime — خروجی cron بکاپ)
│
├── prisma/
│   ├── schema.prisma                ← ⭐ ۲۲ مدل، ۱۲ enum
│   ├── seed.ts                      ← ساخت ادمین اولیه + دسته‌بندی‌ها
│   └── migrations/                  ← ۱۶ دایرکتوری migration
│
├── public/
│   └── admin/                       ← پنل ادمین (Vanilla JS)
│       ├── index.html               ← تک‌صفحه، ۱۱ view
│       ├── styles.css
│       ├── core.js                  ← ⭐ http، auth، toast، helpers (اول لود می‌شود)
│       ├── orders.js                ← view سفارش‌ها + فاکتور
│       ├── products.js              ← view محصولات + دسته‌بندی + بنر
│       ├── visitor-sales.js         ← view فروش حضوری
│       └── app.js                   ← ⭐ router + layout + bootstrap (آخر لود می‌شود)
│
├── scripts/
│   └── migrate-kyc.ts               ← اسکریپت یک‌بارمصرف انتقال دادهٔ KYC
│
├── test/
│   └── mocks/
│       └── expo-server-sdk.mock.ts  ← mock برای jest (moduleNameMapper)
│
└── src/                             ← ⭐ کد اصلی (۷,۹۶۴ خط)
```

⚠️ `CONFIRMED` **`test/jest-e2e.json` وجود ندارد** — پس `npm run test:e2e` شکست می‌خورد.

### ۲-۱. ماژول‌های `src/` — ۱۷ ماژول NestJS + ۱ دایرکتوری مشترک

`CONFIRMED` شمارش دقیق:
```
۱۷ فایل *.module.ts (به‌جز app.module.ts)  → ۱۷ ماژول دامنه
+ src/common/  → دایرکتوری ابزار مشترک (ماژول نیست، .module.ts ندارد)
= ۱۸ دایرکتوری زیر src/
```
`CONFIRMED` `app.module.ts` این‌ها را import می‌کند:
- **۱۷ ماژول دامنه** (`PrismaModule` … `VisitorSalesModule`)
- **۴ ماژول زیرساختی** با `.forRoot()`: `ConfigModule`, `ThrottlerModule`, `ScheduleModule`, `EventEmitterModule`

| دایرکتوری | فایل‌ها | نقش |
|---|---|---|
| `src/main.ts` | ۱ فایل | bootstrap — Sentry، Swagger، CORS، ValidationPipe، static |
| `src/app.module.ts` | ۱ فایل | ریشهٔ همهٔ ماژول‌ها |
| `src/prisma/` | `prisma.module`, `prisma.service`, `.spec` | `@Global` — اتصال DB |
| `src/auth/` | controller, service, module, 2 spec, `dto/`(5), guards(3), strategy, decorators(2) | OTP + JWT + KYC |
| `src/admin/` | controller (648 خط), service (418), module | **۴۲ endpoint ادمین** |
| `src/orders/` | controller, service (760), module, spec (674) | منطق سفارش |
| `src/products/` | controller, `favorites.controller`, service, module, `dto/`(2) | کاتالوگ + علاقه‌مندی |
| `src/cart/` | controller, service (261), module, `dto/`(3) | سبد خرید سمت سرور |
| `src/categories/` | controller, service, module, `dto/`(2) | دسته‌بندی‌ها |
| `src/search/` | controller, service (252), module | جستجوی نرمال‌شده + suggest |
| `src/notifications/` | controller, service, module, **2 listener**, `dto/`, `events/`, `constants/` | push + in-app |
| `src/files/` | controller, service, module | آپلود/حذف فایل |
| `src/banners/` | controller, service, module | بنرهای صفحه اصلی |
| `src/tickets/` | controller, service, module, `dto/` | تیکت پشتیبانی |
| `src/profile/` | controller, service, module | پروفایل کاربر (بدون DTO!) |
| `src/visitor-sales/` | controller, service (313), module | فروش حضوری |
| `src/app-version/` | controller, service, module | بررسی نسخهٔ اپ / force update |
| `src/backup/` | service, module (بدون controller) | `@Cron` بکاپ DB |
| `src/sms/` | service, module (بدون controller) | ملی‌پیامک از طریق SOAP |
| `src/common/` | `sentry.filter`, `too-many-requests.exception`, `utils/normalization` | ابزار مشترک |

### ۲-۲. فایل‌های auth به تفکیک

```
src/auth/
├── auth.controller.ts        ← 9 endpoint (احراز هویت + پروفایل)
├── auth.service.ts (599)     ← OTP، verify، JWT، onboarding
├── auth.module.ts            ← forwardRef با AdminModule
├── auth.service.spec.ts
├── auth.controller.spec.ts
├── get-user.decorator.ts     ← @GetUser()
├── jwt-auth.guard.ts         ← AuthGuard('jwt')
├── optional-jwt-auth.guard.ts← توکن اختیاری (برای guest browse)
├── jwt.strategy.ts           ← هر request به DB می‌زند
├── roles.decorator.ts        ← @Roles(...)
├── roles.guard.ts            ← RolesGuard
└── dto/
    ├── request-otp.dto.ts
    ├── verify-otp.dto.ts
    ├── complete-onboarding.dto.ts (276)  ← ⭐ KYC + محدودیت جغرافیایی
    ├── update-profile.dto.ts
    └── sensitive-change.dto.ts
```

---

## 3. موبایل — `wholesale-mobile/`

```
wholesale-mobile/
├── package.json
├── package-lock.json
├── app.json                   ← ⭐ تنظیمات Expo/EAS
├── babel.config.js            ← alias @/
├── metro.config.js
├── tsconfig.json
├── eslint.config.js
├── .env                       ← EXPO_PUBLIC_API_URL
├── .expo/
├── node_modules/
│
├── assets/                    ← ✅ موجود (۲۹ فایل: ۶ فونت Vazirmatn + icon/splash/tabIcons)
│
├── app/                       ← ⭐ routeها (expo-router)
│   ├── _layout.tsx            ← root: Sentry.wrap، فونت، SafeArea، guard
│   ├── index.tsx              ← redirect اولیه بر اساس وضعیت
│   ├── welcome.tsx            ← صفحه خوش‌آمد
│   ├── product-detail.tsx (988)
│   ├── onboarding.tsx (798)   ← فرم KYC چندمرحله‌ای
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── otp.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx        ← tab bar
│   │   ├── home.tsx (714)
│   │   ├── browse.tsx (564)
│   │   ├── cart.tsx (748)     ← ⭐ ثبت سفارش واقعی اینجا
│   │   ├── orders.tsx
│   │   └── profile.tsx (412)
│   └── (profile)/
│       ├── favorites.tsx              ← ⚠️ stub
│       ├── notification-settings.tsx  ← ⚠️ stub
│       ├── info-about.tsx
│       ├── info-faq.tsx
│       ├── info-guide.tsx
│       ├── info-privacy.tsx
│       └── info-terms.tsx
│
└── src/                       ← ⭐ کد غیر-route (۵,۸۰۱ خط)
    ├── global.css                   ← ⚠️ CSS در پروژهٔ RN (برای web)
    │
    ├── api/                         ← ۱۲ فایل
    │   ├── httpClient.ts (352)      ← ⭐ axios + interceptor + baseURL
    │   ├── authApi.ts               ├── kycApi.ts
    │   ├── productsApi.ts (193)     ├── onboardingApi.ts
    │   ├── ordersApi.ts (106)       ├── profileApi.ts
    │   ├── cartApi.ts (101)         ├── searchApi.ts
    │   ├── bannersApi.ts            ├── ticketsApi.ts
    │   └── notificationsApi.ts
    │
    ├── context/                     ← ۳ Context (بدون Redux)
    │   ├── AuthContext.tsx (272)    ← ⭐ authStatus + customer + token
    │   ├── CartContext.tsx (303)    ← ⭐ optimistic + ref-based
    │   └── FavoritesContext.tsx (72)
    │
    ├── components/
    │   ├── product/
    │   │   ├── ProductCard.tsx (517)     ← ⭐ بزرگ‌ترین کامپوننت
    │   │   ├── ProductRowCard.tsx (324)
    │   │   ├── PriceBox.tsx (159)        ← ⭐ سه حالت قیمت
    │   │   ├── ProductCardSkeleton.tsx (109)
    │   │   └── ItemsPerPackageBadge.tsx (75)
    │   ├── search/
    │   │   ├── search.tsx (226)          ← کامپوننت اصلی
    │   │   ├── SearchSuggestions.tsx (117)
    │   │   ├── SearchInput.tsx (88)
    │   │   ├── SearchHistory.tsx (65)
    │   │   ├── SearchPopular.tsx · SearchEmpty.tsx
    │   │   └── index.ts                  ← barrel export
    │   ├── ui/
    │   │   ├── Button.tsx · Stepper.tsx · Skeleton.tsx
    │   │   ├── LoadingState.tsx · EmptyState.tsx · ErrorState.tsx
    │   │   ├── ErrorBoundary.tsx         ← 🔴 IP hardcode + catch {} خالی
    │   │   ├── GuestGuard.tsx (68)       ← ⭐ محافظ مهمان
    │   │   ├── OfflineBanner.tsx (65)
    │   │   └── collapsible.tsx
    │   ├── onboarding/
    │   │   └── ImageUploadField.tsx (324) ← ⭐ آپلود ۴ مدرک
    │   └── (ریشهٔ components/)
    │       ├── PriceDisplay.tsx          ← ⚠️ رقیب PriceBox!
    │       ├── animated-icon.tsx + animated-icon.web.tsx + .module.css
    │       ├── app-tabs.tsx + app-tabs.web.tsx
    │       ├── themed-text.tsx · themed-view.tsx
    │       ├── external-link.tsx · hint-row.tsx · web-badge.tsx
    │
    ├── hooks/
    │   ├── use-color-scheme.ts + use-color-scheme.web.ts
    │   ├── use-theme.ts
    │   └── useForceUpdate.ts        ← ⚠️ فقط import شده، صدا زده نمی‌شود
    │
    ├── constants/
    │   ├── theme.ts (79)            ← ⭐ COLORS + FONTS (یکی از ۳ پالت!)
    │   ├── enums.ts (86)            ← ⚠️ CASH_ON_DELIVERY را ندارد
    │   └── customerStatus.ts        ← ⭐ «منبع واحد enum» طبق کامنت AuthContext
    │
    ├── utils/
    │   ├── fonts.ts                 ← ⚠️ FONTS دوم (با theme.ts متفاوت)
    │   ├── format.ts
    │   ├── normalization.ts         ← ⚠️ هم‌نام با بک‌اند ولی جدا
    │   ├── notify.ts
    │   └── notificationRouting.ts   ← 🔴 هرگز import نشده
    │
    ├── storage/
    │   ├── authStorage.ts (326)     ← ⭐ SecureStore + AsyncStorage
    │   └── cartStorage.ts           ← سبد مهمان
    │
    ├── types/
    │   ├── product.ts · cart.ts · notification.ts · ticket.ts
    │
    └── assets/
        └── fonts/                   ← ✅ ۶ فایل Vazirmatn (.ttf)
```

⚠️ `CONFIRMED` **پسوند `.web.tsx` = نسخهٔ مخصوص وب.** Metro به‌صورت خودکار
برای پلتفرم وب آن را انتخاب می‌کند. جفت‌ها:
`animated-icon` · `app-tabs` · `use-color-scheme`
> اگر یکی را تغییر دهید، **هر دو** را به‌روز کنید.

### ۳-۱. alias `@/`
`CONFIRMED` در `babel.config.js` (plugin `module-resolver`) و `tsconfig.json` (`paths`) تعریف شده
و به `./src` نگاشت می‌شود. پس `@/api/httpClient` = `src/api/httpClient.ts`.

⚠️ `CONFIRMED` **هر دو جا باید همگام بمانند.** اگر فقط یکی را تغییر دهید،
`tsc` pass می‌شود ولی Metro در runtime شکست می‌خورد (یا برعکس).

### ۳-۲. route group ها
`CONFIRMED` سه group:
- `(auth)` — login، otp
- `(tabs)` — پنج تب اصلی
- `(profile)` — صفحات پروفایل و اطلاعات

⚠️ `CONFIRMED` **`product-detail.tsx` و `onboarding.tsx` در `app/` ریشه‌اند**،
نه داخل هیچ group. یعنی خارج از stack هر دو group قرار دارند.

✅ **به‌روزرسانی (P2):** `checkout.tsx` که قبلاً در همین فهرست بود **حذف شد**
(route یتیم بود). جزئیات: `17` §B21.

### ۳-۳. 🔴 مشکل `assets/`
```
کد می‌خواهد:                              واقعاً هست:
wholesale-mobile/assets/fonts/*.ttf    →  wholesale-mobile/src/assets/fonts/*.ttf
wholesale-mobile/assets/images/*.png   →  ❌ هیچ‌جا نیست
```
`CONFIRMED` ارجاع‌ها:
- `app/_layout.tsx:110-115` → `../assets/fonts/Vazirmatn-*.ttf`
- `app/welcome.tsx:47` → `../assets/images/expo-logo.png`
- `src/components/**/LoadingState.tsx` → `../../../assets/images/react-logo.png`
- `src/components/**` → `@/assets/images/*` (logo-glow و ...)
- `app.json` → `./assets/images/icon.png`, `splash-icon.png`, `android-icon-*.png`, `favicon.png`

`CONFIRMED` `git check-ignore -v assets` → **not ignored**. یعنی عمداً حذف نشده؛ هرگز add نشده.

---

## 4. پنل ادمین — ترتیب لود (مهم)

`CONFIRMED` از `public/admin/index.html` — اسکریپت‌ها **بدون `type="module"`**،
پس **ترتیب `<script>` مهم است**:

```html
<script src="core.js"></script>            ← 1. http()، auth، toast، helpers
<script src="orders.js"></script>          ← 2.
<script src="products.js"></script>        ← 3.
<script src="visitor-sales.js"></script>   ← 4.
<script src="app.js"></script>             ← 5. router + bootstrap
```

> **قاعده:** هر فایل JS یک یا چند **global function** روی `window` تعریف می‌کند
> و `app.js` آن‌ها را صدا می‌زند. اگر فایل جدیدی اضافه می‌کنید،
> باید **قبل از `app.js`** در `index.html` بیاید.

### view های پنل (۱۱ تا)
`CONFIRMED` از `renderLayout` در `app.js`:
```
dashboard · customers · orders · visitor-sales · products ·
categories · banners · tickets · notifications · security · settings
```

---

## 5. فایل‌هایی که در HEAD هستند ولی در این snapshot نیستند

`CONFIRMED` ۶۴ فایل در کامیت HEAD گیت هستند ولی روی دیسک نیستند. مهم‌ترین‌ها:

### مستندات ریشه (همه غایب)
```
README.md                ARCHITECTURE.md          CLAUDE.md
RELEASE-PROGRESS.md      RELEASE-CHECKLIST.md     OTA-GUIDE.md
PERFORMANCE.md           WSL2-LOCAL-BUILD.md      SECURITY-*.md
CONTINUATION-PROMPT.md   (و بقیه *.md)
```
`CONFIRMED` نسخهٔ قبلی همین مستندات به این فایل‌ها ارجاع می‌داد — **آن ارجاع‌ها بی‌اعتبارند.**

### بسته‌های انتشار و اسکریپت‌ها (همه غایب)
```
apply-package*.zip       verified-manifest.txt
run-*.cmd                test-*.ps1        test-*.sh
```

> **بازیابی:** `git show HEAD:<path>` از داخل `src/`.

---

## 6. فایل‌هایی که باید با احتیاط ویژه رفتار کنید

| فایل | چرا |
|---|---|
| `wholesale-api/.env` | 🔴 secret زنده — کاربر گفته دست نزنید |
| `wholesale-api/prisma/schema.prisma` | هر تغییر = migration + احتمال از دست رفتن داده |
| `wholesale-api/src/orders/orders.service.ts` | پیچیده‌ترین منطق؛ ۷۶۰ خط؛ ۶۷۴ خط تست به آن وابسته |
| `wholesale-api/src/auth/auth.service.ts` | OTP + KYC + JWT در یک فایل ۵۹۹ خطی |
| `wholesale-api/src/admin/admin.controller.ts` | ۴۲ endpoint در یک controller |
| `wholesale-mobile/app/_layout.tsx` | فونت + Sentry + SafeArea + redirect؛ تغییرش همهٔ اپ را تحت تأثیر می‌گذارد |
| `wholesale-mobile/src/api/httpClient.ts` | همهٔ درخواست‌های موبایل از اینجا می‌گذرند |
| `wholesale-mobile/src/context/CartContext.tsx` | الگوی `ref` عمدی — «تمیزش» نکنید |
| `wholesale-api/public/admin/index.html` | ترتیب `<script>` حساس است |

---

## 7. آنچه در ساختار **نیست**

`CONFIRMED` الگوهایی که در این پروژه عمداً یا اتفاقاً وجود ندارند:

| چیز | وضعیت |
|---|---|
| لایهٔ Repository | ❌ سرویس‌ها مستقیم `this.prisma.<model>` |
| `common/filters/`, `common/interceptors/`, `common/pipes/` | ❌ فقط ۲ فایل + `utils/` |
| `health` module | ❌ NOT FOUND |
| `.github/workflows/` | ❌ NOT FOUND |
| `Dockerfile` (برای API) | ❌ NOT FOUND (فقط `docker-compose.yml` برای Postgres) |
| `eas.json` | ✅ موجود (۳۶۷ بایت، tracked از `4b8a847`) — پروفایل‌های `development`/`preview`/`production` |
| تست موبایل | ❌ NOT FOUND |
| `wholesale-mobile/assets/` | ✅ موجود — ۲۹ فایل / ۲٫۲ MB (از `github.com/alirezambhm0-blip/assets` — `B26` رفع شد) |
