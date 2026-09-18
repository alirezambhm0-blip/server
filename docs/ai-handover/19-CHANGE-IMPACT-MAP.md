# 19 — CHANGE IMPACT MAP

> **قبل از هر تغییر، این فایل را برای فایلی که می‌خواهید دست بزنید چک کنید.**
>
> قالب: فایل → چه چیزی می‌شکند → چه چیزی را باید هم‌زمان عوض کنید → چگونه verify کنید.

---

## 1. 🔴 سطح خطر — طبقه‌بندی کلی

| سطح | معنی | نمونه |
|---|---|---|
| 🔴 **قرمز** | کل سیستم را تحت تأثیر می‌گذارد | `schema.prisma`, `main.ts`, `httpClient.ts`, `_layout.tsx` |
| 🟠 **نارنجی** | یک دامنهٔ کامل را تحت تأثیر می‌گذارد | `orders.service.ts`, `AuthContext.tsx`, `core.js` |
| 🟡 **زرد** | یک صفحه یا ماژول | `browse.tsx`, `banners.service.ts` |
| 🟢 **سبز** | ایزوله | `info-terms.tsx`, `ItemsPerPackageBadge.tsx` |

---

## 2. 🔴 فایل‌های سطح قرمز

### `wholesale-api/prisma/schema.prisma`
```
می‌شکند:  همهٔ ۱۷ ماژول بک‌اند · همهٔ ۱۶ migration · تایپ‌های موبایل
باید هم‌زمان عوض شود:
   • prisma/migrations/  (migrate dev)
   • DTOهای بک‌اند
   • wholesale-mobile/src/types/{product,cart,notification,ticket}.ts
   • public/admin/*.js (اگر فیلد در UI ادمین نمایش داده می‌شود)
verify:
   npx prisma validate
   npx prisma generate
   npm run build && npm test
   ⚠️ روی یک کپی از دادهٔ واقعی migrate deploy را تست کنید
تله‌ها:
   • سه دایرکتوری *_init وجود دارد — migrate reset نکنید
   • naming ناهمگون (snake/camel) — @map را بدون migration دستی تغییر ندهید
   • npx prisma format فایل را بازنویسی می‌کند — اجرا نکنید
```

### `wholesale-api/src/main.ts`
```
می‌شکند:  CORS (وب + موبایل) · دسترسی /docs · سرو /admin · ValidationPipe · Sentry
باید هم‌زمان عوض شود:
   • اگر prefix اضافه می‌کنید → همهٔ *Api.ts موبایل + core.js ادمین
   • اگر CORS_ORIGINS عوض می‌شود → .env
verify:  npm run build && npm test
         سپس دستی: curl /admin ، curl /docs (باید 404 از غیر-localhost)
تله‌ها:
   • app.listen(port, '0.0.0.0') را به 127.0.0.1 تغییر ندهید — preview می‌شکند
   • helmet/compression اضافه نکنید بدون تست
   • ترتیب middleware مهم است: static قبل از routeها
```

### `wholesale-api/src/app.module.ts`
```
می‌شکند:  🔴 ترتیب ثبت routeها → تعارض مسیرها
باید هم‌زمان عوض شود:  —
verify:  npm run build
         سپس دستی probe کنید:
           GET /admin/customers/search با توکن CUSTOMER → باید 403 بدهد
تله‌ها:
   • VisitorSalesModule باید بعد از AdminModule بماند (B20)
   • forwardRef در AdminModule را حذف نکنید
   • ThrottlerModule را بدون افزودن ThrottlerGuard حذف/اضافه نکنید
```

### `wholesale-mobile/src/api/httpClient.ts`
```
می‌شکند:  🔴 همهٔ درخواست‌های اپ موبایل
باید هم‌زمان عوض شود:  —
verify:  npx tsc --noEmit && npx expo lint
         سپس دستی: لاگین، بارگذاری home، افزودن به سبد
تله‌ها:
   • DEV_IP = 10.75.109.83 با .env (10.73.183.83) نمی‌خواند — دست نزنید
   • Platform.OS === 'web' همیشه localhost:3000 است
   • interceptor 401 → logout را نشکنید
```

### `wholesale-mobile/app/_layout.tsx`
```
می‌شکند:  🔴 فونت · Sentry · SafeArea · redirect · کل navigation
باید هم‌زمان عوض شود:  —
verify:  npx tsc --noEmit && npx expo lint
         ⚠️ lint این فایل را کامل verify نمی‌کند — باید اپ را اجرا کنید
تله‌ها:
   • require("../assets/fonts/...") مسیرش خراب است (B26) — «درستش» نکنید بدون تأیید
   • lastRedirectRef را حذف نکنید — حلقهٔ redirect بی‌پایان
   • ترتیب providerها: Auth → Cart → Favorites
   • FontApplied روی defaultProps در React 19 منسوخ است
   • export default Sentry.wrap(RootLayout) است — orders.tsx به آن import مرده دارد
```

### `wholesale-api/public/admin/index.html`
```
می‌شکند:  🔴 کل پنل ادمین (ReferenceError در app.js)
باید هم‌زمان عوض شود:  اگر فایل JS جدیدی اضافه می‌کنید
verify:  بازکردن /admin در مرورگر + کنسول را چک کنید
تله‌ها:
   • ترتیب <script>: core → orders → products → visitor-sales → app
   • type="module" اضافه نکنید — globalها می‌شکنند
   • dir="rtl" و lang="fa" را حذف نکنید
```

---

## 3. 🟠 فایل‌های سطح نارنجی

### `wholesale-api/src/orders/orders.service.ts` (760 خط)
```
می‌شکند:  ثبت سفارش · لغو · فاکتور · لیست سفارش‌ها · نوتیفیکیشن سفارش
وابسته:  674 خط تست در orders.service.spec.ts (۱۴ case مسیر پول)
باید هم‌زمان عوض شود:
   • wholesale-mobile/src/api/ordersApi.ts
   • wholesale-mobile/app/(tabs)/cart.tsx (handlePlaceOrder)
   • wholesale-mobile/app/orders/[id].tsx
   • public/admin/orders.js
verify:  npm test  (باید 18/18 بماند) && npm run build
تله‌ها:
   • update شرطی موجودی را به SELECT FOR UPDATE «بهبود» ندهید (Prisma پشتیبانی نمی‌کند)
   • emit رویدادها باید بعد از commit تراکنش بماند
   • mapOrderToResponse را دور نزنید
   • visitor-sales.service.ts منطق جداگانه دارد — هم‌زمان به‌روزش کنید
```

### `wholesale-api/src/auth/auth.service.ts` (599 خط)
```
می‌شکند:  OTP · verify · JWT · onboarding · پروفایل · تغییرات حساس
وابسته:  auth.service.spec.ts + auth.controller.spec.ts
باید هم‌زمان عوض شود:
   • wholesale-mobile/src/api/authApi.ts
   • wholesale-mobile/src/context/AuthContext.tsx
   • wholesale-mobile/app/(auth)/{login,otp}.tsx
   • public/admin/core.js (لاگین پنل)
verify:  npm test && npm run build
تله‌ها:
   • $transaction در verifyOtp هیچ catch ندارد — اگر اضافه می‌کنید، مراقب rollback باشید
   • OTP_CONFIG hardcode است، از .env نمی‌خواند
   • testCode را بدون تأیید حذف نکنید (تست دستی را می‌شکند)
   • ADMIN_PHONE از .env نقش ادمین می‌دهد — منطقش را عوض نکنید
```

### `wholesale-api/src/admin/admin.controller.ts` (648 خط، ۴۲ endpoint)
```
می‌شکند:  کل پنل ادمین
باید هم‌زمان عوض شود:  public/admin/*.js
verify:  npm run build + تست دستی در پنل
تله‌ها:
   • @UseGuards و @Roles سطح کلاس‌اند — روی متدها تکرار نکنید
   • تعارض مسیر با visitor-sales (B20)
```

### `wholesale-mobile/src/context/AuthContext.tsx` (272 خط)
```
می‌شکند:  🔴 همهٔ routeها + CartContext + FavoritesContext
باید هم‌زمان عوض شود:
   • src/storage/authStorage.ts
   • app/_layout.tsx (redirect logic)
   • app/index.tsx (redirect logic)
verify:  npx tsc --noEmit && npx expo lint + تست دستی لاگین/خروج
تله‌ها:
   • authStatus چهار حالت دارد — guest را فراموش نکنید
   • setAuthStatus("authenticated") قبل از getMeApi عمدی است
   • logout عمداً POST /auth/logout را صدا نمی‌زند (B25)
   • ترتیب provider: AuthProvider باید بیرونی‌ترین باشد
```

### `wholesale-mobile/src/context/CartContext.tsx` (303 خط)
```
می‌شکند:  سبد خرید · badge تب · ثبت سفارش
باید هم‌زمان عوض شود:
   • src/types/cart.ts
   • src/api/cartApi.ts (serverCartToLocal)
   • src/storage/cartStorage.ts
verify:  npx tsc --noEmit && npx expo lint + تست دستی add/update/remove
تله‌ها:
   • از itemsRef.current استفاده کنید، نه items
   • taskQueue را حذف نکنید — race condition
   • مسیر حذف (newQty<=0) عمداً rollback ندارد
   • مهمان عمداً سبد ندارد
```

### `wholesale-api/public/admin/core.js`
```
می‌شکند:  همهٔ viewهای پنل (http, auth, toast, fmt, fa)
باید هم‌زمان عوض شود:  orders.js · products.js · visitor-sales.js · app.js
verify:  بازکردن /admin + کنسول
تله‌ها:
   • getAuthToken() عمداً به localStorage fallback می‌کند
   • ترتیب <script> در index.html
```

### `wholesale-api/src/auth/jwt.strategy.ts`
```
می‌شکند:  همهٔ endpointهای محافظت‌شده
باید هم‌زمان عوض شود:  src/auth/get-user.decorator.ts (RequestUser)
verify:  npm run build + تست دستی یک endpoint محافظت‌شده
تله‌ها:
   • هر request یک کوئری DB می‌زند — عمدی است (قطع فوری دسترسی)
   • اگر چک status اضافه می‌کنید، ممکن است جریان onboarding بشکند
```

---

## 4. 🟡 فایل‌های سطح زرد

| فایل | چه چیزی می‌شکند | verify |
|---|---|---|
| `search.service.ts` | نتایج جستجو + suggest | تست دستی با «ابزار» و ي عربی |
| `normalization.ts` | 🔴 دادهٔ **موجود** در `nameNormalized` | نیاز به migration داده |
| `notifications.service.ts` | in-app + push | تست دستی ارسال |
| `notification-templates.ts` | deep link نوتیفیکیشن‌ها | چک کنید route در `app/` باشد |
| `files.service.ts` | آپلود/سرو تصویر | تست آپلود KYC و محصول |
| `cart.service.ts` | سبد سمت سرور | `npm test` + تست دستی |
| `products.service.ts` | لیست/جزئیات محصول | تست دستی browse |
| `banners.service.ts` | اسلایدر صفحه اصلی | تست دستی home |
| `app/(tabs)/home.tsx` | صفحه اصلی | `npx tsc --noEmit` + اجرا |
| `app/(tabs)/browse.tsx` | لیست محصولات + فیلتر | همان |
| `app/(tabs)/cart.tsx` | 🔴 ثبت سفارش واقعی | تست end-to-end |
| `app/onboarding.tsx` | KYC + آپلود ۴ مدرک | تست end-to-end |
| `components/product/ProductCard.tsx` | همهٔ لیست‌های محصول | بصری |
| `components/product/PriceBox.tsx` | 🔴 قانون قیمت | تست هر سه حالت کاربر |

### ⚠️ `normalization.ts` — تلهٔ ویژه
```
اگر normalizePersian را عوض کنید:
   • دادهٔ موجود در ستون nameNormalized دیگر با تابع جدید نمی‌خواند
   • باید یک migration داده بنویسید:
       UPDATE products SET name_normalized = <new>(name)
   • و برای categories هم
   • و search_history / search_logs
```

---

## 5. 🟢 فایل‌های سطح سبز (ایزوله)

`CONFIRMED` این‌ها هیچ وابستگی خروجی ندارند:
```
app/(profile)/info-about.tsx
app/(profile)/info-faq.tsx
app/(profile)/info-guide.tsx
app/(profile)/info-privacy.tsx
app/(profile)/info-terms.tsx
components/product/ItemsPerPackageBadge.tsx
components/product/ProductCardSkeleton.tsx
components/search/SearchEmpty.tsx
components/ui/Skeleton.tsx
components/ui/EmptyState.tsx
public/admin/styles.css
```

✅ **به‌روزرسانی (P2):** `app/checkout.tsx` که ایزوله بود **حذف شد** (B21).

---

## 6. نگاشت «نوع تغییر» → «چک‌لیست»

### ۶-۱. افزودن یک فیلد به محصول
```
☐ ۱. schema.prisma → Product
☐ ۲. npx prisma migrate dev --name add_<field>
☐ ۳. products/dto/{create,update}-product.dto.ts
☐ ۴. products.service.ts (create/update/findAll select)
☐ ۵. ⚠️ اگر حساس است (مثل costPrice) → از پاسخ عمومی حذف کنید
☐ ۶. wholesale-mobile/src/types/product.ts
☐ ۷. public/admin/products.js (فرم + جدول)
☐ ۸. npm test && npm run build && npx eslint
☐ ۹. npx tsc --noEmit (موبایل)
```

### ۶-۲. افزودن یک endpoint
```
☐ ۱. در controller مناسب (نه فایل جدید، مگر دامنهٔ جدید)
☐ ۲. @UseGuards(JwtAuthGuard) — پیش‌فرض عمومی است!
☐ ۳. برای ادمین: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.ADMIN)
☐ ۴. DTO بنویسید (وگرنه whitelist بی‌اثر است)
☐ ۵. اگر Service جدید است → در module ثبت + در app.module اضافه
     ⚠️ ترتیب در app.module را چک کنید (تعارض مسیر)
☐ ۶. *Api.ts در موبایل (اگر اپ استفاده می‌کند)
☐ ۷. تعداد endpoint را در 09-API-BACKEND.md به‌روز کنید
☐ ۸. npm run build && npm test && npx eslint
```

### ۶-۳. افزودن یک صفحه به موبایل
```
☐ ۱. app/<route>.tsx یا app/(group)/<route>.tsx
☐ ۲. اگر در app/ ریشه است → در Stack app/_layout.tsx اضافه کنید (headerShown)
☐ ۳. از COLORS در @/constants/theme استفاده کنید (نه پالت محلی)
☐ ۴. flexDirection: 'row-reverse' برای RTL
☐ ۵. متن فارسی + اعداد با fa()
☐ ۶. اگر قیمت نشان می‌دهد → سه حالت PriceBox
☐ ۷. نpx tsc --noEmit && npx expo lint
```

### ۶-۴. افزودن یک view به پنل ادمین
```
☐ ۱. تابع global در یکی از فایل‌های JS موجود (orders/products/visitor-sales)
     یا فایل جدید
☐ ۲. اگر فایل جدید است → <script> قبل از app.js در index.html
☐ ۳. در renderLayout (app.js) به منو اضافه کنید
☐ ۴. در router (app.js) نگاشت hash → تابع
☐ ۵. endpoint لازم را در admin.controller.ts اضافه کنید (@Roles سطح کلاس هست)
☐ ۶. تست دستی در /admin
```

### ۶-۵. تغییر یک enum
```
☐ ۱. schema.prisma
☐ ۲. npx prisma migrate dev  ⚠️ ALTER TYPE — دادهٔ موجود را چک کنید
☐ ۳. همهٔ switch/map های بک‌اند (مثل ORDER_STATUS_TEMPLATE)
☐ ۴. wholesale-mobile/src/constants/enums.ts
☐ ۵. public/admin/*.js
☐ ۶. npm test && npm run build
```

---

## 7. 🔴 تغییراتی که **هرگز** بدون تأیید صریح کاربر انجام ندهید

| تغییر | چرا |
|---|---|
| اصلاح `.env` | کاربر صریحاً گفته «به خودم بسپار» |
| `git push` | کاربر صریحاً ممنوع کرده |
| اصلاح یافته‌های امنیتی `15-SECURITY.md` | ممکن است جریان تست دستی را بشکند |
| حذف `testCode` از پاسخ OTP | تست دستی را می‌شکند |
| افزودن `ThrottlerGuard` | ممکن است اپ را بشکند |
| تغییر update شرطی موجودی | Prisma پشتیبانی نمی‌کند |
| حذف `forwardRef` در `AdminModule` | احتمال خطای DI |
| تغییر ترتیب ماژول‌ها در `app.module.ts` | 🔴 نشت PII فعال می‌شود |
| `npx prisma format` | فایل را بازنویسی می‌کند |
| `npx prisma migrate reset` | سه `*_init` را دوباره اجرا می‌کند |
| `npx prisma db push` روی DB دارای داده | از دست رفتن داده |
| حذف `useForceUpdate` / `notificationRouting.ts` | شاید برای فاز بعدی‌اند (`checkout.tsx` در P2 حذف شد) |
| «تمیز کردن» ۱۴۰ هشدار eslint موبایل | عمدی‌اند (کامیت `dc90862`, `3f12639`) |
| «تمیز کردن» `defaultProps` در `_layout.tsx` | ممکن است فونت بشکند |
| یکسان‌سازی ۴ پالت رنگ | شاید عمدی باشد |
| افزودن `assets/` به موبایل | اول از کاربر بپرسید فایل‌ها کجایند |

---

## 8. چک‌لیست نهایی هر تغییر

```
قبل:
  ☐ 21-AI-AGENT-RULES.md را خواندم
  ☐ این فایل را برای فایل هدف چک کردم
  ☐ فایل‌های upstream/downstream را خواندم
  ☐ می‌دانم تغییر روی FE/BE/API/DB چه اثری دارد
  ☐ رفتار فعلی و دلیلش را می‌فهمم

حین:
  ☐ Minimal & Scoped — کمترین فایل ممکن
  ☐ بازنویسی کامل فایل نکردم
  ☐ متن‌های user-facing فارسی‌اند
  ☐ secret ننوشتم
  ☐ .env را دست نزدم

بعد:
  ☐ بک‌اند:  cd wholesale-api && npm test && npm run build \
             && npx eslint "{src,apps,libs,test}/**/*.ts"
  ☐ موبایل:  cd wholesale-mobile && npx tsc --noEmit && npx expo lint
  ☐ نتیجهٔ واقعی را گزارش کردم (نه «احتمالاً درست است»)
  ☐ اگر چیزی را نتوانستم verify کنم، صریحاً گفتم
```

---

## 🗄️ ۸. قبل از دست‌زدن به `schema.prisma` — نام‌گذاری مختلط ستون‌ها

> **منبع:** `Project_Context.md` §۶ (از `original-docs/`) — **در برابر کد راستی‌آزمایی شد.**

دیتابیس این پروژه **نام‌گذاری ناسازگار** دارد. این یک باگ نیست، واقعیت موجود است:

```
جدول‌ها  → همه snake_case  (۲۲ مورد @@map)
ستون‌ها  → اکثر CamelCase  (فقط ۱۸ فیلد @map دارد)
```

### ⛔ خطای کشنده

```prisma
// ❌ این را هرگز انجام ندهید:
isActive Boolean @default(true) @map("is_active")
//                                ^^^^^^^^^^^^^^^^
// ستون واقعی در Postgres نامش "isActive" است، نه "is_active"
// نتیجه: P2022 — The column `is_active` does not exist
```

### ✅ قاعده

| اگر ستون… | آنگاه… |
|---|---|
| **`@map` دارد** | ستون واقعاً snake_case است → دست نزنید، درست است |
| **`@map` ندارد** | ستون واقعاً CamelCase است → **`@map` اضافه نکنید** |

### نمونه‌های تأییدشده از `schema.prisma`

```prisma
nameNormalized String?   @map("name_normalized")  // ← snake_case (خودِ dev کامنت گذاشته)
orderNumber    String    @unique @map("order_number") // ← snake_case (تایید شده)
subtotalAmount Int       @map("subtotal_amount")      // ← snake_case (تایید شده)
isActive       Boolean   @default(true)               // ← بدون @map = ستون "isActive"
createdAt      DateTime  @default(now())              // ← بدون @map = ستون "createdAt"
```

> 📌 **چرا این مهم است؟** چون هیچ `tsc` یا `eslint` یا `prisma validate` این را نمی‌گیرد.
> `prisma validate` فقط سینتکس را می‌سنجد، نه وجود ستون در دیتابیس واقعی.
> **تنها راه فهمیدنش، اجرای migration روی Postgres واقعی است.**
