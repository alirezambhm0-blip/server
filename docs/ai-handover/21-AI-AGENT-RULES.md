# 21 — AI AGENT RULES

> # ⚠️ این فایل اجباری است. قبل از هر تغییری در این پروژه، کامل بخوانید.
>
> این قوانین از درخواست صریح کاربر و از تاریخچهٔ ۵۹ کامیت پروژه استخراج شده‌اند.
> نقض آن‌ها = کار رد شده.

---

## قانون ۱ — قبل از تغییر کد، فایل‌های مرتبط را بازرسی کنید

> **Inspect related files before changing code.**

### چه کار کنید
```
☐ ۱. فایل هدف را کامل بخوانید (نه فقط بخش مورد نظر)
☐ ۲. همهٔ فایل‌هایی که آن را import می‌کنند را پیدا کنید:
       grep -rn "<FileName>\|<SymbolName>" --include=*.ts --include=*.tsx .
☐ ۳. همهٔ فایل‌هایی که آن فایل import می‌کند را بخوانید
☐ ۴. 19-CHANGE-IMPACT-MAP.md را برای فایل هدف چک کنید
☐ ۵. اگر سرویس است → controller و spec مربوطه را هم بخوانید
☐ ۶. اگر endpoint است → کلاینت موبایل (*Api.ts) و پنل ادمین را هم ببینید
```

### چرا
`CONFIRMED` نمونه‌های واقعی از این پروژه:

| اگر فقط این را بخوانید | این را از دست می‌دهید |
|---|---|
| `orders.service.ts` | سه مسیر ساخت سفارش با منطق جداگانه |
| `CartContext.tsx` | الگوی `itemsRef` که عمدی است |
| `products.controller.ts` | `favorites.controller.ts` در همان ماژول (نشت `costPrice`) |
| `visitor-sales.controller.ts` | تعارض مسیر با `admin.controller.ts` |
| `_layout.tsx` | `orders.tsx` یک import مرده از آن دارد |
| `theme.ts` | سه پالت رنگ دیگر که از آن استفاده **نمی‌کنند** |
| `auth.service.ts` | `ADMIN_PHONE` از `.env` نقش ادمین می‌دهد |
| `normalization.ts` | دادهٔ **موجود** در ستون `nameNormalized` به آن وابسته است |

### 🔴 ممنوع
- تغییر فایلی که نخوانده‌اید
- حدس زدن اینکه «احتمالاً فلان‌جا استفاده می‌شود»
- تکیه بر حافظهٔ مکالمهٔ قبلی به‌جای خواندن مجدد

---

## قانون ۲ — تعامل FE / BE / API / DB را در نظر بگیرید

> **Consider FE/BE/API/DB interplay.**

### ماتریس اجباری
قبل از هر تغییر، این جدول را پر کنید (حتی ذهنی):

| لایه | آیا تحت تأثیر است؟ | چه فایلی؟ |
|---|---|---|
| **DB** (`schema.prisma`, migration) | | |
| **BE** (service, DTO) | | |
| **API contract** (شکل JSON) | | |
| **FE موبایل** (`*Api.ts`, `types/`, route) | | |
| **FE ادمین** (`public/admin/*.js`) | | |
| **نوتیفیکیشن** (`data.route` → route موبایل) | | |

### مثال واقعی از این پروژه
اضافه‌کردن یک فیلد به `Product`:
```
DB     → schema.prisma + migration
BE     → create-product.dto.ts + update-product.dto.ts + products.service.ts
API    → شکل پاسخ GET /products تغییر می‌کند
FE-موبایل → src/types/product.ts + ProductCard.tsx
FE-ادمین  → public/admin/products.js (فرم + جدول)
نوتیفیکیشن → —
```

### 🔴 ناهمگامی‌های واقعی که الان وجود دارند
| DB | بک‌اند | موبایل |
|---|---|---|
| `PaymentMethod` = ۴ مقدار | فقط `CASH_ON_DELIVERY` استفاده می‌شود | `enums.ts` = **۳ مقدار** (اولی غایب) |
| `OrderSource` = ۳ مقدار | `APP` هرگز صریحاً ست نمی‌شود | — |
| `shippingAmount` وجود دارد | 🔵 عمداً ست نمی‌شود (صفر = تصمیم محصول) | — |
| `idempotencyKey @unique` | ✅ نوشته و استفاده می‌شود (P2) | ✅ `cart.tsx` تولید و ارسال می‌کند |
| `minOrderQty` وجود دارد | **چک نمی‌شود** | — |
| `deepLink` (Json) | دو فرمت متفاوت نوشته می‌شود | مصرف‌کننده مرده است |

> **درس:** schema و کد در این پروژه **هم‌تراز نیستند.** فرض نکنید هر فیلدی
> که در schema هست، استفاده می‌شود.

---

## قانون ۳ — هرگز بدون بررسی اثر، تغییری ندهید

> **Never change without impact review.**

### چک‌لیست اجباری قبل از edit
```
☐ ۱. این تغییر چه فایل‌هایی را می‌شکند؟
☐ ۲. چه تستی آن را می‌گیرد؟ (اگر هیچ‌کدام → باید دستی verify کنم)
☐ ۳. آیا رفتار قابل مشاهده برای کاربر عوض می‌شود؟
☐ ۴. آیا migration لازم دارد؟
☐ ۵. آیا قرارداد API عوض می‌شود؟
☐ ۶. برگشت‌پذیر است؟
☐ ۷. کاربر این تغییر را خواسته، یا من «بهترش» می‌کنم؟  ← 🔴 مهم‌ترین سوال
```

### 🔴 تغییرات ممنوع بدون تأیید صریح کاربر

| تغییر | چرا |
|---|---|
| اصلاح `.env` | کاربر صریحاً گفته «به خودم بسپار» |
| `git push` به هر remote | کاربر صریحاً ممنوع کرده |
| رفع یافته‌های `15-SECURITY.md` | ممکن است جریان تست دستی را بشکند |
| حذف `testCode` از پاسخ OTP | تست دستی را می‌شکند |
| افزودن `ThrottlerGuard` سراسری | ممکن است اپ را بشکند |
| تغییر update شرطی موجودی | Prisma از قفل پشتیبانی نمی‌کند |
| حذف `forwardRef` در `AdminModule` | احتمال خطای DI در bootstrap |
| تغییر ترتیب ماژول‌ها در `app.module.ts` | 🔴 نشت PII فعال می‌شود |
| `npx prisma format` | فایل را بازنویسی می‌کند |
| `npx prisma migrate reset` | سه `*_init` را دوباره اجرا می‌کند |
| `npx prisma db push` روی DB دارای داده | از دست رفتن داده |
| حذف کد مرده (`useForceUpdate`, `notificationRouting.ts`, `checkout.tsx`, `notification.listener.ts`) | شاید برای فاز بعدی‌اند |
| «تمیز کردن» ۱۴۰ هشدار eslint موبایل | عمدی‌اند (کامیت `dc90862`, `3f12639`) |
| «تمیز کردن» `defaultProps` در `_layout.tsx` | ممکن است فونت بشکند |
| یکسان‌سازی ۴ پالت رنگ | شاید عمدی باشد |
| حذف `bcrypt` / `axios` / `supertest` | dead dependency ولی شاید برای آینده |
| افزودن `assets/` به موبایل | اول بپرسید فایل‌ها کجایند |
| revert تغییرات commit‌نشده | کار نیمه‌تمام کاربر است |

---

## قانون ۴ — رفتار فعلی را بدون دلیل تغییر ندهید

> **Don't alter current behaviour without reason.**

### اصل
**رفتار فعلی، حتی اگر عجیب به نظر برسد، ممکن است عمدی باشد.**
قبل از تغییر، دنبال **شواهد عمدی بودن** بگردید:

| نشانهٔ عمدی بودن | نمونهٔ واقعی |
|---|---|
| کامنت توضیحی | `orders.service.ts:34-40` — چرا قفل DB نه |
| کامنت «کلید حل مشکل» | `CartContext.tsx:199-203` — چرا `ref` نه `state` |
| کامنت «no rollback» | `CartContext.tsx:229` — حذف بدون rollback |
| کامنت «per user decision» | کامیت `e65c2be` |
| کامنت «marketing» | کامیت `f3ee855` — متن صرفه‌جویی |
| تست نوشته‌شده برای آن رفتار | کامیت `7b72446` — ۱۴ case مسیر پول |
| کامیت که صریحاً آن را اضافه کرده | `0979443` — `OptionalJwtAuthGuard` |

### نمونه‌های «عجیب ولی عمدی»
```
✅ update شرطی موجودی به‌جای قفل DB      → Prisma پشتیبانی نمی‌کند
✅ itemsRef به‌جای state                 → حل stale closure
✅ حذف آیتم بدون rollback                → کامنت صریح
✅ authenticated قبل از verify توکن      → UI سریع‌تر بالا می‌آید
✅ OptionalJwtAuthGuard روی /products    → مرور مهمان
✅ نوتیفیکیشن بعد از commit تراکنش      → جلوگیری از پیام غلط
✅ /docs پاسخ 404 نه 403                 → پنهان‌سازی
✅ JwtStrategy هر request به DB          → قطع فوری دسترسی
✅ فایل‌های KYC از static سرو نمی‌شوند   → حریم خصوصی
✅ reorder خطا نمی‌دهد، summary می‌دهد   → تجربهٔ کاربری
✅ notify به‌جای Alert.alert              → در وب کار نمی‌کند
✅ ۱۴۰ هشدار eslint                      → آگاهانه حفظ شده
✅ متن «صرفه‌جویی» در product-detail     → بازاریابی
```

### اگر فکر می‌کنید چیزی باگ است
```
۱. در 17-KNOWN-ISSUES.md ثبتش کنید
۲. به کاربر بگویید
۳. منتظر تأیید بمانید
۴. ❌ خودتان اصلاح نکنید
```

---

## قانون ۵ — هرگز معماری یا منطق کسب‌وکاری را حدس نزنید

> **Never guess architecture or business logic.**

### برچسب‌گذاری اجباری
هر ادعایی که می‌کنید باید یکی از این برچسب‌ها را داشته باشد:

| برچسب | معنی | مثال |
|---|---|---|
| `CONFIRMED` | با خواندن کد یا اجرای دستور تأیید شده | «۱۱۷ endpoint وجود دارد» |
| `INFERRED` | از کد استنباط شده، مستقیماً تأیید نشده | «این الگو احتمالاً عمدی است» |
| `UNVERIFIED` | نتوانستم بررسی کنم | «migrationها روی DB واقعی تست نشدند» |
| `NOT FOUND` | دنبالش گشتم، نبود | «`test/jest-e2e.json` وجود ندارد» · «`test/jest-e2e.json` وجود ندارد» |

### 🔴 ممنوع
- نوشتن یک حدس با لحن قطعیت
- «احتمالاً» بدون برچسب `INFERRED`
- تکرار ادعای مستندات قدیمی بدون verify
- فرض اینکه «معماری استاندارد NestJS است پس حتماً فلان‌طور است»

### نمونهٔ واقعی از خطای حدس در همین پروژه
```
❌ ادعای قبلی: «مسیر /orders/admin/all توسط :id سایه می‌شود»
✅ واقعیت:     Express 5 سگمنت ایستا را اولویت می‌دهد.
               با probe واقعی: GET /orders/admin/all → 200
               → فرضیه رد شد.
```
```
❌ ادعای قبلی: «throw new Error باعث نشت stack trace به کلاینت می‌شود»
✅ واقعیت:     با اجرای اپ NestJS: 500 {"message":"Internal server error"}
               → stack نشت نمی‌کند. ادعا رد شد.
```
```
❌ ادعای قبلی: «مشتری هنگام تایید/رد KYC هیچ نوتیفیکیشنی نمی‌گیرد»
✅ واقعیت:     admin.service.ts مستقیماً in-app notification می‌سازد.
               فقط push نمی‌رود.
```

> **درس:** حتی تحلیل‌های قبلیِ خودتان را دوباره verify کنید.

### اگر نمی‌دانید
```
۱. در سورس بگردید (grep)
۲. اگر پیدا نشد → صریحاً بنویسید NOT FOUND
۳. اگر مبهم است → از کاربر بپرسید
۴. ❌ حدس نزنید
```

---

## قانون ۶ — قبل از دست‌زدن به نواحی حساس، وابستگی‌ها را چک کنید

> **Check dependencies before touching sensitive areas.**

### نواحی حساس (سطح قرمز)
```
🔴 prisma/schema.prisma            → ۱۷ ماژول + ۱۶ migration + تایپ‌های موبایل
🔴 src/main.ts                     → CORS + static + /docs + ValidationPipe + Sentry
🔴 src/app.module.ts               → 🔴 ترتیب ثبت routeها (تعارض مسیر)
🔴 mobile/src/api/httpClient.ts    → همهٔ درخواست‌های اپ
🔴 mobile/app/_layout.tsx          → فونت + Sentry + SafeArea + redirect
🔴 public/admin/index.html         → ترتیب <script>ها
🔴 public/admin/core.js            → همهٔ viewهای پنل
🔴 prisma.service.ts               → همهٔ سرویس‌ها
🔴 babel.config.js ↔ tsconfig.json → alias @/ (هر دو باید همگام باشند)
```

### چک‌لیست وابستگی
```
☐ ۱. 18-DEPENDENCY-MAP.md را برای این فایل چک کردم
☐ ۲. چه ماژول‌هایی آن را import می‌کنند؟ (grep)
☐ ۳. آیا چرخهٔ ماژول ایجاد می‌کنم؟
☐ ۴. آیا ترتیب ثبت route عوض می‌شود؟
☐ ۵. آیا یک جفت پلتفرمی (.web.tsx) دارد؟
☐ ۶. آیا نسخه‌اش باید با پکیج دیگری هم‌تراز باشد؟
☐ ۷. آیا در package-lock.json هم باید به‌روز شود؟
```

### ⚠️ وابستگی‌های نسخه‌ای
```
prisma CLI ↔ @prisma/client          هر دو ^5.22.0
@nestjs/*                            همه ^11
expo ↔ react-native ↔ react          ~56.0.13 / 0.85.3 / 19.2.3
reanimated ↔ worklets                4.3.1 / 0.8.3
🔴 expo-build-properties             ^57.0.17 روی SDK 56 — ناهم‌تراز (UNVERIFIED)
```

`CONFIRMED` کامیت `f11b7f8`: **«metro-chain pinned by RN»** —
زنجیرهٔ metro با RN pin شده، دستی تغییر ندهید.

---

## قانون ۷ — هرگز secret را فاش نکنید

> **Never expose secrets.**

### 🔴 ممنوع مطلق
```
❌ چاپ محتوای .env (حتی بخشی از آن)
❌ نوشتن JWT_SECRET، رمز DB، یا اعتبارنامه پیامک در کد/کامنت/مستندات
❌ commit کردن .env
❌ push به هر remote
❌ فرستادن secret به سرویس خارجی (Sentry، لاگ، API)
❌ نمایش secret در خروجی chat
```

### ✅ مجاز
```
✅ نام کلیدها:  JWT_SECRET, DATABASE_URL, MELIPAYAMAK_USERNAME
✅ طول مقدار:   «طول ۲۳»
✅ اینکه پر است یا placeholder
```

### وضعیت فعلی این پروژه
`CONFIRMED`
```
wholesale-api/.env            → مقادیر زنده دارد (JWT_SECRET طول ۲۳)
wholesale-api/.gitignore      → آن را exclude می‌کند ✅
workspace-01a078c1-...zip     → 🔴 ولی .env داخلش است
github.com/.../cuntinue_whosale01.git → 🔴 و آن زیپ push شده
```

🔴 **این یک نشت فعال است.** → `15-SECURITY.md` §S4, §S13

### ⚠️ نقطهٔ خطر دیگر
`CONFIRMED` `sentry.filter.ts:29-36` مقدار `request.body` را به Sentry می‌فرستد.
اگر روزی `SENTRY_DSN` فعال شود، **کد OTP و کد ملی به Sentry می‌روند.**

---

## ۸. قوانین سبک کد (از شواهد پروژه)

`CONFIRMED`

### ۸-۱. زبان
- همهٔ متن‌های user-facing **فارسی**
- کامنت‌ها فارسی (الگوی غالب پروژه)
- پیام خطا فارسی و کاربرپسند
- نام متغیر/تابع **انگلیسی**

### ۸-۲. RTL
```ts
flexDirection: 'row-reverse'   // برای ردیف‌ها
textAlign: 'right'
<Ionicons name="arrow-forward" />   // برای دکمهٔ بازگشت
```
⚠️ هیچ `I18nManager.forceRTL(true)` وجود ندارد — RTL دستی است.

### ۸-۳. اعداد و تاریخ
```ts
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
new Intl.DateTimeFormat('fa-IR')   // تاریخ شمسی
```
⚠️ `fa()` در هر route تکرار شده — به `utils/format.ts` منتقل نشده.

### ۸-۴. استثنا
```ts
✅ NotFoundException · BadRequestException · ConflictException
✅ ForbiddenException · UnprocessableEntityException
✅ TooManyRequestsException (سفارشی، از common/)
❌ throw new Error(...)   → 9 مورد موجود، همه باگ
```

### ۸-۵. پاسخ API
```
✅ برای سفارش از mapOrderToResponse استفاده کنید
❌ موجودیت خام Prisma را برنگردانید
❌ costPrice را در پاسخ عمومی نگذارید
```

### ۸-۶. لاگ
```ts
console.warn('[Auth] ...')     // پیشوند ماژول
console.warn('[Cart] ...')
console.warn('[Favorites] ...')
```

### ۸-۷. Minimal & Scoped
`CONFIRMED` کامیت `df558a2`: «read-only audit first, per Minimal&Scoped rules»
```
✅ کمترین فایل ممکن
✅ هر تغییر توجیه‌شده
❌ بازنویسی کامل فایل
❌ ری‌فرمت کردن کل فایل
❌ «تمیزکاری» همراه با تغییر اصلی
```

---

## ۹. گزارش‌دهی

### ۹-۱. بعد از هر تغییر
```
☐ دقیقاً چه فایلی، چه تغییری
☐ چه دستوری اجرا شد و چه خروجی داد (واقعی، نه حدسی)
☐ چه چیزی verify نشد و چرا
☐ چه چیزی باید دستی تست شود
```

### ۹-۲. دستورهای verify
```bash
# بک‌اند
cd wholesale-api
npm test                                              # 4 suite / 18 تست
npm run build                                         # exit 0
npx eslint "{src,apps,libs,test}/**/*.ts"             # 0/0

# موبایل
cd wholesale-mobile
npx tsc --noEmit                                      # exit 0
npx expo lint                                         # 0 خطا / ۱۴۰ هشدار
```

### ۹-۳. 🔴 «سبز بودن» کافی نیست
`CONFIRMED` این دستورها **نمی‌گیرند**:
- `assets/` موجود نیست
- مسیر route اشتباه
- تغییر قرارداد API
- alias ناهمگام بین babel و tsconfig
- رفتار Prisma روی DB واقعی
- RTL / SafeArea

### ۹-۴. اگر چیزی را نتوانستید verify کنید
```
✅ «نتوانستم X را verify کنم چون Y»
❌ «احتمالاً کار می‌کند»
❌ سکوت
```

---

## ۱۰. جمع‌بندی — ۷ قانون در یک نگاه

```
۱. قبل از تغییر، فایل‌های مرتبط را بخوانید          → grep + 19-CHANGE-IMPACT-MAP
۲. FE / BE / API / DB را با هم ببینید               → ماتریس ۶ لایه
۳. بدون بررسی اثر تغییر ندهید                        → چک‌لیست ۷ سوالی
۴. رفتار فعلی را بدون دلیل عوض نکنید                 → دنبال شواهد عمدی بودن
۵. معماری و منطق کسب‌وکار را حدس نزنید              → CONFIRMED/INFERRED/UNVERIFIED/NOT FOUND
۶. در نواحی حساس، وابستگی‌ها را چک کنید             → 18-DEPENDENCY-MAP
۷. secret را فاش نکنید                              → فقط نام کلید، نه مقدار
```

---

## ۱۱. آخرین نکته

اگر بین این مستندات و سورس تناقض دیدید:

> ## 🔴 سورس برنده است.

این مستندات در یک لحظه از زمان نوشته شده‌اند. کد تغییر می‌کند.
هر ادعایی را قبل از تکیه کردن، **خودتان verify کنید.**

و اگر تناقضی پیدا کردید، آن را در `17-KNOWN-ISSUES.md` §تناقض‌ها ثبت کنید —
**پنهانش نکنید.**
