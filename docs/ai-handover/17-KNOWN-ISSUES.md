# 17 — KNOWN ISSUES

> **۳۱ مسئلهٔ ثبت‌شده.** همه با اجرای دستور روی کد واقعی تأیید شده‌اند،
> مگر اینکه صریحاً `UNVERIFIED` علامت خورده باشند.
>
> ⚠️ **هیچ‌کدام از این‌ها را بدون تأیید صریح کاربر اصلاح نکنید.**
> → `21-AI-AGENT-RULES.md`

---

## 0. فهرست سریع

| # | عنوان | شدت | دسته |
|---|---|---|---|
| B1 | Rate limiting بی‌اثر | 🔴 | امنیتی |
| B2 | قفل OTP به‌خاطر rollback فعال نمی‌شود | 🔴 | امنیتی |
| B3 | `visitor-sales` بدون `RolesGuard` | 🔴 | امنیتی |
| B4 | `JWT_SECRET` زنده در ریپازیتوری | 🔴 | امنیتی |
| B5 | `testCode` در پاسخ OTP | 🔴 | امنیتی |
| B6 | `.env` با مقادیر زنده در زیپ push‌شده | 🔴 | امنیتی |
| B7 | نشت `costPrice` در `/products/favorites` | 🟠 | امنیتی |
| B8 | قیمت عمده بدون احراز هویت | 🟠 | امنیتی |
| B9 | `JwtStrategy` وضعیت `Customer.status` را چک نمی‌کند | 🟠 | امنیتی |
| B10 | کد OTP به‌صورت plaintext | 🟠 | امنیتی |
| B11 | **۹ مورد `throw new Error(...)` → HTTP 500** | 🔴 | کارکردی |
| B12 | نوتیفیکیشن push برای تایید/رد KYC نمی‌رود | 🟠 | کارکردی |
| B13 | `notification.listener.ts` ثبت‌نشده (کد مرده) | 🟡 | کارکردی |
| B14 | `markAllAsRead` نوتیفیکیشن‌های broadcast را نمی‌خواند | 🟠 | کارکردی |
| B15 | `search.findAll` روی `name` خام جستجو می‌کند | 🟠 | کارکردی |
| B16 | باگ `\u064B` در `normalizePersian` | 🟡 | کارکردی |
| B17 | `previousStatus` hardcode در `cancelOrder` | 🟡 | کارکردی |
| B18 | `shippingAmount` هرگز ست نمی‌شود | 🟠 | مالی |
| B19 | `idempotencyKey` هرگز استفاده نمی‌شود | 🟠 | مالی |
| B20 | تعارض مسیر `/admin/customers/search` | 🟠 | کارکردی |
| B21 | `app/checkout.tsx` یک route یتیم است | 🟡 | موبایل |
| B22 | `favorites.tsx` و `notification-settings.tsx` stub | 🟡 | موبایل |
| B23 | `notificationRouting.ts` هرگز import نشده | 🟡 | موبایل |
| B24 | `useForceUpdate` مرده | 🟢 | موبایل |
| B25 | `logout` سرور را صدا نمی‌زند | 🟡 | موبایل |
| B26 | 🔴 `wholesale-mobile/assets/` در ریپازیتوری نیست | 🔴 | build |
| B32 | `ValidationPipe` روی ماژول `orders` بی‌اثر (بدون DTO) | 🟡 | معماری |
| B27 | تناقض `REJECTED` بین `index.tsx` و `_layout.tsx` | 🟠 | موبایل |
| B28 | import مردهٔ `Fonts` از `_layout` | 🟢 | موبایل |
| B29 | ۴ پالت رنگ + ۲ `Fonts` + ۲ `Spacing` موازی | 🟡 | بدهی فنی |
| B30 | `ErrorBoundary.tsx` با IP hardcode + `catch {}` خالی | 🟡 | موبایل |
| B31 | `@Cron(process.env.BACKUP_INTERVAL)` قبل از ConfigModule | 🟠 | کارکردی |

---

## بخش ۱ — مسائل بحرانی (🔴)

### B1 — ✅ Rate limiting کاملاً بی‌اثر — **رفع شد**
```
app.module.ts:26-31  → ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])  ✅ ثبت شده
main.ts              → هیچ app.useGlobalGuards(new ThrottlerGuard())        ❌
grep "ThrottlerGuard\|@Throttle" src → 0 نتیجه                              ❌
```
**اثر:** همهٔ endpointها بدون محدودیت قابل فراخوانی‌اند.
→ `15-SECURITY.md` §S1

### B2 — ✅ قفل OTP هرگز فعال نمی‌شود — **رفع شد**
```
auth.service.ts:233-247  ← داخل $transaction
  tx.otp.update({ data: { attempts: n+1 } })
  throw new Error(`WRONG_CODE:${remaining}`)   → ROLLBACK → attempts صفر می‌ماند
```
`UNVERIFIED` (rollback بر اساس مستندات Prisma؛ DB واقعی در دسترس نبود)

**اثر:** ترکیب با B1 → brute force نامحدود روی کد ۶ رقمی.
→ `15-SECURITY.md` §S2

### B3 — ✅ `visitor-sales` بدون `RolesGuard` — **رفع شد**
```
visitor-sales.controller.ts (۵۲ خط، کامل خوانده شد)
  → فقط @UseGuards(JwtAuthGuard) در هر سه controller
  → RolesGuard حتی import نشده
```
**اثر:**
- `POST /visitor/orders` → هر مشتری می‌تواند برای هر مشتری دیگر سفارش ثبت کند
- `GET /admin/customers/search` → ⚠️ **ادعای «نشت PII» در بررسی دقیق‌تر رد شد**: این مسیر توسط
  `AdminController.customerSearch` (که `@Roles(ADMIN)` دارد و اول ثبت می‌شود) سایه می‌خورد
  → `VisitorSalesService.searchCustomers` عملاً dead code است. گارد با این حال اضافه شد
  تا اگر روزی ترتیب ماژول عوض شد، امن بماند.
→ `15-SECURITY.md` §S3

### B4 — `JWT_SECRET` زنده در ریپازیتوری عمومی
→ `15-SECURITY.md` §S4

### B5 — `testCode` در پاسخ OTP (`NODE_ENV=development`)
→ `15-SECURITY.md` §S5 — 🔵 به **S5-A** (کد آماده ✅) و **S5-B** (تست بعد از Deploy) تقسیم شد

### B6 — `.env` با مقادیر زنده داخل زیپِ push‌شده
→ `15-SECURITY.md` §S13

### B11 — ✅ ۹ مورد `throw new Error(...)` → HTTP 500 — **رفع شد (P1)**

`CONFIRMED` **آزمایش واقعی** با NestJS 11 نصب‌شده در پروژه:
```
throw new Error('EXPIRED')           → 500 {"statusCode":500,"message":"Internal server error"}
throw new BadRequestException('bad') → 400 {"message":"bad","error":"Bad Request","statusCode":400}
```

| فایل:خط | پیام گم‌شده | باید |
|---|---|---|
| `auth.service.ts:224` | `'EXPIRED'` | 400 |
| `auth.service.ts:229` | `'ALREADY_USED'` | 400 |
| `auth.service.ts:246` | `'WRONG_CODE:${n}'` | 400 |
| `admin.service.ts:205` | «این شماره همراه قبلاً … ثبت شده» | 409 |
| `admin.service.ts:352` | «هیچ مشتری تایید شده ای … یافت نشد» | 404 |
| `categories.service.ts:93` | «این دسته‌بندی دارای محصول است …» | 409 |
| `profile.service.ts:147` | «تغییر فیلدهای … نیاز به تایید ادمین دارد» | 403 |
| `tickets.controller.ts:31` | «فقط مشتریان می‌توانند تیکت ثبت کنند» | 403 |
| `tickets.controller.ts:37` | «فقط مشتریان می‌توانند پاسخ دهند» | 403 |

✅ **نکتهٔ مثبت:** stack trace نشت نمی‌کند (ادعای قبلی مبنی بر نشتی **با آزمایش رد شد**).
🔴 **نکتهٔ منفی:** کاربر «خطای سرور» می‌بیند، نه دلیل واقعی.

**بدترین اثر:** مشتری که کد OTP را اشتباه وارد می‌کند، خطای ۵۰۰ می‌بیند.

### B26 — ✅ `wholesale-mobile/assets/` در ریپازیتوری نیست — **رفع شد**
```bash
$ ls wholesale-mobile/assets
→ No such file or directory
$ git check-ignore -v assets
→ NOT ignored
```

ارجاع‌های خراب:
```ts
app/_layout.tsx:110-115        → require("../assets/fonts/Vazirmatn-*.ttf")   (۶ مورد)
app/welcome.tsx:47             → require("../assets/images/expo-logo.png")
src/components/ui/LoadingState → require("../../../assets/images/react-logo.png")
src/components/**              → require('@/assets/images/*')
app.json                       → ./assets/images/{icon,splash-icon,android-icon-*,favicon}.png
```

✅ فایل‌های واقعی در `wholesale-mobile/src/assets/fonts/` هستند (۶ `.ttf`، در گیت track شده).

`CONFIRMED` کامیت `f11b7f8` می‌گوید «full web bundle export» موفق بوده →
پس `assets/` روی ماشین توسعه‌دهنده وجود داشته ولی **هرگز commit نشده**.

**اثر:** یک clone تمیز نمی‌تواند اپ را build کند.
⚠️ `npx tsc --noEmit` و `npx expo lint` این را **نمی‌گیرند**. فقط Metro خطا می‌دهد.

---

## بخش ۲ — مسائل زیاد (🟠)

### B7 — ✅ نشت `costPrice` — **رفع شد (P1)**
```
products/favorites.controller.ts → products.service.ts:446 (getMyFavorites)
  → ردیف خام Prisma، بدون mapper
  → شامل costPrice (قیمت خرید بنکو)
```
**اثر ثانویه:** `toLocalProduct` در موبایل می‌شکند (شکل پاسخ متفاوت است).

> **رفع:** `getMyFavorites` حالا `{ costPrice, nameNormalized, ...safe }` را
> destruct می‌کند. ⚠️ اثر ثانویهٔ بالا **واقعی بود و رعایت شد**: پاسخ عمداً
> camelCase ماند (از `enhancedItems` عبور داده نشد) چون `ServerProduct` و
> `toLocalProduct` در موبایل به camelCase وابسته‌اند. فقط فیلدهای حساس حذف شدند.

### B8 — ✅ قیمت عمده بدون احراز هویت — **رفع شد (P1)**
```
products.controller.ts   → @UseGuards(OptionalJwtAuthGuard) @Get()
  → پاسخ شامل price برای همه
PriceBox.tsx             → پنهان‌سازی فقط سمت UI
```
`CONFIRMED` کامیت `0979443` تأیید می‌کند `OptionalJwtAuthGuard` **عمدی** است —
مشکل از guard نیست، از حذف‌نشدن شرطی `price` است.

> **رفع:** قیمت حالا **سمت API** شرطی است، نه فقط UI. جزئیات کامل در `15` §S7.
> نکته: `GET /products/:id/similar` هیچ گاردی نداشت که اضافه شد.

### B9 — ✅ `JwtStrategy` وضعیت مشتری را چک نمی‌کند — **رفع شد (P1)**
```
jwt.strategy.ts:27-47 (کامل خوانده شد)
  → فقط user.isActive چک می‌شود
  → user.customer.status چک نمی‌شود
```
**اثر:** مشتری `REJECTED`/`BLOCKED` توکن معتبر دارد و به همهٔ endpointهای
`JwtAuthGuard`-only دسترسی دارد.

⚠️ `cart.service.ts:24-26` **خودش** `BLOCKED` را چک می‌کند → الگوی پراکنده.

> **رفع:** `jwt.strategy.ts` کاربر `BLOCKED` را با `UnauthorizedException` رد
> می‌کند. الگوی پراکندهٔ بالا سر جایش ماند (لایهٔ دوم دفاع، بی‌ضرر).

### B10 — کد OTP به‌صورت plaintext
```
schema.prisma:215-231 → Otp.code String  (بدون hash)
schema.prisma:233-247 → OtpAttempt.code String?  (در عمل ذخیره می‌شود)
```

### B12 — نوتیفیکیشن push برای تایید/رد KYC نمی‌رود
```
admin.service.ts:133-146  → prisma.notification.create(...)  ✅ in-app ساخته می‌شود
admin.service.ts:146      → emit('kyc.approved')             🔴 بدون شنونده
admin.service.ts:159      → emit('kyc.rejected')             🔴 بدون شنونده
```
**اثر دقیق:** کاربر در اپ پیام را می‌بیند، ولی **push نمی‌رود** —
تا خودش اپ را باز کند خبردار نمی‌شود.

### B14 — `markAllAsRead` ناقص
```
notifications.service.ts → فقط where: { userId }
  → نوتیفیکیشن‌های broadcast (userId === null + targetUsers[]) خوانده‌شده نمی‌شوند
```
⚠️ همچنین **دو مکانیزم موازی**: `Notification.isRead` **و** جدول `NotificationRead`.

### B15 — `search.findAll` روی ستون خام
```
search.service.ts → findAll روی `name`      (خام)
                  → suggest  روی `nameNormalized`
```
**اثر:** «ابزار» با ي عربی پیدا نمی‌شود. suggest و search نتایج متفاوت می‌دهند.

### B18 — ✅ `shippingAmount` ست نمی‌شود — 🔵 **رفتار عمدی و تاییدشده (تصمیم محصول)**
```
schema.prisma:160  → shippingAmount Int @default(0) // بدون @map ⇒ ستون CamelCase
orders.service.ts:397,801 → subtotalAmount: subtotal / totalAmount: subtotal
                            (هر دو مسیر: مشتری و ادمین)
cart.service.ts:135       → final_total: subtotal   (بدون سطر ارسال)
.env.example:27-28        → MIN_ORDER_AMOUNT / FREE_SHIPPING_MIN_AMOUNT
                            ← **صفر ارجاع در کل کد** (config مرده)
admin.controller.ts:457,601 → فاکتور ادمین shippingAmount را **می‌خواند و رندر می‌کند**
```
**وضعیت فعلی:** `checkout.tsx` در B19 حذف شد، پس آن hardcode از بین رفت.
`shippingAmount` همچنان هیچ‌جا **نوشته** نمی‌شود.

> ✅ **تصمیم نهایی مالک پروژه:**
> «در نسخه فعلی Production، هزینه ارسال **صفر** است و محاسبهٔ Shipping در آینده
> طبق Business Rule جداگانه پیاده‌سازی خواهد شد.»
>
> پس این **باگ نیست**؛ وضعیت فعلی عمدی و تاییدشده است.
> ⚠️ نتیجه: هیچ Agent یا توسعه‌دهنده‌ای نباید سرخود `shippingAmount` را ست کند،
> مقدار پیش‌فرض را عوض کند، یا `MIN_ORDER_AMOUNT`/`FREE_SHIPPING_MIN_AMOUNT`
> را به کد وصل کند. این کار منتظر Business Rule جداگانه است.
>
> **زیرساخت آماده است:** جدول `settings` (`Setting { key @id, value }`) با
> migration `20260724200140_add_settings_table` موجود است و متدهای
> `getSettings()` / `updateSetting()` در `products.service.ts:496-507` و
> اندپوینت‌های `GET/POST /admin/settings` در `admin.controller.ts:240-247`
> کار می‌کنند (الان برای `STORE_NAME`/`VISITOR_PHONE`/`DRIVER_PHONE` استفاده
> می‌شوند). پس پیاده‌سازی **بدون migration جدید** ممکن است.
>
> ⚠️ **محدودیت ساختاری:** هیچ مدل آدرس/شهر وجود ندارد (`alternativeAddress` فقط
> یک `String` آزاد است) ⇒ هزینه بر اساس شهر بدون تغییر schema ممکن نیست.

### B19 — ✅ `idempotencyKey` بی‌استفاده — **رفع شد (P2)**
```
schema.prisma:151  → idempotencyKey String? @unique   (دست‌نخورده حفظ شد)
```
**اثر پیش از رفع:** محافظت در برابر double-submit وجود ندارد.
(PostgreSQL چند `NULL` در unique قبول می‌کند، پس خطا نمی‌دهد.)

> **رفع (P2):** مسیر کامل کلید:
> ```
> cart.tsx:80   generateIdempotencyKey()  →  idempotencyKeyRef (:105)
> cart.tsx:159  placeOrderApi({ ..., idempotency_key })
>   → POST /orders → orders.controller.ts:27,35
>   → orders.service.ts:299 → :392 order.create({ data: { idempotencyKey } })
>   → PostgreSQL UNIQUE("idempotencyKey")
> ```
> **درخواست تکراری:** `P2002` → بررسی `meta.target` (کورکورانه نه) →
> `findUnique` → **HTTP 200 + سفارش اصلی** (نه 201، نه 409).
> کلید تا «موفقیت همان attempt» ثابت می‌ماند تا Retry هم پوشش داده شود.
>
> **دو محافظ دیگر:** `if (placing) return` در `cart.tsx:148` و
> `disabled={placing}` روی دکمهٔ شیت تأیید (`cart.tsx:602`) — که پیش از این
> **هیچ `disabled` نداشت** و ریشهٔ واقعی double-submit بود.
>
> **نکتهٔ حیاتی برای تغییرات آینده:** `.catch` عمداً روی یک promiseٔ جدا
> (`orderPromise`) بسته شده تا هندلر `.then` که `EVENT_ORDER_CREATED` می‌فرستد
> روی rejection اجرا نشود. اگر این زنجیره را refactor کردید، نوتیفیکیشن
> تکراری برای درخواست تکراری ارسال خواهد شد.

ℹ️ `CONFIRMED` کامیت `7b72446` یک تست با نام «idempotency» اضافه کرده بود
(`orders.service.spec.ts:600`) ولی آن دربارهٔ **لغو مجدد سفارش** بود، نه کلید
idempotency. `INFERRED` نام‌گذاری گمراه‌کننده بود؛ اکنون پیاده‌سازی واقعی وجود دارد.

### B20 — تعارض مسیر `/admin/customers/search`
```
admin.controller.ts:90            @Get('customers/search')  @Controller('admin')
                                  → /admin/customers/search   [JwtAuthGuard, RolesGuard, @Roles(ADMIN)]

visitor-sales.controller.ts:30-38 @Get('search')  @Controller('admin/customers')
                                  → /admin/customers/search   [JwtAuthGuard فقط]
```
`CONFIRMED` `AdminModule` در `app.module.ts` **قبل از** `VisitorSalesModule` آمده
→ `AdminController` برنده است → **مشتری ۴۰۳ می‌گیرد.**

**پیامد:** `VisitorSalesService.searchCustomers` عملاً **کد مرده** است.

⚠️ **این تصادف، یک کنترل امنیتی نیست.** اگر ترتیب ماژول‌ها عوض شود، B3 فعال می‌شود.

### B27 — تناقض `REJECTED` در redirect
| | `app/index.tsx:8,16` | `app/_layout.tsx:75-81` |
|---|---|---|
| `needsOnboarding` | ✅ | ✅ |
| `status === "REJECTED"` | ✅ | ❌ |
| `guest` | ✅ → home | ❌ هیچ شرطی |

**اثر:** مشتری ردشده‌ای که مستقیم به یک تب برود، به onboarding هدایت نمی‌شود.

### B32 — `ValidationPipe` روی ماژول `orders` بی‌اثر است 🆕

`CONFIRMED` **آزمایش واقعی** با NestJS 11 نصب‌شده در پروژه (P2):
```ts
// main.ts:30-34
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })

// orders.controller.ts:18-28 — تایپ inline، نه کلاس DTO
@Body() body: { delivery_address: string; ... }
```
```
pipe.transform({ delivery_address: 'x', HACK: 'injected' },
               { type: 'body', metatype: Object, data: '' })
→ RESULT = {"delivery_address":"x","HACK":"injected"}
```
**علت:** تایپ inline در runtime به `Object` کامپایل می‌شود و `ValidationPipe.toValidate()`
برای تایپ‌های بومی `false` برمی‌گرداند ⇒ پایپ **اصلاً اجرا نمی‌شود**.
یعنی `whitelist` و `forbidNonWhitelisted` روی endpointهای سفارش تزئینی‌اند.

**دامنه:** `orders.controller.ts` هیچ فایل `*.dto.ts` ندارد، در حالی که ماژول‌های
`auth` (۵)، `cart` (۳)، `categories` (۲)، `notifications` (۱)، `products` (۲) و
`tickets` (۱) دارند.

**اثر:** فیلدهای ناشناخته بی‌صدا رد می‌شوند (نه ۴۰۰). امروز exploit خاصی ندارد
چون سرویس فقط فیلدهای مشخص را مصرف می‌کند، ولی قرارداد API عملاً بدون اعتبارسنجی است.

🔵 **چرا در P2 رفع نشد:** طبق تصمیم صریح مالک پروژه، افزودن DTO به ماژول orders
خارج از scope B19 بود — چون فعال‌شدن واقعی `forbidNonWhitelisted` می‌تواند
**پنل ادمین و سایر clientها را بشکند** و نیاز به بررسی مستقل تمام callerها دارد.


### B31 — `@Cron` قبل از ConfigModule
```
backup.service.ts → @Cron(process.env.BACKUP_INTERVAL)
```
decoratorها در زمان parse ارزیابی می‌شوند، یعنی **قبل از** خواندن `.env`.

`UNVERIFIED` — نتوانستم سرور را اجرا کنم.

---

## بخش ۳ — مسائل متوسط و کم

### B13 — `notification.listener.ts` ثبت‌نشده
```
notifications.module.ts → providers: [NotificationsService, NotificationEventsListener]
grep -rn "NotificationListener" src → فقط تعریف خودش
```
۶ `@OnEvent` مرده: `kyc.approved`, `kyc.rejected`, `order.confirmed`,
`order.shipped`, `order.delivered`, `notification.broadcast`

⚠️ `notification.listener.ts` از deep link **`/profile/kyc`** استفاده می‌کند که
**در `app/` وجود ندارد.** اگر روزی ثبتش کنید، خراب می‌شود.

### B16 — باگ `normalizePersian`
```ts
// common/utils/normalization.ts:11-12
normalized = normalized.replace(/\u064A/g, '\u06CC'); // ي -> ی
normalized = normalized.replace(/\u064B/g, '\u06CC'); // ئ -> ی (تقریبی برای جست‌وجو)
```
🔴 دو مشکل:
1. **کامنت غلط** — `\u064B` فتحه/تنوین است نه «ئ» («ئ» = `\u0626`، در خط ۲۲ جداگانه هندل شده)
2. **ترتیب غلط** — قبل از مرحلهٔ ۳ (حذف اعراب) اجرا می‌شود، پس تنوین به «ی» تبدیل می‌شود

**اثر عملی:** کم (تنوین در فارسی نادیر است).

### B17 — `previousStatus` hardcode
```ts
// orders.service.ts:536
new OrderStatusChangedEvent(userId, orderId, result.orderNumber, 'PENDING', 'CANCELLED')
//                                                                   ↑ باید exists.status باشد
```
⚠️ مقایسه کنید با `orders.service.ts:601` که درست `exists.status` را می‌فرستد.

### B21 — ✅ `app/checkout.tsx` route یتیم — **رفع شد (P2، فایل حذف شد)**
```bash
$ grep -rn "checkout" wholesale-mobile/app wholesale-mobile/src
→ هیچ نتیجه‌ای خارج از خود checkout.tsx
```
**۳۳۳ خط کد مرده.** مسیر واقعی: `cart.tsx:134` → `handlePlaceOrder`.

> **رفع (P2):** فایل با دستور صریح مالک پروژه حذف شد. پیش از حذف تأیید شد:
> صفر ارجاع ورودی، هیچ `Stack.Screen name="checkout"` در `_layout.tsx`، و
> **هیچ functionality منحصربه‌فردی** که لازم باشد منتقل شود (آدرس را هاردکد
> می‌کرد، `shipping = 0` هاردکد، و `idempotencyKey` می‌ساخت ولی ارسال نمی‌کرد).
> قابلیت **Repeat Order** در ۴ نقطهٔ مستقل (`cart`/`home`/`profile`/`orders/[id]`)
> پیاده شده و هیچ‌کدام در این فایل نبود ⇒ دست‌نخورده و سالم.
>
> ⚠️ `.expo/types/router.d.ts` یک فایل **generated** است (در `.gitignore`) که
> تا بازسازی، `/checkout` را در تایپ‌ها نگه می‌دارد. با `expo start` از نو
> ساخته می‌شود.
>
> ⚠️ کامنت `eslint.config.js:20` هنوز به «تولید idempotency key در checkout»
> ارجاع می‌دهد. فقط یک کامنت توضیحی است (override نیست) و دست‌نخورده ماند.

### B22 — دو صفحهٔ stub
```
app/(profile)/favorites.tsx
app/(profile)/notification-settings.tsx
  → grep "Api\.|useAuth|useCart|useFavorites" → همه صفر
```
⚠️ صفحات `info-*` هم صفر API call دارند ولی **عمدی** است (محتوای ثابت) — اشتباه نگیرید.

⚠️ تنظیمات اعلان‌ها **هیچ‌جا ذخیره نمی‌شوند** (فقط `useState`).

### B23 — `notificationRouting.ts` مرده
```bash
$ grep -rn "notificationRouting" wholesale-mobile/app wholesale-mobile/src
→ فقط تعریف خودش
```
**اثر:** کلیک روی نوتیفیکیشن هیچ routing نمی‌کند.

⚠️ همچنین **دو فرمت `deepLink` ناسازگار** در DB:
- `admin.service.ts:141,155` → `{ screen: 'products_list', params: {} }`
- `notification-templates.ts` → `"/orders/123"`

### B24 — `useForceUpdate` مرده
```
app/_layout.tsx:17  → import { useForceUpdate } from "@/hooks/useForceUpdate";
grep "useForceUpdate(" → 0 فراخوانی
```

### B25 — `logout` سرور را صدا نمی‌زند
```ts
// AuthContext.tsx:179-199
const logout = async () => {
  if (customer?.id) await notificationsApi.removePushToken().catch(() => {});
  await authStorage.clearAll();
  ...
};
// ❌ هیچ POST /auth/logout نیست
```
**اثر:** توکن JWT تا ۷ روز معتبر می‌ماند.
⚠️ تنها جایی که `POST /auth/logout` صدا زده می‌شود **پنل ادمین** است.

### B28 — import مردهٔ `Fonts`
```ts
// app/(tabs)/orders.tsx:15
import Fonts from '../_layout';
// app/_layout.tsx:151 → export default Sentry.wrap(RootLayout);
```
`grep -c "Fonts\." "app/(tabs)/orders.tsx"` → **0**

🔴 یعنی `Fonts` در واقع یک **کامپوننت React پیچیده‌شده با Sentry** است + import چرخه‌ای.

### B29 — بدهی فنی طراحی

**۴ پالت رنگ موازی** (مقادیر hex یکسان، نام کلید متفاوت):
| فایل | نام | تعداد کلید |
|---|---|---|
| `src/constants/theme.ts:3` | `COLORS` | ۲۴ |
| `app/(tabs)/home.tsx:37` | `C` | ۱۶ |
| `app/(tabs)/browse.tsx:34` | `COLORS` | ۱۰ |
| `app/(profile)/notification-settings.tsx:8` | `C` | ۷ |

نام‌های متضاد: `surface` ↔ `card` · `primaryExtraLight` ↔ `primaryXLight` · `warningLight` ↔ `warningBg`

**۲ export با نام `Fonts`:**
| فایل | ساختار |
|---|---|
| `src/utils/fonts.ts` | `{ light, regular, medium, semiBold, bold, extraBold }` (وزن‌ها) |
| `src/constants/theme.ts:72` | `Platform.select({ ios: {sans,serif,rounded,mono}, ... })` (خانواده‌ها) |

**۲ مجموعه فاصله با مقادیر متضاد:**
```ts
SPACING.s3 = 12      Spacing.three = 16     ← 🔴 متفاوت!
```

**رنگ‌های hardcode بیرون از پالت‌ها:**
`app/(tabs)/_layout.tsx:17,18,59` · `notification-settings.tsx:21`

### B30 — `ErrorBoundary.tsx`
```ts
const API = 'http://10.75.109.83:3000';   // ← hardcode، و با .env نمی‌خواند
...
catch {}                                   // ← خالی، بی‌صدا
```

---

## بخش ۴ — تناقض‌های بین فایل‌ها

`CONFIRMED` این‌ها **پنهان نشده‌اند** — طبق درخواست کاربر صریحاً ثبت شده‌اند:

### تناقض ۱ — تعداد تست
| منبع | ادعا |
|---|---|
| `docs/ai-handover/*.md` (نسخهٔ قبلی) | «Jest 3/3» — **۸ بار** |
| کامیت `b9797ae` | «jest 3/3 green» ✅ در آن زمان درست بود |
| کامیت `7b72446`, `020d603` | «jest 18/18» |
| **اجرای واقعی من** | ✅ **۴ suite / ۱۸ تست، همه pass** |

**نتیجه:** مستندات قدیمی **منسوخ** بودند، نه دروغ. از کامیت `7b72446` به بعد ۱۸ تست است.

### تناقض ۲ — ۹ فایل ارجاع‌شدهٔ ناموجود
نسخهٔ قبلی این مستندات به این فایل‌ها ارجاع می‌داد:
```
RELEASE-PROGRESS.md  CLAUDE.md  CONTINUATION-PROMPT.md  ARCHITECTURE.md
PERFORMANCE.md       README.md  RELEASE-CHECKLIST.md    OTA-GUIDE.md
WSL2-LOCAL-BUILD.md
```
`CONFIRMED` **هیچ‌کدام در snapshot نیستند** (در HEAD گیت هستند، روی دیسک نه).

### تناقض ۳ — تعداد هشدار lint موبایل
| منبع | ادعا |
|---|---|
| مستندات قبلی | ۱۳۷ |
| **اجرای واقعی من** | ✅ **۱۴۰** |

### تناقض ۴ — IP در موبایل
```
wholesale-mobile/.env           → 10.73.183.83
src/api/httpClient.ts (DEV_IP)  → 10.75.109.83
src/components/ui/ErrorBoundary → 10.75.109.83
```
`CONFIRMED` کاربر صریحاً گفته «`.env` را به خودم بسپار».

### تناقض ۵ — نام فروشگاه
```
main.ts (Swagger title)          → 'Bonko Market API'
orders.service.getInvoice        → 'بنکو مارکت'      (hardcode)
admin.controller (چاپ فاکتور)    → settings.STORE_NAME || 'بنکو پخش'
public/admin/index.html          → 'پنل مدیریت بنکو مارکت'
app/welcome.tsx                  → 'به بنکو مارکت عمده خوش آمدید'
```

### تناقض ۶ — دو کامپوننت نمایش قیمت
```
src/components/product/PriceBox.tsx   (159 خط) — سه حالت کسب‌وکاری
src/components/PriceDisplay.tsx                 — رقیب
```
`UNVERIFIED` — کدام واقعاً import می‌شود را بررسی کنید.

### تناقض ۷ — دو مجموعه endpoint تکراری
| عملکرد | مسیر اول | مسیر دوم |
|---|---|---|
| ویرایش پروفایل | `PATCH /auth/profile` (با DTO) | `PATCH /user/profile` (**بدون DTO**) |
| آپلود تصویر محصول | `POST /files/product` | `POST /admin/upload/product` |
| آپلود تصویر دسته | `POST /files/category` | `POST /admin/upload/category` |
| علاقه‌مندی | `POST /products/:id/favorite` | `POST /products/toggle-favorite` + `POST /favorites/toggle` |

⚠️ تفاوت آپلود: نسخهٔ `admin/*` وقتی فایل نیست `{ error: 'no file' }` با **200** می‌دهد،
نه `BadRequestException`.

### تناقض ۸ — enum پرداخت در موبایل
```
schema.prisma PaymentMethod → CASH_ON_DELIVERY · CARD_TO_CARD · ZARRINPAL · ZIBAL
موبایل src/constants/enums.ts → فقط CARD_TO_CARD · ZARRINPAL · ZIBAL
```
🔴 **تنها روش پرداخت واقعی در enum موبایل غایب است.**

### تناقض ۹ — دو الگوی کسر موجودی
```
orders.service.ts:355              → tx.product.update(...)  + catch P2025
visitor-sales.service.ts:196       → tx.product.updateMany(...) + res.count === 0
```

### تناقض ۱۰ — دو الگوی خطای موجودی
```
orders.service.ts        → UnprocessableEntityException (422) + ساختار warnings
visitor-sales.service.ts → ForbiddenException (403) + پیام رشته‌ای
```
⚠️ `ForbiddenException` برای «موجودی کافی نیست» **نوع خطای غلط** است.

---

## بخش ۵ — چیزهایی که `UNVERIFIED` باقی می‌مانند

| مورد | چرا verify نشد |
|---|---|
| اعمال ۱۶ migration روی Postgres | نه docker، نه root برای نصب |
| اجرای اپ موبایل | `assets/` موجود نیست |
| رفتار `@Cron(process.env.BACKUP_INTERVAL)` | سرور اجرا نشد |
| رفتار rollback در `$transaction` | DB واقعی نبود (بر اساس مستندات Prisma استنباط شد) |
| اینکه `defaultProps` در React 19.2 کار می‌کند | اپ اجرا نشد |
| اینکه `POST /cart/merge` واقعاً بعد از لاگین صدا زده می‌شود | ✅ **بعداً تأیید شد** — در `CartContext` init |
| XSS در `innerHTML` پنل ادمین | سانیتایز بودن تأیید نشد |
| کارکرد `expo-build-properties@57` روی SDK 56 | build گرفته نشد |
| فهرست کامل کلیدهای `Setting` | DB واقعی نبود |

⚠️ **نکتهٔ مهم:** کامیت‌های `2ec4761`، `7b72446`، `020d603` و `f11b7f8` نشان می‌دهند
توسعه‌دهنده **روی PostgreSQL واقعی و build واقعی verify کرده**.
پس این موارد احتمالاً در محیط او درست کار می‌کنند — فقط **من** نتوانستم تأیید کنم.
