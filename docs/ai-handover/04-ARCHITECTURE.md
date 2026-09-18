# 04 — ARCHITECTURE

---

## 1. نمای سطح بالای سیستم

```
┌──────────────────────────────────────────────────────────────────┐
│                        کلاینت‌ها                                   │
│                                                                   │
│  ┌────────────────┐          ┌──────────────────────────────┐     │
│  │  اپ Expo       │          │  پنل ادمین (Vanilla JS)      │     │
│  │  wholesale-    │          │  /admin/*                    │     │
│  │  mobile/       │          │  static از بک‌اند سرو می‌شود  │     │
│  │                │          │                              │     │
│  │ axios          │          │ fetch (core.js → http())     │     │
│  └───────┬────────┘          └───────────────┬──────────────┘     │
└──────────┼───────────────────────────────────┼────────────────────┘
           │  Bearer JWT                       │  Bearer JWT
           ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  wholesale-api  (NestJS 11 / Express 5)           │
│                                                                   │
│  main.ts                                                          │
│   ├─ Sentry.init (فقط اگر SENTRY_DSN باشد)                        │
│   ├─ ValidationPipe { whitelist, forbidNonWhitelisted, transform }│
│   ├─ CORS (allowlist از CORS_ORIGINS یا ۳ origin پیش‌فرض)         │
│   ├─ useStaticAssets(public/admin, prefix '/admin')               │
│   ├─ mkdir uploads/{kyc,products,categories}                      │
│   ├─ 🛡️ /docs + /docs-json → فقط localhost (404 برای بقیه)        │
│   └─ listen(PORT, '0.0.0.0')                                      │
│                                                                   │
│  AppModule (17 ماژول دامنه + 4 ماژول زیرساختی)                    │
│   ├─ ConfigModule.forRoot({isGlobal})                            │
│   ├─ ThrottlerModule.forRoot([{ttl:60000, limit:60}]) ⚠️ inert    │
│   ├─ ScheduleModule.forRoot()      → @Cron بکاپ                   │
│   ├─ EventEmitterModule.forRoot()  → رویدادهای order/kyc          │
│   └─ ۱۷ ماژول دامنه                                                │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Prisma Client (بدون لایه Repository)
                            ▼
                  ┌───────────────────┐
                  │  PostgreSQL 16    │  ← docker-compose.yml
                  └───────────────────┘
                            +
                  ┌───────────────────┐
                  │  filesystem       │  ← uploads/ (kyc, products, categories)
                  │  backups/         │  ← خروجی cron بکاپ
                  └───────────────────┘
                            +
              ┌─────────────┴──────────────┐
              │ سرویس‌های خارجی             │
              │  ملی‌پیامک (SOAP/WSDL)      │
              │  Expo Push (expo-server-sdk)│
              │  Sentry (فعلاً غیرفعال)     │
              └────────────────────────────┘
```

`CONFIRMED` — همهٔ جزئیات بالا مستقیماً از `wholesale-api/src/main.ts` و `app.module.ts` خوانده شده.

---

## 2. معماری بک‌اند

### ۲-۱. الگو: NestJS استاندارد، **بدون لایهٔ Repository**

```
Request
  → Controller      (route + guard + DTO)
      → Service     (منطق کسب‌وکار)
          → PrismaService.<model>.*   ← ⚠️ مستقیم، بدون واسطه
```

`CONFIRMED` هیچ فایل `*.repository.ts` در پروژه وجود ندارد.
سرویس‌ها مستقیماً `this.prisma.product.findMany(...)` را صدا می‌زنند.

> **پیامد:** منطق دیتابیس و منطق کسب‌وکار در هم تنیده‌اند.
> اگر می‌خواهید تست unit بنویسید، باید `PrismaService` را mock کنید
> (کاری که `orders.service.spec.ts` و `auth.service.spec.ts` می‌کنند).

### ۲-۲. `PrismaModule` یک ماژول `@Global` است
```ts
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```
`CONFIRMED` یعنی **هیچ ماژولی لازم نیست `PrismaModule` را import کند** — همه‌جا `PrismaService` در دسترس است.

⚠️ `CONFIRMED` استثنا: `VisitorSalesModule` با این حال `imports: [PrismaModule]` دارد.
بی‌ضرر است (idempotent) ولی **غیرضروری** — نشانهٔ اینکه توسعه‌دهنده مطمئن نبوده.

### ۲-۳. گراف وابستگی ماژول‌ها

```
AppModule
 ├── ConfigModule          (global)
 ├── ThrottlerModule       (global، ولی guard اعمال نشده)
 ├── ScheduleModule        (global)
 ├── EventEmitterModule    (global)
 ├── PrismaModule          (@Global)
 │
 ├── AuthModule ──────┬─► SmsModule
 │                    ├─► NotificationsModule
 │                    └─► JwtModule.registerAsync(ConfigModule)
 │   exports: AuthService, OptionalJwtAuthGuard
 │
 ├── AdminModule ─────┬─► ProductsModule
 │                    ├─► CategoriesModule
 │                    ├─► OrdersModule
 │                    ├─► FilesModule
 │                    ├─► BannersModule
 │                    └─► 🔁 forwardRef(() => AuthModule)   ← چرخه!
 │
 ├── SearchModule ────┬─► ProductsModule
 │                    └─► AuthModule
 │
 ├── VisitorSalesModule ─► PrismaModule (غیرضروری)
 │   controllers: VisitorSalesController, CustomerSearchController, VisitorOrderController
 │
 └── بقیهٔ ماژول‌ها خودکفا: Cart, Categories, Products, Orders, Files,
      Tickets, Notifications, AppVersion, Backup, Banners, Profile, Sms
```

### 🔁 چرخهٔ ماژول — `AdminModule ↔ AuthModule`

`CONFIRMED` `AdminModule` از `forwardRef(() => AuthModule)` استفاده می‌کند.
`AuthModule` مستقیماً `AdminModule` را import **نمی‌کند**.

`INFERRED` پس `forwardRef` احتمالاً برای رفع یک چرخهٔ قبلی اضافه شده یا
برای اطمینان از ترتیب initialize. **حذفش نکنید بدون تست** — ممکن است
در زمان bootstrap خطای DI بدهد.

### ۲-۴. `ProductsModule` دو controller دارد
```ts
@Module({ controllers: [ProductsController, FavoritesController], ... })
```
`CONFIRMED` `FavoritesController` جدا است ولی در همان ماژول.
✅ این همان جایی بود که `GET /products/favorites` رد Prisma خام را leak می‌کرد
→ `15-SECURITY.md` §S6 (رفع شد در P1).
⚠️ تصحیح: پیش از این در همین سند به §S5 ارجاع داده شده بود که غلط بود —
`costPrice` مربوط به **S6** است، نه S5 (که دربارهٔ `testCode` است).

### ۲-۵. `VisitorSalesModule` سه controller دارد
```ts
controllers: [VisitorSalesController, CustomerSearchController, VisitorOrderController]
```
🔴 `CONFIRMED` **تعارض مسیر:** `CustomerSearchController @Get('search')` (فقط JWT)
با `AdminController @Get('customers/search')` (ADMIN) یکی می‌شود.
چون `AdminController` زودتر ثبت می‌شود، **مشتری ۴۰۳ می‌گیرد**.
→ `17-KNOWN-ISSUES.md`.

---

## 3. معماری موبایل

### ۳-۱. الگو: Expo Router + Context + لایهٔ API

```
app/**.tsx (route)
   │  استفاده می‌کند از
   ├──► src/context/*        (AuthContext, CartContext, FavoritesContext)
   ├──► src/components/*     (UI قابل استفاده مجدد)
   ├──► src/hooks/*
   │
   └──► src/api/*Api.ts      ← هر دامنه یک فایل
            │
            └──► src/api/httpClient.ts   ← ⭐ تنها نقطهٔ خروج
                     ├── axios instance + baseURL
                     ├── request interceptor (افزودن Bearer)
                     ├── response interceptor (401 → logout)
                     └── retry / timeout
```

### ۳-۲. سلسله‌مراتب providerها
`CONFIRMED` — دقیقاً از `app/_layout.tsx:129-148` (نسخهٔ فعلی، با تغییرات commit‌نشده):

```
Sentry.wrap(RootLayout)                     ← export default، خط ۱۵۱
└─ StatusBar style="dark"
   Sentry.ErrorBoundary fallback={SentryFallback}
   └─ AuthProvider                          ← خط ۱۳۳
      └─ CartProvider                       ← خط ۱۳۴ (به AuthContext وابسته)
         └─ FavoritesProvider               ← خط ۱۳۵
            └─ SafeAreaProvider             ← خط ۱۳۶
               └─ SafeAreaView edges=[top,left,right,bottom]
                  ├─ FontApplied            ← فونت پیش‌فرض روی RNText/RNTextInput
                  ├─ OfflineBanner          ← از NetInfo
                  └─ RootNavigator          ← Stack (expo-router)
                     └─ Stack.Screen × 5: index, welcome, (auth), onboarding, (tabs)
```

⚠️ `CONFIRMED` نکات:
- **`GestureHandlerRootView` وجود ندارد** — با اینکه `react-native-gesture-handler` نصب است.
- `SafeAreaProvider` **داخل** providerهای context است (برعکس حالت معمول).
- `initialRouteName="(tabs)"` روی Stack تنظیم شده (خط ۹۰).
- `headerShown: false` برای همهٔ صفحه‌ها.

⚠️ **ترتیب مهم است.** `CartProvider` باید داخل `AuthProvider` باشد.

### ۳-۳. سبد خرید — یک مسیر، دو لایه (مهم!)

`CONFIRMED` از `src/context/CartContext.tsx` — **مهمان سبد خرید ندارد**:

```ts
// خط ۱۶۷ (addToCart)
if (!isLoggedIn) return { ok: false, message: 'برای افزودن به سبد باید وارد شوید' };
// خط ۱۲۵-۱۲۷ (init) — اگر لاگین نباشد، سبد محلی پاک می‌شود
else { setItems([]); await cartStorage.clearCart(); }
```

| | سمت موبایل | سمت سرور |
|---|---|---|
| فایل | `src/context/CartContext.tsx` | `wholesale-api/src/cart/cart.service.ts` |
| ذخیره‌سازی | `cartStorage` (**cache**) | جدول `CartItem` (**منبع حقیقت**) |
| کی پر می‌شود | فقط وقتی `isLoggedIn` | همیشه برای کاربر لاگین‌شده |
| همگام‌سازی | در init: `POST /cart/merge` با آیتم‌های محلی |

✅ `CONFIRMED` merge **پیاده‌سازی شده** — در `useEffect` اولیهٔ `CartContext` (خط ۱۰۷-۱۳۳)،
نه در `AuthContext.login`.

> **قاعده:** هر تغییری در ساختار آیتم سبد باید **در هر دو جا** اعمال شود
> (`src/types/cart.ts` و `cart.service.ts`)، وگرنه `serverCartToLocal` خراب می‌شود.

---

## 4. معماری پنل ادمین

`CONFIRMED` **بدون build، بدون framework، بدون ماژول.**

```
index.html
   ↓ <script> به ترتیب
core.js      ← global: http(), api helpers, auth (token), toast(), fmt(), ...
orders.js    ← global: renderOrders(), ...
products.js  ← global: renderProducts(), renderCategories(), renderBanners(), ...
visitor-sales.js ← global: renderVisitorSales(), ...
app.js       ← global: renderLayout(), router (hash-based), bootstrap()
```

### ۴-۱. الگوی view
هر view یک global function است که HTML می‌سازد و در یک container تزریق می‌کند.
`app.js` بر اساس `location.hash` تصمیم می‌گیرد کدام را صدا بزند.

### ۴-۲. احراز هویت پنل
`CONFIRMED` پنل ادمین **همان** endpointهای OTP مشتری را صدا می‌زند
(`/auth/request-otp` → `/auth/verify-otp`). نقش ادمین از payload JWT می‌آید.

🔴 `CONFIRMED` `core.js getAuthToken()` سعی می‌کند کوکی HttpOnly را با
`document.cookie` بخواند — که **غیرممکن** است. همیشه به fallback (localStorage) می‌رسد.
→ `15-SECURITY.md`.

### ۴-۳. CORS
`CONFIRMED` پنل از **همان origin** بک‌اند سرو می‌شود (`/admin`)،
پس CORS برایش مسئله نیست. فقط موبایل (و `localhost:19006`) به allowlist نیاز دارند.

---

## 5. معماری داده

```
User (auth identity)  1 ──── 1  Customer (business profile)
   │                              │
   │                              ├── 1:N Order ── 1:N OrderItem ── N:1 Product
   │                              ├── 1:N CartItem
   │                              ├── 1:N Ticket ── 1:N TicketMessage
   │                              ├── 1:N Notification
   │                              └── 1:N Favorite ── N:1 Product
   │
   └── role: CUSTOMER | ADMIN | VISITOR

Product N:1 Category (self-referential tree)
Banner (مستقل)
Setting (key-value برای تنظیمات پنل)
```

`CONFIRMED` ۲۲ مدل و ۱۲ enum در `prisma/schema.prisma`. جزئیات کامل → `10-DATABASE.md`.

### ۵-۱. اصل طراحی: `User` ≠ `Customer`
`CONFIRMED` تفکیک عمدی:
- `User` = هویت احراز هویت (شماره تلفن، نقش، lastLoginAt)
- `Customer` = پروفیل کسب‌وکاری (نام فروشگاه، KYC، status، آدرس)

⚠️ **`Customer.status`** (نه `User`) تعیین می‌کند کاربر می‌تواند خرید کند یا نه.

---

## 6. معماری رویدادها (Event Emitter)

`CONFIRMED` ماتریس کامل رویدادها:

| رویداد | منتشرشده از | شنونده | وضعیت |
|---|---|---|---|
| `order.created` | `orders.service.ts:399` | `NotificationEventsListener:52` | ✅ کار می‌کند |
| `order.status.changed` | `orders.service.ts:534` و `:601` | `NotificationEventsListener:57` | ✅ کار می‌کند |
| `kyc.submitted` | `auth.service.ts:370` | `NotificationEventsListener:65` | ✅ کار می‌کند |
| `notification.broadcast` | `admin.service.ts:356` | `NotificationEventsListener:79` | ✅ کار می‌کند |
| `kyc.status.changed` | ❌ **هرگز منتشر نمی‌شود** | `NotificationEventsListener:70` | ⚠️ شنوندهٔ مرده |
| `kyc.approved` | `admin.service.ts:146` | فقط در `notification.listener.ts` (**ثبت‌نشده**) | 🔴 **بدون شنونده** |
| `kyc.rejected` | `admin.service.ts:159` | فقط در `notification.listener.ts` (**ثبت‌نشده**) | 🔴 **بدون شنونده** |
| `order.confirmed` | ❌ هرگز منتشر نمی‌شود | `notification.listener.ts:34` | ⚠️ مرده |
| `order.shipped` | ❌ هرگز منتشر نمی‌شود | `notification.listener.ts:46` | ⚠️ مرده |
| `order.delivered` | ❌ هرگز منتشر نمی‌شود | `notification.listener.ts:58` | ⚠️ مرده |

### 🔴 پیامد عملی و تأییدشده
`CONFIRMED` `notifications.module.ts` فقط `NotificationEventsListener` را در
`providers` دارد. فایل `notification.listener.ts` (کلاس `NotificationListener`)
**هیچ‌جا import نشده** (`grep -rn "NotificationListener"` → فقط تعریف خودش).

> **نتیجهٔ دقیق:** وقتی ادمین حساب یک مشتری را **تایید** یا **رد** می‌کند،
> `admin.service.ts:124-162` (`updateCustomerStatus`) **مستقیماً** یک
> نوتیفیکیشن in-app در DB می‌سازد (`prisma.notification.create`) — پس کاربر
> **در اپ نوتیفیکیشن را می‌بیند**.
>
> 🔴 ولی رویداد `kyc.approved` / `kyc.rejected` که بلافاصله بعدش منتشر می‌شود
> **شنونده ندارد** → **Push notification فرستاده نمی‌شود.**
> یعنی کاربر فقط وقتی خودش اپ را باز کند می‌فهمد؛ پیام روی lock screen نمی‌آید.
>
> ✅ تغییر وضعیت **سفارش** درست کار می‌کند (هم in-app هم push).

### ⚠️ دو فرمت متفاوت `deepLink` در DB
`CONFIRMED` هر دو در ستون `Notification.deepLink` (نوع `Json`) نوشته می‌شوند:

| منبع | فرمت |
|---|---|
| `admin.service.ts:141` | `{ screen: 'products_list', params: {} }` |
| `admin.service.ts:155` | `{ screen: 'account', params: {} }` |
| `notification-templates.ts` | `"/orders/123"` (رشتهٔ مسیر expo-router) |

🔴 **این دو فرمت با هم ناسازگارند.** هر مصرف‌کننده‌ای باید هر دو را هندل کند.
`UNVERIFIED` — سمت موبایل هیچ‌کدام را مصرف نمی‌کند (`notificationRouting.ts` مرده است).

---

## 7. جریان request در بک‌اند (به ترتیب واقعی)

```
1. Express 5 middleware (CORS، body parser)
2. Sentry middleware          ← فقط اگر SENTRY_DSN باشد (الان نیست)
3. static assets              ← /admin/*، و ...
4. /docs localhost guard      ← main.ts:85-92
5. NestJS route matching
6. Guard:
     ThrottlerGuard           ← ⚠️ اعمال نشده
     JwtAuthGuard             ← @UseGuards(JwtAuthGuard)
     RolesGuard               ← @Roles(...) — ⚠️ در visitor-sales نیست
7. ValidationPipe             ← DTO → instance (whitelist + forbidNonWhitelisted)
8. @GetUser() decorator       ← req.user (از JwtStrategy.validate)
9. Controller method
10. Service (منطق + Prisma transaction)
11. EventEmitter.emit (در .then بعد از commit تراکنش)
12. Response / HttpException → SentryFilter (غیرفعال) → JSON error
```

### ۷-۱. `JwtStrategy.validate()` هر request به DB می‌زند
`CONFIRMED` این یک تصمیم آگاهانه است تا ادمین بتواند بلافاصله دسترسی را قطع کند.

> **پیامد کارایی:** هر درخواست احراز هویت = ۱ کوئری اضافه.
> **پیامد امنیتی:** مثبت — توکن دزدیده‌شده بعد از block شدن کاربر کار نمی‌کند.

---

## 8. تصمیم‌های معماری که باید حفظ شوند

`CONFIRMED` این‌ها با کامنت صریح در کد مستند شده‌اند:

### ۸-۱. کسر موجودی با update شرطی (نه `SELECT ... FOR UPDATE`)
`orders.service.ts:34-40`:
```ts
// Prisma از lock/pessimistic_write در findMany پشتیبانی نمی‌کند
await tx.product.update({
  where: { id: p.id, stock: { gte: item.quantity } },
  data:  { stock: { decrement: item.quantity } },
});
```
✅ **اتمیک در سطح DB.** اگر `update` صفر رد را تحت تأثیر قرار دهد → موجودی کافی نبوده → rollback.

### ۸-۲. سبد خرید با `ref` به‌جای `state`
`CartContext.tsx:65-67`:
```
// کلید حل مشکل: از ref استفاده کن، نه state
// itemsRef.current همیشه آخرین مقدار را دارد
```
✅ حل stale closure در optimistic update.

### ۸-۳. فایل‌های KYC از static مستقیم سرو نمی‌شوند
`main.ts:64-66`:
```
// فایل‌های uploads/kyc فقط برای ادمین از طریق FilesController سرو می‌شوند.
// (از استاتیک مستقیم استفاده نمی‌کنیم تا CORS/header کنترل شده باشد.)
```
✅ **تصویرهای مدارک ملی پشت احراز هویت‌اند.** `useStaticAssets` فقط برای `/admin` است.

### ۸-۴. `/docs` با `remoteAddress` محافظت می‌شود، نه هدر `Host`
`main.ts:81-84`:
```
// بررسی روی آدرس TCP واقعی اتصال انجام می‌شود (با جعل هدر Host قابل دورزدن نیست).
// پاسخ مسدودها 404 است (نه 403) تا وجود /docs قابل تشخیص نباشد.
```
⚠️ `INFERRED` **اگر پشت reverse proxy باشید، `remoteAddress` آدرس proxy می‌شود**
(مثلاً `127.0.0.1`) و `/docs` برای همه باز می‌شود. هنگام دیپلوی با nginx این را چک کنید.

### ۸-۵. رویدادها **بعد از** commit تراکنش منتشر می‌شوند
`orders.service.ts:399` داخل `.then(...)` بعد از `this.prisma.$transaction(...)` است.
✅ اگر نوتیفیکیشن قبل از commit برود و تراکنش rollback شود، نوتیفیکیشن غلط فرستاده می‌شد.

---

## 9. مرزهای مسئولیت (چه چیزی کجا زندگی می‌کند)

| موضوع | منبع حقیقت |
|---|---|
| اینکه کاربر می‌تواند خرید کند | `Customer.status === 'APPROVED'` در DB |
| نمایش قیمت | `PriceBox.tsx` (UI) — 🔴 نه API |
| موجودی | `Product.stock` در DB (کسر اتمیک) |
| مبلغ کل سفارش | `Order.totalAmount` (محاسبه در `orders.service`) |
| سبد خرید مهمان | AsyncStorage (موبایل) |
| سبد خرید لاگین‌شده | جدول `CartItem` |
| تنظیمات پنل ادمین | جدول `Setting` (key-value) |
| محدودیت جغرافیایی | `complete-onboarding.dto.ts` (hardcode) |
| الگوهای نوتیفیکیشن | `notifications/constants/notification-templates.ts` |
| رنگ/فونت موبایل | 🔴 **سه منبع متضاد** → `17-KNOWN-ISSUES.md` |
