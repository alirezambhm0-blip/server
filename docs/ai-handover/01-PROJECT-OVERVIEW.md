# 01 — PROJECT OVERVIEW

## 1. پروژه چیست

`CONFIRMED` **Bonko Market** — یک پلتفرم **عمده‌فروشی B2B** (بنگاه‌به‌بنگاه) فارسی‌زبان
و راست‌به‌چپ (RTL) برای بازار ایران.

نام در کد:
- `main.ts` → Swagger title: **«Bonko Market API»**
- `orders.service.getInvoice` → `seller.name: 'بنکو مارکت'`
- `admin.controller` (چاپ فاکتور) → `settings.STORE_NAME || 'بنکو پخش'`
- `public/admin/index.html` → `<title>پنل مدیریت بنکو مارکت</title>`
- `app/welcome.tsx` → «به بنکو مارکت عمده خوش آمدید»

⚠️ `CONFIRMED` **نام فروشگاه در سه جا متفاوت است** (`بنکو مارکت` / `بنکو پخش` / `بنکو مارکت عمده`).
دو تای آخر از جدول `settings` خوانده می‌شوند و fallback متفاوت دارند.

---

## 2. برای چه کسی است

`CONFIRMED` سه نقش کاربری در سیستم (`enum UserRole` در `schema.prisma`):

| نقش | کیست | چه می‌کند |
|---|---|---|
| **`CUSTOMER`** | فروشگاه‌دار (سوپرمارکت، ابزارفروشی، پوشاک و...) | ثبت‌نام → KYC → خرید عمده |
| **`ADMIN`** | تیم داخلی بنکو | تایید مدارک، مدیریت کاتالوگ، پردازش سفارش، فروش حضوری |
| **`VISITOR`** | ویزیتور (فروشندهٔ حضوری) | ⚠️ **نقش در schema و seed تعریف شده ولی هیچ‌جا چک نمی‌شود** |

`CONFIRMED` **`VISITOR` عملاً تزئینی است.** `grep -rn "VISITOR" src` در بک‌اند فقط یک نتیجه دارد:
`admin.controller.ts:434` → `settings.VISITOR_PHONE` (که مربوط به چاپ فاکتور است، نه نقش).
هیچ `@Roles(UserRole.VISITOR)` در کل پروژه وجود ندارد.

---

## 3. دامنهٔ کسب‌وکار (Business Domain)

### ۳-۱. جریان اصلی ارزش
```
فروشگاه‌دار ثبت‌نام می‌کند (OTP)
        ↓
مدارک KYC می‌فرستد (کارت ملی، پروانه کسب، سلفی، نمای فروشگاه)
        ↓
ادمین دستی بررسی و تایید می‌کند       ← ⚠️ هیچ اتوماسیونی وجود ندارد
        ↓
قیمت‌های عمده برای او قابل مشاهده می‌شود
        ↓
سفارش می‌دهد (سبد خرید)
        ↓
پرداخت درب محل (COD) — تنها روش پرداخت پیاده‌سازی‌شده
        ↓
ادمین وضعیت را جلو می‌برد: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
        ↓
`DELIVERED` شدن → `paymentStatus` خودکار `PAID` می‌شود
```

### ۳-۲. 🔒 قانون مرکزی کسب‌وکار: قیمت پنهان
`CONFIRMED` قیمت‌های عمده **فقط برای مشتریان `APPROVED`** نمایش داده می‌شود.
این یک نیازمندی محصول است، نه یک جزئیات UI.

پیاده‌سازی فعلی (`src/components/product/PriceBox.tsx`):
| وضعیت کاربر | چه می‌بیند |
|---|---|
| مهمان / لاگین‌نکرده | «برای مشاهده قیمت وارد حساب شوید» |
| لاگین‌شده ولی تاییدنشده | «تماس برای تایید حساب» |
| `APPROVED` | قیمت واقعی + قیمت قدیم + درصد تخفیف |

⚠️ `CONFIRMED` **این قانون فقط سمت UI اجرا می‌شود.** `GET /products` بدون توکن هم
فیلد `price` را برمی‌گرداند. → `15-SECURITY.md` §S3.

### ۳-۳. 🔒 محدودیت جغرافیایی
`CONFIRMED` خدمات فقط در:
- **استان:** `زنجان` — با `@Equals('زنجان')`
- **شهرها:** `ابهر`, `خرمدره`, `هیدج`, `صائین‌قلعه` — با `@IsIn([...])`

محل: `wholesale-api/src/auth/dto/complete-onboarding.dto.ts`
پیام‌های خطا: «خدمات‌رسانی فعلاً فقط در استان زنجان فعال است» /
«شهر انتخاب شده خارج از محدوده پوشش‌دهی لجیستیک ماست»

⚠️ **این یک قانون کسب‌وکاری سخت‌کدشده در DTO است، نه در config.**
اضافه‌کردن یک شهر = تغییر کد + تست.

### ۳-۴. پرداخت
`CONFIRMED` enum `PaymentMethod` در schema چهار مقدار دارد:
```
CASH_ON_DELIVERY · CARD_TO_CARD · ZARRINPAL · ZIBAL
```
اما **فقط `CASH_ON_DELIVERY` در کد استفاده می‌شود** (در هر سه مسیر ساخت سفارش:
`createFromCart`, `createAdminOrder`, `createVisitorOrder`).
هیچ integration با زرین‌پال یا زیبال وجود ندارد.

⚠️ `CONFIRMED` **`src/constants/enums.ts` در موبایل `CASH_ON_DELIVERY` را ندارد!**
فقط `{CARD_TO_CARD, ZARRINPAL, ZIBAL}`. یعنی تنها روش پرداخت واقعی در enum موبایل غایب است.

### ۳-۵. فروش حضوری (Visitor Sales)
`CONFIRMED` یک جریان موازی برای ثبت سفارش حضوری توسط ویزیتور وجود دارد:
- مسیر API: `POST /visitor/orders` (در `visitor-sales.controller.ts`)
- مسیر UI: پنل ادمین → تب «فروش حضوری 🛍» (`public/admin/visitor-sales.js`, 469 خط)
- `orderSource: 'VISITOR_IN_PERSON'` + `placedByUserId` + `placedByName` + `visitorNote`

⚠️ `CONFIRMED` **این endpoint هیچ `RolesGuard` ندارد** → `15-SECURITY.md` §S4.

### ۳-۶. سفارش مهمان (Guest Orders)
`CONFIRMED` در سطح **دیتابیس** پشتیبانی می‌شود: `Order.customerId` قابل null است
و `guestName`/`guestPhone` وجود دارند (migration `20260727171318_enable_guest_orders`).
در `createAdminOrder` هم پیاده‌سازی شده.

⚠️ `CONFIRMED` ولی در **اپ موبایل**، «مهمان» یعنی «کاربر لاگین‌نکرده که فقط مرور می‌کند» —
**نمی‌تواند سفارش بدهد.** `CartContext.addToCart` → `{ok:false, message:'برای افزودن به سبد باید وارد شوید'}`.

> پس دو معنای متفاوت از «مهمان» در پروژه وجود دارد. اشتباه نگیرید.

---

## 4. سه بخش سیستم

### ۴-۱. API — `wholesale-api/`
`CONFIRMED`
- **NestJS 11** با لایه‌بندی استاندارد `module → controller → service → dto`
- **۱۱۷ endpoint** در ۱۵ controller
- **Prisma 5.22 + PostgreSQL** — ۲۲ مدل، ۱۲ enum، ۱۶ migration
- **بدون لایهٔ Repository** — سرویس‌ها مستقیماً `this.prisma.<model>` را صدا می‌زنند
- منبع حقیقت داده و منطق کسب‌وکار

### ۴-۲. Mobile — `wholesale-mobile/`
`CONFIRMED`
- **Expo SDK 56 + expo-router** (file-based routing)
- **۳۳ فایل `.tsx`** در `app/` = **۲۸ route واقعی** + ۵ `_layout.tsx`
  (پیش از حذف `checkout.tsx` در P2: ۳۴ فایل / ۲۹ route)
- خروجی **Android / iOS / Web** (با `react-native-web`)
- OTA با **EAS Update**
- State با **۳ React Context** (بدون Redux)

### ۴-۳. Admin Panel — `wholesale-api/public/admin/`
`CONFIRMED`
- **Vanilla JS**، بدون framework، **بدون build step**
- **۳٬۸۲۷ خط** در ۵ فایل JS + ۱ CSS + ۱ HTML
- از همان API بک‌اند استفاده می‌کند (endpoint ادمین جدا ندارد)
- **۱۱ view**: dashboard · customers · orders · visitor-sales · products ·
  categories · banners · tickets · notifications · security · settings
- لاگینش **همان** OTP ورود مشتریان است (فقط با شمارهٔ ادمین)

⚠️ `CONFIRMED` **پنل ادمین هیچ build/bundle ندارد** — مستقیماً با
`useStaticAssets(public/admin, {prefix:'/admin'})` سرو می‌شود.

---

## 5. حجم کد

`CONFIRMED` (از `wc -l`)

| بخش | خط |
|---|---|
| `wholesale-api/src/**.ts` | **7,964** |
| `wholesale-mobile/{app,src}/**.{ts,tsx}` | **13,514** |
| `wholesale-api/public/admin/**` | **3,827** |
| **جمع** | **~25,300** |

### بزرگ‌ترین فایل‌های بک‌اند
```
760  src/orders/orders.service.ts
674  src/orders/orders.service.spec.ts
648  src/admin/admin.controller.ts
599  src/auth/auth.service.ts
474  src/products/products.service.ts
418  src/admin/admin.service.ts
313  src/visitor-sales/visitor-sales.service.ts
276  src/auth/dto/complete-onboarding.dto.ts
264  src/notifications/notifications.service.ts
261  src/cart/cart.service.ts
252  src/search/search.service.ts
```

### بزرگ‌ترین فایل‌های موبایل
```
988  app/product-detail.tsx
798  app/onboarding.tsx
748  app/(tabs)/cart.tsx
714  app/(tabs)/home.tsx
564  app/(tabs)/browse.tsx
517  src/components/product/ProductCard.tsx
412  app/(tabs)/profile.tsx
352  src/api/httpClient.ts
326  src/storage/authStorage.ts
```

---

## 6. چه چیزهایی در دامنهٔ این پروژه **نیست**

`CONFIRMED` مواردی که در schema/config تعریف شده ولی **پیاده‌سازی ندارند**:

| مورد | وضعیت |
|---|---|
| پرداخت آنلاین (زرین‌پال / زیبال / کارت‌به‌کارت) | ❌ فقط enum وجود دارد |
| هزینهٔ ارسال | ❌ `shippingAmount` در schema هست ولی هرگز ست نمی‌شود؛ `FREE_SHIPPING_MIN_AMOUNT` صفر ارجاع |
| حداقل مبلغ سفارش | ❌ `MIN_ORDER_AMOUNT` صفر ارجاع در کد |
| محافظت در برابر double-submit | ❌ `idempotencyKey` در schema هست ولی نه ست می‌شود نه ارسال |
| صفحهٔ علاقه‌مندی‌ها | ⚠️ `app/(profile)/favorites.tsx` یک **stub** است (فقط متن ثابت) |
| تنظیمات اعلان‌ها | ⚠️ `app/(profile)/notification-settings.tsx` یک **stub** است (بدون persistence) |
| Deep link نوتیفیکیشن | ❌ `src/utils/notificationRouting.ts` هرگز import نشده |
| به‌روزرسانی اجباری | ❌ `useForceUpdate` در `_layout.tsx` فقط import شده، صدا زده نمی‌شود |
| Rate limiting سراسری | ❌ `ThrottlerModule` ثبت شده ولی `ThrottlerGuard` اعمال نشده |
| آنالیتیکس جستجو برای ادمین | ❌ `SearchService.getAnalytics` یک stub با `// TODO` است |
| تست e2e | ❌ `test/jest-e2e.json` وجود ندارد |
| تست موبایل | ❌ jest در devDependencies موبایل نیست |

---

## 7. زبان و بومی‌سازی

`CONFIRMED`
- **همهٔ متن‌های user-facing فارسی** هستند (API error messages، UI، پنل ادمین)
- **RTL** — `dir="rtl"` در پنل ادمین، `flexDirection: 'row-reverse'` در موبایل
- **فونت Vazirmatn** در ۶ وزن (`src/assets/fonts/*.ttf`)
- **اعداد فارسی** — `fa()` / `toFa()` در بک‌اند، `toLocaleString("fa-IR")` در موبایل
- **تاریخ شمسی** — `new Intl.DateTimeFormat('fa-IR')`
- **نرمال‌سازی فارسی برای جستجو** — `common/utils/normalization.ts` → `normalizePersian()`
  (ی/ک عربی→فارسی، حذف اعراب، نیم‌فاصله→فاصله، اعداد فارسی/عربی→لاتین)

⚠️ `CONFIRMED` `normalizePersian` یک رفتار بحث‌برانگیز دارد:
```ts
normalized = normalized.replace(/\u064B/g, '\u06CC'); // ئ -> ی (تقریبی برای جست‌وجو)
```
کامنت خود کد می‌گوید «تقریبی». ضمناً `\u064B` در واقع **فتحه (اعراب)** است نه «ئ» —
`INFERRED` این یک اشتباه در کامنت/کد است که با `replace(/[\u064B-\u065F...]/g,'')` در مرحلهٔ ۳
هم‌پوشانی دارد.

---

## 8. وضعیت بلوغ پروژه

`INFERRED` بر اساس شواهد کد و تاریخچهٔ گیت:

| جنبه | وضعیت |
|---|---|
| معماری بک‌اند | ✅ تمیز و استاندارد NestJS |
| تست بک‌اند | 🟡 ۱۸ تست unit، **بدون e2e** |
| تست موبایل | ❌ ندارد |
| Type safety | ✅ بک‌اند eslint 0/0 · موبایل tsc 0 خطا |
| مستندات | 🟡 این مجموعه (بازنویسی‌شده) |
| امنیت | 🔴 ۵ مسئلهٔ بحرانی باز |
| آمادگی production | 🔴 **خیر** — به `17-KNOWN-ISSUES.md` مراجعه کنید |
| CI/CD | ❌ **NOT FOUND** — هیچ workflow گیت‌هابی در snapshot نیست |

⚠️ `CONFIRMED` لاگ گیت ادعای «Phase 6 Complete / Release Readiness» دارد،
ولی ۵ یافتهٔ امنیتی بحرانی و نبود `assets/` با آن سازگار نیست.
