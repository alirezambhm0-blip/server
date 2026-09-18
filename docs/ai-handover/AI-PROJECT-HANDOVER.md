# 🧠 AI PROJECT HANDOVER — Bonko Market

> **این مهم‌ترین فایل پروژه است. قبل از هر کاری این را کامل بخوانید.**
>
> هدف این مجموعه مستندات: یک AI جدید بدون تحلیل دوبارهٔ کل پروژه، ساختار، معماری، جریان‌ها،
> وابستگی‌ها و قوانین مهم را بفهمد و فقط برای جزئیات خاص به سورس‌کد مراجعه کند.
>
> **تاریخ تولید:** 2026-09-07 · **بازنویسی کامل بر اساس کد واقعی** (نسخهٔ قبلی این پوشه حاوی
> اطلاعات نادرست بود — به `00-START-HERE.md` §«چرا بازنویسی شد» مراجعه کنید)

---

## 📌 برچسب‌های اعتبار اطلاعات

در کل این مستندات، هر ادعا یکی از این سه برچسب را دارد:

| برچسب | معنا |
|---|---|
| `CONFIRMED` | مستقیماً از کد خوانده شده یا با اجرای دستور/تست تأیید شده |
| `INFERRED` | از کد استنباط شده ولی مستقیماً تأیید نشده |
| `UNVERIFIED` | در این محیط قابل تأیید نبود (مثلاً نیاز به دیتابیس واقعی) |

**اگر چیزی را در این مستندات پیدا نکردید، فرض نکنید وجود دارد.** اول در سورس بگردید؛
اگر نبود، صریحاً `NOT FOUND` بنویسید.

---

## 1. پروژه چیست

`CONFIRMED` **Bonko Market** — یک پلتفرم **عمده‌فروشی B2B فارسی‌زبان** (RTL) برای بازار ایران.

مشتریان، فروشگاه‌داران هستند که پس از **احراز هویت (KYC)** و **تایید دستی توسط ادمین**،
می‌توانند قیمت‌های عمده را ببینند و سفارش ثبت کنند. پرداخت **فقط درب محل (COD)** است.

سه بخش دارد:

| بخش | مسیر | نقش |
|---|---|---|
| **API** | `wholesale-api/` | بک‌اند NestJS — منبع حقیقت داده و منطق کسب‌وکار |
| **Mobile** | `wholesale-mobile/` | اپ Expo Router برای مشتریان (Android/iOS/Web) |
| **Admin Panel** | `wholesale-api/public/admin/` | پنل مدیریت Vanilla JS که **از همان API** تغذیه می‌شود |

`CONFIRMED` **نکتهٔ حیاتی کسب‌وکاری:** قیمت‌ها عمداً از کاربران تاییدنشده پنهان می‌شوند.
این یک نیازمندی محصول است، نه یک جزئیات UI.

`CONFIRMED` **محدودیت جغرافیایی:** خدمات فقط در **استان زنجان** و ۴ شهر
`ابهر / خرمدره / هیدج / صائین‌قلعه` ارائه می‌شود. این در DTO سخت‌کد شده
(`wholesale-api/src/auth/dto/complete-onboarding.dto.ts` → `@Equals('زنجان')` + `@IsIn([...])`).

---

## 2. Stack چیست

### بک‌اند — `wholesale-api/package.json` `CONFIRMED`
```
NestJS 11  ·  Prisma 5.22  ·  PostgreSQL  ·  TypeScript 5.7 (ES2023, NodeNext)
JWT (@nestjs/jwt 11) + Passport  ·  class-validator  ·  @nestjs/swagger 11
@nestjs/event-emitter  ·  @nestjs/schedule  ·  @nestjs/throttler (⚠️ غیرفعال)
soap (MeliPayamak SMS)  ·  expo-server-sdk (Push)  ·  sharp (تصویر)  ·  @sentry/node
jest 30 + ts-jest  ·  eslint 9 + prettier
```

### موبایل — `wholesale-mobile/package.json` `CONFIRMED`
```
Expo SDK 56 (~56.0.13)  ·  React 19.2.3  ·  React Native 0.85.3
expo-router ~56.2.12 (file-based routing)  ·  TypeScript 6.0 (strict)
react-native-reanimated 4.3.1  ·  expo-secure-store  ·  AsyncStorage
expo-notifications  ·  expo-updates (OTA)  ·  @sentry/react-native 7.11
react-native-web 0.21 (خروجی وب)
```

### پنل ادمین — `wholesale-api/public/admin/` `CONFIRMED`
```
Vanilla JS (ES5-style)  ·  بدون framework  ·  بدون build step
۵ فایل با ترتیب لود حیاتی: core.js → orders.js → products.js → visitor-sales.js → app.js
```

### زیرساخت
`CONFIRMED` `docker-compose.yml` فقط **Postgres 16** را بالا می‌آورد (کانتینر `wholesale_postgres`).
`CONFIRMED` OTA با **EAS Update** (کانال‌های `preview` و `production` در `eas.json`).

---

## 3. ساختار اصلی پروژه

```
/
├── docker-compose.yml              → فقط Postgres
├── package.json                    → فقط @expo/ngrok (devDep)
├── docs/ai-handover/               → همین مستندات
│
├── wholesale-api/                  → 7,964 خط TS در src/
│   ├── src/
│   │   ├── main.ts                 ← ⭐ Entry Point بک‌اند
│   │   ├── app.module.ts           ← ⭐ 17 ماژول دامنه + 4 زیرساختی
│   │   ├── admin/                  ← بزرگ‌ترین (controller 648 + service 418 خط)
│   │   ├── auth/ + dto/            ← service 599 خط
│   │   ├── orders/                 ← ⭐ service 760 خط (بزرگ‌ترین فایل)
│   │   ├── products/ + dto/        ← service 474 خط
│   │   ├── cart/ + dto/            ← service 261 خط
│   │   ├── categories/ + dto/
│   │   ├── notifications/ + dto/ events/ constants/
│   │   ├── search/  tickets/+dto/  profile/  banners/
│   │   ├── files/   sms/   backup/   app-version/   visitor-sales/
│   │   ├── prisma/                 ← PrismaService (@Global)
│   │   └── common/                 ← sentry.filter, too-many-requests.exception, utils/normalization
│   ├── prisma/
│   │   ├── schema.prisma           ← ⭐ 22 مدل، 12 enum
│   │   ├── seed.ts
│   │   └── migrations/             ← 16 migration
│   ├── public/admin/               ← ⭐ پنل ادمین (3,827 خط)
│   ├── scripts/migrate-kyc.ts
│   └── .env  .env.example  .env.test
│
└── wholesale-mobile/               → 13,514 خط TS/TSX
    ├── app/                        ← ⭐ 28 route + 5 _layout (expo-router)
    │   ├── _layout.tsx             ← Entry Point موبایل
    │   ├── index.tsx               ← Redirect مرکزی
    │   ├── (auth)/  (tabs)/  (profile)/
    │   ├── notifications/  orders/  tickets/
    │   └── product-detail, search, onboarding, checkout, edit-profile, welcome
    ├── src/
    │   ├── api/                    ← 12 ماژول + httpClient.ts ⭐
    │   ├── context/                ← Auth, Cart, Favorites ⭐
    │   ├── storage/                ← authStorage (SecureStore) ⭐, cartStorage
    │   ├── components/             ← product/ search/ ui/ onboarding/
    │   ├── hooks/  types/  constants/  utils/
    │   └── assets/fonts/           ← 6 فونت Vazirmatn
    └── app.json  eas.json  babel.config.js  tsconfig.json
```

📄 **جزئیات کامل:** `03-PROJECT-STRUCTURE.md`

---

## 4. برنامه از کجا شروع می‌شود

### بک‌اند — `wholesale-api/src/main.ts` `CONFIRMED`
```
bootstrap():
 1. NestFactory.create<NestExpressApplication>(AppModule)
 2. اگر SENTRY_DSN ست باشد → Sentry.init() + useGlobalFilters(SentryFilter)
 3. ValidationPipe سراسری: { whitelist:true, forbidNonWhitelisted:true, transform:true }
 4. CORS از env CORS_ORIGINS (کاما-جدا) · credentials:true · headers: Content-Type, Authorization
 5. useStaticAssets(public/admin, { prefix:'/admin' })
 6. ساخت خودکار uploads/{kyc,products,categories}
 7. Swagger روی /docs و /docs-json — فقط از 127.0.0.1/::1 (بقیه 404 می‌گیرند)
 8. app.listen(PORT||3000, '0.0.0.0')
```

### موبایل — `wholesale-mobile/app/_layout.tsx` `CONFIRMED`
```
package.json → "main": "expo-router/entry"

سطح ماژول:  SplashScreen.preventAutoHideAsync()  ·  Sentry.init({enabled:!__DEV__})
RootLayout: useFonts(6 وزن Vazirmatn) → تا لود فونت null رندر می‌شود
درخت Provider (بیرون → داخل):
  StatusBar → Sentry.ErrorBoundary → AuthProvider → CartProvider → FavoritesProvider
  → SafeAreaProvider → SafeAreaView → FontApplied + OfflineBanner + RootNavigator
export default Sentry.wrap(RootLayout)
```

### پنل ادمین — `wholesale-api/public/admin/index.html` `CONFIRMED`
```
core.js → orders.js → products.js → visitor-sales.js → app.js
app.js: render() → اگر state.token نبود renderLogin()، وگرنه renderLayout()
```

📄 **جزئیات:** `05-APP-STARTUP-FLOW.md`

---

## 5. Navigation چگونه کار می‌کند

### موبایل — expo-router (file-based)
`CONFIRMED` ساختار route:
```
app/index.tsx          → Redirect بر اساس authStatus (بدون UI)
app/welcome.tsx        → صفحهٔ تصمیم: ورود / ادامه به‌عنوان مهمان
app/(auth)/            → login.tsx, otp.tsx
app/onboarding.tsx     → فرم KYC (798 خط)
app/(tabs)/            → home, browse, cart, orders, profile
app/(profile)/         → edit-address, favorites, store-info,
                         notification-settings, info-{about,faq,guide,privacy,terms}
app/notifications/     → index
app/orders/            → [id], success
app/tickets/           → index, new, [id]
app/product-detail.tsx  app/search.tsx  app/edit-profile.tsx
```

`CONFIRMED` **گروه‌های `(tabs)` و `(auth)` و `(profile)` در URL دیده نمی‌شوند** —
پس `app/(profile)/favorites.tsx` با مسیر `/favorites` صدا زده می‌شود.

`CONFIRMED` **۵ تب:** home · browse · cart · orders · profile
برای مهمان، `cart` و `orders` با `href: isGuest ? null : undefined` **پنهان** می‌شوند (۳ تب).

`CONFIRMED` **⚠️ دو منبع حقیقت برای redirect وجود دارد و با هم فرق دارند:**

| منبع | منطق |
|---|---|
| `app/index.tsx` | `authenticated && (needsOnboarding \|\| status==='REJECTED')` → `/onboarding` |
| `app/_layout.tsx` → `RootNavigator` | فقط `needsOnboarding` را چک می‌کند، **`REJECTED` را نه** |

→ کاربر `REJECTED` که مستقیماً روی `/(tabs)/home` باشد، redirect نمی‌شود.
این یک **تناقض ثبت‌شده** است — بدون دلیل رفتار فعلی را تغییر ندهید.

📄 **جزئیات:** `06-NAVIGATION.md`

---

## 6. Authentication چگونه کار می‌کند

`CONFIRMED` **مدل: OTP پیامکی → JWT. هیچ password ای وجود ندارد.**

```
۱) POST /auth/request-otp  {phone}
   → normalizePhone → چک blocked → چک قفل(5 تلاش/15 دقیقه) → چک cooldown(60 ثانیه)
   → randomInt(100000, 1000000) → upsert Otp (phone @unique) → logAttempt(RESEND)
   → اگر NODE_ENV==='production': smsService.sendOtp()
     وگرنه: { message, testCode: code, cooldown }   ⚠️ کد در پاسخ برمی‌گردد

۲) POST /auth/verify-otp  {phone, code}      [داخل $transaction]
   → وجود رکورد → قفل → انقضا → replay(usedAt) → تطابق کد
   → کد درست: usedAt=now
   → خارج از تراکنش: یافتن/ساخت User (اگر phone===ADMIN_PHONE → نقش ADMIN)
   → یافتن/ساخت Customer {status:'PENDING', onboardingCompleted:false}
   → JWT { sub:user.id, phone, role }  + کوکی httpOnly admin_token_v3

۳) POST /auth/onboarding  (نیازمند JWT) — فرم KYC
   → onboardingCompleted:true, status:'PENDING'  → emit 'kyc.submitted'

۴) [انتظار] ادمین: PATCH /admin/customers/:id/status {status:'APPROVED'}
   → ساخت Notification + emit 'kyc.approved'

۵) GET /auth/me → isApprovedCustomer=true → قیمت‌ها نمایش داده می‌شوند
```

`CONFIRMED` **ثابت‌های OTP** (`auth.service.ts` → `OTP_CONFIG`، export شده):
```
CODE_LENGTH: 6 · CODE_TTL_MS: 2min · MAX_VERIFY_ATTEMPTS: 5
LOCK_DURATION_MS: 15min · RESEND_COOLDOWN_MS: 60s
```

`CONFIRMED` **سه گارد:**
- `JwtAuthGuard` — `AuthGuard('jwt')` ساده
- `OptionalJwtAuthGuard` — به‌جای throw، `user || null` برمی‌گرداند (برای endpoint عمومی با personalization)
- `RolesGuard` — `@Roles(UserRole.ADMIN)`؛ اگر `requiredRoles` خالی → `true`

`CONFIRMED` `JwtStrategy.validate()` **هر request به دیتابیس می‌زند** و `isActive` را چک می‌کند
→ block شدن کاربر بلافاصله اثر می‌کند. هزینه: ۱ کوئری به ازای هر request.

`CONFIRMED` **ذخیره‌سازی توکن (موبایل)** — `src/storage/authStorage.ts` (326 خط، defensive):
- Native → `expo-secure-store` · Web → `localStorage`
- session ناقص (فقط token یا فقط customer) → پاکسازی + `null`
- اگر ذخیره شکست بخورد → هر دو پاک می‌شوند **و خطا throw می‌شود**

`CONFIRMED` **چهار وضعیت auth:** `loading | unauthenticated | guest | authenticated`

⚠️ `CONFIRMED` **`POST /auth/logout` از موبایل هرگز صدا زده نمی‌شود** → JWT تا ۷ روز معتبر می‌ماند.

📄 **جزئیات:** `07-AUTHENTICATION.md`

---

## 7. جریان داده چگونه است

`CONFIRMED` **مسیر اصلی: ورود → KYC → تایید ادمین → مرور → سبد → سفارش**

```
login.tsx ──POST /auth/request-otp──▶ auth.service.requestOtp ──▶ Otp upsert + SMS
otp.tsx   ──POST /auth/verify-otp───▶ auth.service.verifyOtp  ──▶ JWT + Customer
                                     └▶ authStorage.saveTokensAndCustomer (SecureStore)
                                     └▶ AuthContext.login → GET /auth/me (refresh)
onboarding.tsx ─POST /files/kyc?docType=X─▶ FilesService.saveKycImage ─▶ uploads/kyc/<filename>
              ─POST /auth/onboarding──────▶ Customer update + emit 'kyc.submitted'
[ادمین] ─PATCH /admin/customers/:id/status─▶ status:'APPROVED' + Notification
product-detail ─addToCart─▶ CartContext (optimistic) ─POST /cart/items─▶ CartItem upsert
cart.tsx ─POST /orders─▶ orders.service.createFromCart ──▶ [یک $transaction]
```

`CONFIRMED` **`createFromCart` — قلب مالی** (`orders.service.ts:288-405`):
```
۱. getCustomerAndCheck → !isActive || !customer → 403
۲. customer.status !== 'APPROVED' → 403 «حساب تایید نشده»
۳. خواندن cartItem (include product) → خالی → 400 'CART_EMPTY'
─── $transaction شروع ───
۴. خواندن محصولات → ساخت warnings[] (product_inactive / stock_unavailable)
۵. warnings.length>0 → 422 { error:'STOCK_UNAVAILABLE', warnings }
۶. محاسبه subtotal + ساخت orderItemsData (snapshot قیمت/نام/تصویر در لحظهٔ خرید)
۷. ⭐ کسر موجودی اتمیک:
   tx.product.update({ where:{ id, stock:{gte:qty} }, data:{ stock:{decrement:qty} } })
   → P2025 → 422 + rollback
۸. tx.order.create { status:'PENDING', paymentMethod:'CASH_ON_DELIVERY',
                     paymentStatus:'UNPAID', statusHistory:{create:{status:'PENDING'}} }
۹. tx.cartItem.deleteMany (خالی‌شدن سبد)
─── commit ───
۱۰. emit EVENT_ORDER_CREATED داخل try/catch خالی
```

`CONFIRMED` **استراتژی concurrency: بدون قفل DB.** کامنت صریح در `orders.service.ts:34-40`:
Prisma از `lock`/`pessimistic_write` در `findMany` پشتیبانی نمی‌کند؛ اتمی‌بودن با
**آپدیت شرطی** تضمین می‌شود. **این یک تصمیم معماری مستندشده است — آن را «بهبود» ندهید.**

📄 **جزئیات:** `08-DATA-FLOW.md`

---

## 8. Frontend و Backend چگونه ارتباط دارند

`CONFIRMED` **تنها نقطهٔ خروج شبکه در موبایل: `src/api/httpClient.ts`** (به‌جز ۲ استثنا ↓)

```
getBaseUrl() — ۴ سطح fallback:
 1) process.env.EXPO_PUBLIC_API_URL      (فقط اگر Platform.OS !== 'web')
 2) Platform.OS === 'web'                → http://localhost:3000   ⚠️ env نادیده گرفته می‌شود
 3) Constants.expoConfig.hostUri         → IP همان host + :3000
 4) DEV_IP = '10.75.109.83'              → fallback سخت‌کد
```

`CONFIRMED` **رفتار `httpClient.request()`:**
- توکن از `authStorage.getAccessToken()` → هدر `Authorization: Bearer <token>`
- `params` → `URLSearchParams` → query string
- **`res.status === 401` → `authStorage.clearAll()` + throw** ⚠️ (logout خودکار)
- خطا → `HttpError { status, data, message }`

`CONFIRMED` **۱۲ ماژول API:**
`authApi · bannersApi · cartApi · kycApi · notificationsApi · onboardingApi · ordersApi · productsApi · profileApi · searchApi · ticketsApi` (+ `httpClient`)

⚠️ `CONFIRMED` **دو استثنا که `httpClient` را دور می‌زنند و مستقیماً `axios` می‌زنند:**
| فایل | آدرس | مشکل |
|---|---|---|
| `src/components/ui/ErrorBoundary.tsx:7` | `'http://10.75.109.83:3000'` | **کاملاً سخت‌کد** — IP قدیمی، `catch {}` خالی |
| `src/hooks/useForceUpdate.ts:8` | `EXPO_PUBLIC_API_URL \|\| 'https://api.testcompany.ir'` | دامنهٔ placeholder؛ ضمناً **هرگز صدا زده نمی‌شود** |

`CONFIRMED` **ناهمگونی naming بین بک‌اند و موبایل:**
بک‌اند در پاسخ‌های موبایل عمدتاً **snake_case** می‌فرستد (`image_url`, `unit_label`,
`is_favorited`, `cart_quantity`, `line_total`, `status_label_fa`) در حالی که
schema.prisma و پنل ادمین **camelCase** هستند. تبدیل در `products.service.findAll`
(لایهٔ `enhancedItems`) و برگشت در `productsApi.toLocalProduct()` انجام می‌شود.

⚠️ `CONFIRMED` **`GET /products/favorites` استثناست** — آبجکت **خام Prisma** (camelCase)
برمی‌گرداند، پس `toLocalProduct` تصویر را `undefined` می‌کند **و `costPrice` نشت می‌کند.**

`CONFIRMED` **پنل ادمین** با `api()` در `core.js` به همان endpointها می‌زند
(`Authorization: Bearer` از `localStorage`) و لاگینش **همان** `/auth/request-otp` + `/auth/verify-otp` است.

📄 **جزئیات:** `09-API-BACKEND.md`

---

## 9. Database چیست و چه نقش‌هایی دارد

`CONFIRMED` **PostgreSQL + Prisma 5.22** · `prisma validate` → **«The schema is valid»**

### ۲۲ مدل در ۸ گروه
| گروه | مدل‌ها |
|---|---|
| **هویت** | `User` (users) · `Customer` (customers) — رابطهٔ 1:1 با `userId @unique` |
| **کاتالوگ** | `Category` · `Product` · `Favorite` |
| **سبد/سفارش** | `CartItem` · `Order` · `OrderItem` · `OrderStatusHistory` |
| **OTP** | `Otp` (`phone @unique`) · `OtpAttempt` (لاگ ممیزی) |
| **پشتیبانی** | `Ticket` · `TicketMessage` |
| **نوتیفیکیشن** | `Notification` · `NotificationRead` · `PushToken` |
| **جستجو** | `SearchHistory` · `SearchLog` |
| **متفرقه** | `Setting` (key/value) · `Banner` · `ProfileChangeRequest` · `ErrorLog` |

### نقش‌ها (Enum `UserRole`)
`CONFIRMED` `CUSTOMER` · `ADMIN` · `VISITOR`

| نقش | چگونه داده می‌شود | کجا چک می‌شود |
|---|---|---|
| `CUSTOMER` | پیش‌فرض هنگام ساخت User | همه‌جا |
| `ADMIN` | `phone === process.env.ADMIN_PHONE` در `verifyOtp`، یا `seed.ts`، یا `AdminController` | `@Roles(UserRole.ADMIN)` |
| `VISITOR` | فقط `seed.ts` از `VISITOR1_PHONE`/`VISITOR2_PHONE` | ⚠️ **هیچ‌جا چک نمی‌شود — نقش تزئینی است** |

### نقش مشتریان (Enum `CustomerStatus`) — **مهم‌ترین enum کسب‌وکاری**
`CONFIRMED` `PENDING → APPROVED` (یا `REJECTED` / `BLOCKED`)
- `PENDING`: ثبت‌نام کرده، منتظر بررسی مدارک → **قیمت نمی‌بیند، سفارش نمی‌تواند بدهد**
- `APPROVED`: تاییدشده → **تنها وضعیتی که می‌تواند سفارش ثبت کند**
- `REJECTED`: رد شده → می‌تواند دوباره مدارک بفرستد (`can_reapply`)
- `BLOCKED`: مسدود → حتی `request-otp` هم 401 می‌دهد

### ⚠️ ناهمگونی نام‌گذاری ستون‌ها — تصمیم عمدی
`CONFIRMED` جدول `orders` **ترکیبی از camelCase و snake_case** است و کامنت‌های فارسی
در `schema.prisma` وضعیت هر فیلد را ثبت کرده‌اند:
```prisma
orderNumber     String @unique @map("order_number")   // snake_case (تایید شده)
subtotalAmount  Int    @map("subtotal_amount")        // snake_case (تایید شده)
paymentMethod   PaymentMethod                          // CamelCase (رفع ارور فعلی: حذف @map)
paymentStatus   PaymentStatus @default(UNPAID)         // احتمالاً CamelCase   ← ⚠️ «احتمالاً»
shippingAmount  Int  @default(0)                       // احتمالاً CamelCase   ← ⚠️ «احتمالاً»
```
⚠️ `INFERRED` کلمهٔ «احتمالاً» نشان می‌دهد خود توسعه‌دهنده هم مطمئن نبوده.
**خطرناک‌ترین نقطه برای migration بعدی.** قبل از تغییر `Order`، حتماً روی یک DB واقعی
`prisma migrate diff` بگیرید.

### Migrations — `CONFIRMED` 16 عدد
⚠️ **سه migration با نام `init`** وجود دارد (`20260621145545`, `20260708003754`, `20260720182517`)
→ `INFERRED` تاریخچهٔ migration چند بار بازنشانی شده؛ خط زمانی خطی تمیز نیست.

⚠️ `CONFIRMED` **`20260810095506_new3db` مخرب است.** هشدارهای خود Prisma در همان فایل:
```
- You are about to drop the column `orderNumber` on the `orders` table. All the data ... will be lost.
- Added the required column `order_number` to the `orders` table without a default value.
  This is not possible if the table is not empty.
```
→ **روی دیتابیس غیرخالی fail می‌کند.**

`UNVERIFIED` سازگاری migrationها با schema **روی دیتابیس واقعی تست نشده**
(در محیط تحلیل، دسترسی به PostgreSQL ممکن نبود).

📄 **جزئیات:** `10-DATABASE.md`

---

## 10. Business Logic اصلی چیست

`CONFIRMED` قوانینی که **واقعاً در کد enforce شده‌اند**:

| # | قانون | محل دقیق |
|---|---|---|
| 1 | فقط `CustomerStatus.APPROVED` می‌تواند سفارش ثبت کند | `orders.service.ts:290` |
| 2 | کسر موجودی اتمیک — oversell غیرممکن | `orders.service.ts:355` · `visitor-sales.service.ts:190` |
| 3 | لغو سفارش **فقط** در `PENDING` | `orders.service.ts:507` |
| 4 | لغو سفارش → بازگرداندن موجودی (`stock: {increment}`) | `orders.service.ts:527` |
| 5 | `DELIVERED` شدن → `paymentStatus: PAID` خودکار | `orders.service.ts:583` |
| 6 | OTP: ۶ رقم · TTL ۲ دقیقه · ۵ تلاش · قفل ۱۵ دقیقه · cooldown ۶۰ ثانیه | `auth.service.ts` → `OTP_CONFIG` |
| 7 | هر شماره در هر لحظه فقط یک کد فعال | `Otp.phone @unique` + upsert |
| 8 | جلوگیری از replay | `Otp.usedAt` |
| 9 | تغییر فیلد حساس فقط با تایید ادمین | `profile.service.ts:141` + `auth.service.approveChange` |
| 10 | پوشش جغرافیایی: فقط زنجان / ۴ شهر | `complete-onboarding.dto.ts` |
| 11 | فاکتور فقط بعد از `CONFIRMED` | `orders.service.ts:546` |
| 12 | حذف محصول/دسته = **soft delete** (`isActive:false`) | `products.service.remove` · `categories.service.remove` |
| 13 | سود داشبورد = `revenue − Σ(costPrice × qty)` روی `PAID`+`DELIVERED` | `admin.service.dashboardStats` |

### ماشین وضعیت سفارش
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   └────────────────────────────────────────→ CANCELLED
```
⚠️ `CONFIRMED` **هیچ اعتبارسنجی transition وجود ندارد.** `updateStatus` هر وضعیتی را می‌پذیرد.

⚠️ `CONFIRMED` **قوانینی که در `.env` تعریف شده ولی در کد اجرا نمی‌شوند:**

| متغیر | ارجاع در `src/` | وضعیت |
|---|---|---|
| `MIN_ORDER_AMOUNT` | **۰** | ❌ حداقل مبلغ سفارش enforce نمی‌شود |
| `FREE_SHIPPING_MIN_AMOUNT` | **۰** | ❌ آستانهٔ ارسال رایگان enforce نمی‌شود |
| `MELIPAYAMAK_FROM` | **۰** | ❌ تعریف‌شده، بی‌استفاده |
| `MELIPAYAMAK_OTP_TOKEN` | **۰** | ❌ تعریف‌شده، بی‌استفاده |

`CONFIRMED` `shippingAmount` در `createFromCart` **هرگز ست نمی‌شود** → همیشه `0`
و `totalAmount === subtotal` (`orders.service.ts:397,801`).
✅ `checkout.tsx` که `const shipping = 0;` داشت در P2 حذف شد.

✅ **تصمیم محصول:** «در نسخهٔ فعلی Production، هزینهٔ ارسال **صفر** است و
محاسبهٔ Shipping در آینده طبق Business Rule جداگانه پیاده‌سازی خواهد شد.»
پس این **رفتار عمدی** است، نه باگ — `17` §B18.

📄 **جزئیات:** `11-BUSINESS-LOGIC.md`

---

## 11. State Management چگونه است

`CONFIRMED` **بدون Redux / Zustand / React Query.** فقط **۳ React Context**:

| Context | فایل | خط | مسئولیت |
|---|---|---|---|
| `AuthContext` | `src/context/AuthContext.tsx` | 272 | session، وضعیت auth، فلگ‌های مشتری، push token |
| `CartContext` | `src/context/CartContext.tsx` | 303 | سبد خرید optimistic + queue |
| `FavoritesContext` | `src/context/FavoritesContext.tsx` | 72 | فقط `string[]` از IDها |

### الگوهای مهم در `CartContext` (قبل از تغییر حتماً بخوانید)
`CONFIRMED`
1. **`itemsRef` به‌جای `state`** — کامنت صریح: «کلید حل مشکل: از ref استفاده کن، نه state»
   (مشکل stale closure در optimistic update)
2. **`taskQueue`** — یک `Promise` زنجیره‌ای که عملیات را **سریالی** می‌کند
3. **`runOnQueue(task, _o, rollback)`** — در موفقیت، پاسخ سرور جایگزین state می‌شود؛ در شکست، rollback
4. **استثنا:** حذف آیتم (`newQty <= 0`) **عمداً بدون rollback** است —
   «در صورت خطا آیتم را زنده نمی‌کنیم»
5. `AppState === 'active'` → `refreshCart()`
6. روی login → `cartApi.merge(localSlim)`؛ روی logout → `clearCart()`

`CONFIRMED` **`authStorage` (نه Context) لایهٔ persistence است** و `AuthContext` از آن می‌خواند.
`cartStorage` یک `writeLock` زنجیره‌ای دارد و در برابر دادهٔ خراب کش را ریست می‌کند.

⚠️ `CONFIRMED` **فلگ‌های وضعیت در `AuthContext` فقط `customer?.status` را چک می‌کنند،
نه `authStatus`.** پس تا رسیدن پاسخ `getMeApi` ممکن است وضعیت کهنه نمایش داده شود.

📄 **جزئیات:** `13-STATE-MANAGEMENT.md`

---

## 12. Components مهم کدام‌اند

### موبایل — بزرگ‌ترین فایل‌ها `CONFIRMED`
| فایل | خط | نقش |
|---|---|---|
| `app/product-detail.tsx` | **988** | جزئیات محصول، گالری، stepper، مشابه‌ها، favorite |
| `app/onboarding.tsx` | **798** | فرم KYC + آپلود ۴ مدرک |
| `app/(tabs)/cart.tsx` | **748** | ⭐ سبد خرید + **ثبت سفارش واقعی** |
| `app/(tabs)/home.tsx` | **714** | هدر، جستجو، بنر اسلایدر، سفارش فعال، reorder، گرید دسته‌بندی |
| `app/(tabs)/browse.tsx` | **564** | جستجو + فیلتر chips + sort + گرید ۲ستونی + pagination |
| `src/components/product/ProductCard.tsx` | **517** | کارت محصول با سه حالت guest/pending/approved |
| `app/(tabs)/profile.tsx` | 412 | پروفایل + آمار + منوها |

### کامپوننت‌های مشترک `src/components/ui/`
`Button · EmptyState · ErrorBoundary · ErrorState · GuestGuard · LoadingState · OfflineBanner · Skeleton · Stepper · collapsible`

### ⭐ سیستم نمایش قیمت — سه حالت (`src/components/product/PriceBox.tsx`)
```
guest    → «برای مشاهده قیمت وارد حساب شوید»  (بدون هیچ عددی)
pending  → «تماس برای تایید حساب»
approved → قیمت واقعی + قیمت قدیم + درصد تخفیف
```
همین منطق در `ProductCard.tsx:228`, `ProductRowCard.tsx:132,156`, `product-detail.tsx:641,760` تکرار شده.

⚠️ `CONFIRMED` **این محافظت فقط سمت UI است** — API قیمت را به همه می‌دهد. به `15-SECURITY.md` §S3.

### ⚠️ صفحات ناقص / stub (بسیار مهم — اشتباه نکنید)
`CONFIRMED`
| فایل | وضعیت |
|---|---|
| ~~`app/checkout.tsx`~~ | ✅ **حذف شد (P2)** — route یتیم بود؛ ثبت سفارش واقعی در `cart.tsx` است |
| `app/(profile)/favorites.tsx` | **stub** — فقط یک پیام ثابت؛ `useFavorites`/`productsApi.getFavorites()` را صدا نمی‌زند |
| `app/(profile)/notification-settings.tsx` | **stub** — فقط `useState` محلی؛ هیچ persistence و هیچ API |
| `app/(profile)/info-{about,faq,guide,privacy,terms}.tsx` | صفحات محتوای ایستا (بدون API) — این طبیعی است |

### پنل ادمین — ۱۱ view `CONFIRMED`
```
dashboard · customers · orders · visitor-sales 🛍 · products · categories
banners · tickets · notifications · security · settings
```
همه در `app.js` (به‌جز `renderOrders` در `orders.js`، `renderProducts` در `products.js`،
`renderVisitorSales` در `visitor-sales.js`).

📄 **جزئیات:** `12-UI-COMPONENTS.md`

---

## 13. فایل‌های حیاتی کدام‌اند

`CONFIRMED` **قبل از تغییر هرکدام، این فایل را کامل بخوانید:**

| اولویت | فایل | چرا حیاتی است |
|---|---|---|
| 🔴 1 | `wholesale-api/src/orders/orders.service.ts` | قلب مالی. تراکنش، کسر موجودی اتمیک، `mapOrderToResponse` (contract کل موبایل) |
| 🔴 2 | `wholesale-api/src/auth/auth.service.ts` | OTP، JWT، onboarding، تغییرات حساس. `OTP_CONFIG` export می‌شود |
| 🔴 3 | `wholesale-api/prisma/schema.prisma` | ۲۲ مدل. naming ستون‌ها دستی `@map` شده و بخشی «احتمالاً» است |
| 🔴 4 | `wholesale-mobile/src/api/httpClient.ts` | تنها نقطهٔ خروج شبکه + `buildUrl` (همهٔ تصویرها) |
| 🔴 5 | `wholesale-mobile/src/storage/authStorage.ts` | session. خطا = logout اجباری |
| 🔴 6 | `wholesale-mobile/src/context/CartContext.tsx` | optimistic + queue + ref. الگوهای غیربدیهی دارد |
| 🟠 7 | `wholesale-api/src/products/products.service.ts` | contract محصولات + ورودی جستجو |
| 🟠 8 | `wholesale-api/src/admin/admin.controller.ts` | 42 endpoint، به ۷ سرویس وابسته (God-Controller) |
| 🟠 9 | `wholesale-mobile/app/_layout.tsx` | Provider tree + redirect مرکزی + فونت |
| 🟠 10 | `wholesale-api/src/main.ts` | CORS، ValidationPipe، Swagger guard، static admin |
| 🟠 11 | `wholesale-api/public/admin/core.js` | هلپرهای سراسری پنل ادمین — ۴ فایل دیگر به آن وابسته‌اند |
| 🟡 12 | `wholesale-api/src/auth/dto/complete-onboarding.dto.ts` | قوانین کسب‌وکار KYC (شامل محدودیت جغرافیایی) |
| 🟡 13 | `wholesale-mobile/src/utils/notify.ts` | ~43 نقطه در کل اپ از آن استفاده می‌کنند |
| 🟡 14 | `wholesale-mobile/app/(tabs)/cart.tsx` | **تنها** مسیر ثبت سفارش + تولید `idempotencyKey` |

📄 **نقشهٔ کامل اثر:** `19-CHANGE-IMPACT-MAP.md`

---

## 14. Dependencyهای مهم چیست

`CONFIRMED` **وضعیت نصب (تست واقعی):**
```
wholesale-api     : npm ci → 815 packages  ✅
wholesale-mobile  : npm ci → 945 packages  ✅
```

### گراف وابستگی ماژول‌های بک‌اند
```
AppModule
├── PrismaModule  (@Global — هیچ ماژولی import نمی‌کند)
├── SmsModule ──────────────┐
├── NotificationsModule ────┤
├── AuthModule ◀────────────┘ (PrismaService, SmsService, JwtService,
│                              NotificationsService, EventEmitter2)
├── AdminModule → ProductsModule, CategoriesModule, OrdersModule,
│                 FilesModule, BannersModule, forwardRef(AuthModule)  ⚠️ حلقه
├── SearchModule → ProductsModule, AuthModule
├── VisitorSalesModule → PrismaModule
└── CartModule / OrdersModule / CategoriesModule / ProductsModule /
    TicketsModule / ProfileModule / BannersModule / FilesModule /
    AppVersionModule / BackupModule
```

`CONFIRMED` **حلقهٔ `AdminModule ↔ AuthModule`** با `@Inject(forwardRef(() => AuthService))` حل شده،
چون `AdminController` متدهای `listProfileChanges`/`approveChange`/`rejectChange` را از `AuthService` صدا می‌زند.

### وابستگی‌های مرده یا مشکوک `CONFIRMED`
| پکیج | وضعیت |
|---|---|
| `bcrypt` (بک‌اند) | ❌ هرگز استفاده نمی‌شود (فقط import بلااستفاده در `seed.ts`) |
| `@nestjs/throttler` | ⚠️ ثبت شده ولی `ThrottlerGuard` **هیچ‌جا اعمال نشده** |
| `@sentry/node` | ⚠️ کد دارد ولی `SENTRY_DSN` در `.env` نیست → غیرفعال |
| `supertest` | ⚠️ نصب است ولی **هیچ تست e2e وجود ندارد**؛ `test/jest-e2e.json` هم نیست |
| `axios` (موبایل) | فقط در ۲ فایلی که `httpClient` را دور می‌زنند |
| `@back` alias | ⚠️ در `babel.config.js` و `tsconfig.json` به `../wholesale-api/src` اشاره می‌کند ولی **هیچ‌جا استفاده نمی‌شود** — فعالش نکنید |

⚠️ `CONFIRMED` **`expo-build-properties@^57` روی `expo@~56`** نصب شده (SDK mismatch) —
این در تغییرات commit‌نشده است.

📄 **جزئیات:** `18-DEPENDENCY-MAP.md`

---

## 15. تغییر هر بخش چه اثراتی دارد

`CONFIRMED` خلاصهٔ سریع (نسخهٔ کامل در `19-CHANGE-IMPACT-MAP.md`):

| اگر تغییر دهید | می‌شکند |
|---|---|
| `schema.prisma` مدل `Order` | `orders.service` + `admin.service` + `visitor-sales.service` + `mapOrderToResponse` + ۳ صفحهٔ موبایل + چاپ فاکتور |
| `orders.service.mapOrderToResponse` | `cart.tsx` · `orders/[id].tsx` · `(tabs)/orders.tsx` · `(tabs)/home.tsx` · `orders/success.tsx` |
| `products.service.findAll` / `findOne` | `products.controller` · `search.service` · `browse.tsx` · `home.tsx` · `search.tsx` · `product-detail.tsx` · `ProductCard` · `ProductRowCard` |
| `cart.service.getCart` | `cartApi.serverCartToLocal` → `CartContext` → `cart.tsx` + badge تب سبد |
| `authStorage.ts` (کلیدها یا شکل) | `AuthContext` · `httpClient` · همهٔ صفحه‌های محافظت‌شده |
| `OTP_CONFIG` | `auth.service` · `login.tsx`/`otp.tsx` (که `cooldown` را نمایش می‌دهند) |
| `complete-onboarding.dto.ts` | `onboarding.tsx` (لیست شهرها) + تمام ثبت‌نام‌های جدید |
| `public/admin/core.js` | **همهٔ ۴ فایل دیگر پنل ادمین** (ترتیب لود حیاتی است) |
| `buildUrl` / `getBaseUrl` | همهٔ تصویرها + همهٔ درخواست‌ها |
| `src/utils/notify.ts` | ~43 نقطه در کل اپ |
| `theme.ts` (`COLORS`) | ⚠️ **ناقص** — بسیاری از فایل‌ها رنگ را سخت‌کد کرده‌اند |

⚠️ `CONFIRMED` **چهار کپی موازی از پالت رنگ وجود دارد:**
`src/constants/theme.ts` (`COLORS`) · `app/(tabs)/home.tsx` (`const C = {...}`) ·
`app/(tabs)/browse.tsx` (`const COLORS = {...}`) · `app/(profile)/notification-settings.tsx` (`const C = {...}`)

---

## 16. Known Issues چیست

`CONFIRMED` **۳۱ مسئلهٔ ثبت‌شده** — فهرست کامل در `17-KNOWN-ISSUES.md`،
یافته‌های امنیتی در `15-SECURITY.md`.

> ⚠️ **شماره‌گذاری در این جدول با `15-SECURITY.md` و `17-KNOWN-ISSUES.md` یکی است.**
> `S*` = امنیتی · `B*` = کارکردی/ساختاری. اگر جایی ID متفاوت دیدید، آن فایل‌ها مرجع‌اند.

### 🔴 امنیتی — بحرانی
| ID | شرح | محل |
|---|---|---|
| ✅ **S1** | `ThrottlerGuard` اعمال نشده → rate limiting کاملاً بی‌اثر | `main.ts` (غایب) |
| ✅ **S2** | قفل OTP به‌خاطر rollback هرگز فعال نمی‌شود → brute force نامحدود | `auth.service.ts:233-247` |
| ✅ **S3** | `visitor-sales` بدون `RolesGuard` → سفارش جعلی — **رفع شد** (`@Roles(ADMIN, VISITOR)`) | `visitor-sales.controller.ts` |
| **S4** | `JWT_SECRET` زنده در ریپازیتوری عمومی → ساخت JWT ادمین | `wholesale-api/.env` |
| **S5-A** | ✅ منطق OTP — gate خودکار `testCode` از قبل درست کار می‌کند؛ هیچ تغییر کدی لازم نیست | `auth.service.ts:164-179` |
| **S5-B** | 🔵 اتصال ملی‌پیامک — کد SOAP نوشته شده ولی هرگز با اکانت واقعی تست نشده | `sms/sms.service.ts` |
| **S13** | `.env` با مقادیر زنده داخل زیپِ push‌شده | `workspace-*.zip` |

### ✅ امنیتی — زیاد (رفع‌شده در P1)
| ID | شرح | محل |
|---|---|---|
| **S6** | ✅ نشت `costPrice` — `getMyFavorites` حالا `costPrice`/`nameNormalized` را حذف می‌کند | `products.service.ts` |
| **S7** | ✅ قیمت حالا **سمت API** شرطی است (`priceFields`، پیش‌فرض fail-closed) | `products.service.ts` |
| **S8** | ✅ `JwtStrategy` کاربر `BLOCKED` را رد می‌کند | `jwt.strategy.ts` |
| **S9** | ✅ تست سیستماتیک `admin-routes-guard.spec.ts` پوشش `@Roles` را تضمین می‌کند | `common/admin-routes-guard.spec.ts` |
| **S10** | کد OTP به‌صورت plaintext در DB | `schema.prisma:215-231` |

### 🔴 کارکردی — بحرانی
| ID | شرح | محل |
|---|---|---|
| **B11** | ✅ هر ۹ مورد به استثنای معنادار HTTP تبدیل شد (`grep "throw new Error(" src/` → خالی) | ۵ فایل |
| **B26** | `wholesale-mobile/assets/` در ریپازیتوری نیست → clone تمیز build نمی‌شود | `app/_layout.tsx:110-115` |

### 🟠 کارکردی — زیاد
| ID | شرح | محل |
|---|---|---|
| **B12** | نوتیفیکیشن **push** برای تایید/رد KYC نمی‌رود (in-app ساخته می‌شود) | `notifications.module.ts` |
| **B14** | `markAllAsRead` نوتیفیکیشن‌های broadcast را خوانده نمی‌کند | `notifications.service.ts` |
| **B15** | `search.findAll` روی `name` خام جستجو می‌کند، نه `nameNormalized` | `search.service.ts` |
| **B18** | ✅ `shippingAmount` صفر است — **تصمیم محصول: عمدی است** (Shipping در آینده با Business Rule جداگانه) | `orders.service.ts:397,801` |
| **B19** | ✅ Idempotency کامل: کلید سمت کلاینت → DB → `P2002` → `200 + سفارش اصلی` | `orders.service.ts:392,442` |
| **B20** | تعارض مسیر `/admin/customers/search` (ادمین برنده، مشتری ۴۰۳) | `app.module.ts` (ترتیب) |
| **B27** | تناقض `REJECTED` بین `index.tsx` و `_layout.tsx` | `app/_layout.tsx:75-81` |
| **B31** | `@Cron(process.env.BACKUP_INTERVAL)` قبل از ConfigModule ارزیابی می‌شود | `backup.service.ts` |

### 🟡 کارکردی — متوسط/کم
| ID | شرح |
|---|---|
| **B13** | `notification.listener.ts` ثبت‌نشده — ۶ `@OnEvent` مرده |
| **B21** | `app/checkout.tsx` route یتیم (۳۳۳ خط کد مرده) |
| **B22** | `favorites.tsx` و `notification-settings.tsx` stub |
| **B23** | `notificationRouting.ts` هرگز import نشده → deep link مرده |
| **B24** | `useForceUpdate` هرگز صدا زده نمی‌شود |
| **B25** | `POST /auth/logout` از موبایل صدا زده نمی‌شود |
| **B28** | import مردهٔ `Fonts` از `_layout` (چرخه‌ای) |
| **B29** | ۴ پالت رنگ + ۲ `Fonts` + ۲ `Spacing` موازی |
| **B30** | `ErrorBoundary.tsx` با IP hardcode + `catch (e) {}` خالی |

### ✅ موارد مشکوکی که بررسی و **رد** شدند
- **route shadowing در `orders.controller`** — با تست HTTP واقعی تأیید شد که `admin/all` و `admin/create` درست کار می‌کنند
- ترتیب `latest`/`active` قبل از `:id` ✅ درست
- ترتیب `customers/search` قبل از `customers/:id` ✅ درست

---

## 17. Workflow توسعه چگونه است

### اجرا `CONFIRMED`
```bash
# 1) دیتابیس
docker compose up -d                 # postgres:16 → پورت 5432

# 2) بک‌اند
cd wholesale-api
cp .env.example .env                 # ✅ وجود دارد (track شده) — مقادیر را از کاربر بگیرید
                                     # ⚠️ .env را بدون اجازهٔ کاربر تغییر ندهید
npm ci
npx prisma generate
npx prisma migrate deploy            # یا npm run db:migrate (dev)
npm run seed                         # ادمین + ۴ دسته + ۴ محصول نمونه
npm run start:dev                    # → http://localhost:3000
                                     # → /docs (فقط localhost)
                                     # → /admin (پنل مدیریت)

# 3) موبایل
cd wholesale-mobile
npm ci
npm start                            # expo start
npm run android | ios | web
```

### چرخهٔ verify (اجباری) `CONFIRMED`
```bash
# بک‌اند
npm run build          # nest build
npm test               # jest  → باید 4 suites / 18 tests سبز باشد
npx eslint "{src,apps,libs,test}/**/*.ts"    # باید 0/0 باشد
npx prisma validate

# موبایل
npx tsc --noEmit       # باید exit 0
npx expo lint          # 0 خطا (هشدارهای react-hooks عمدی‌اند)
```

### وضعیت پایهٔ تأییدشده در زمان نوشتن این مستندات `CONFIRMED`
```
jest        : 4 suites / 18 tests — همه pass
eslint (API): 0 خطا، 0 هشدار
tsc (mobile): exit 0، 0 خطا
expo lint   : 0 خطا، 140 هشدار
prisma      : schema is valid
```

### اسکریپت‌های npm `CONFIRMED`
**بک‌اند:** `build` · `start` · `start:dev` · `start:debug` · `start:prod` · `lint` · `format` ·
`test` · `test:watch` · `test:cov` · `test:debug` · `test:e2e`⚠️(config نیست) ·
`db:generate` · `db:migrate` · `db:deploy` · `db:studio` · `db:seed` · `seed` ·
`migrate:kyc` · `migrate:kyc:dry`

**موبایل:** `start` · `android` · `ios` · `web` · `lint` · `reset-project` ·
`update` (`eas update --branch production`) · `update:preview` (`--branch preview`)

📄 **جزئیات:** `20-DEVELOPMENT-WORKFLOW.md`

---

## 18. AI جدید هنگام تغییر کد چه قوانینی باید رعایت کند

### 🔒 قوانین غیرقابل‌مذاکره
`CONFIRMED` (از `docs/ai-handover/00-START-HERE.md` قبلی + تاریخچهٔ گیت)

1. **`.env` را دست نزنید.** کاربر صراحتاً گفته «به خودم بسپار». حتی برای «اصلاح» IP.
2. **تغییر Minimal & Scoped.** بازنویسی کامل فایل ممنوع. کوچک‌ترین تغییر امن.
3. **بدون بررسی Impact، تغییر ندهید.** اول `19-CHANGE-IMPACT-MAP.md` را بخوانید.
4. **business logic را بدون توضیح ساده تغییر ندهید.** برای Auth/Cart/Orders/API/DB
   باید با جدول، تمثیل و دستور دقیق، به **فارسی** و برای مخاطب **نوآموز** توضیح دهید.
5. **به GitHub push نکنید.** فقط `git` لوکال.
6. **همهٔ متن‌های user-facing فارسی** باشند.
7. **Secretها را افشا نکنید.** مقدار `.env` را در پاسخ، لاگ، کامیت یا مستندات ننویسید.
8. **معماری یا Business Logic را حدس نزنید.** اگر مطمئن نیستید → `UNVERIFIED` بنویسید و بپرسید.

### ⚠️ تله‌های رایج
| تله | توضیح |
|---|---|
| «کد مرده را پاک کنم» | خیلی از کدهای مرده **عمدی** یا **نیمه‌کاره** هستند. اول بپرسید |
| «`lock` بگذارم تا اتمیک شود» | Prisma پشتیبانی نمی‌کند. الگوی فعلی عمدی است |
| «`state` به‌جای `ref` تمیزتر است» | در `CartContext` عمداً `ref` است (stale closure) |
| «rollback اضافه کنم» | حذف آیتم سبد عمداً بدون rollback است |
| «`checkout.tsx` را پیدا کنم» | ✅ در P2 حذف شد؛ مسیر یکتا `cart.tsx` است |
| «route shadowing را درست کنم» | تست شده و باگ نیست |
| «`docs/` قدیمی را باور کنم» | نسخهٔ قبلی نادرست بود و بازنویسی شد |

📄 **قوانین کامل:** `21-AI-AGENT-RULES.md`

---

## 19. نقشهٔ مطالعه (Reading Order)

`CONFIRMED` اگر تازه وارد شده‌اید، به این ترتیب جلو بروید:

```
۱. AI-PROJECT-HANDOVER.md      ← همین فایل (نقشهٔ کلی)
۲. 00-START-HERE.md            ← ترتیب مطالعه + وضعیت فعلی + هشدارها
۳. 21-AI-AGENT-RULES.md        ← ⚠️ قبل از هر تغییر، قوانین
۴. 15-SECURITY.md              ← بدانید چه چیزی را نباید بدتر کنید
۵. 17-KNOWN-ISSUES.md          ← بدانید چه چیزی از قبل خراب است (تا اشتباه به شما نسبت ندهند)
۶. 19-CHANGE-IMPACT-MAP.md     ← قبل از هر تغییر
─── سپس بر اساس کارتان ───
   کار روی سفارش/مالی  → 08-DATA-FLOW · 11-BUSINESS-LOGIC · 10-DATABASE
   کار روی ورود/KYC    → 07-AUTHENTICATION · 10-DATABASE
   کار روی UI موبایل   → 12-UI-COMPONENTS · 06-NAVIGATION · 13-STATE-MANAGEMENT
   کار روی API         → 09-API-BACKEND · 04-ARCHITECTURE
   دیپلوی/بیلد         → 20-DEVELOPMENT-WORKFLOW · 02-TECH-STACK
```

---

## 20. فهرست کامل فایل‌های این مجموعه

| فایل | محتوا |
|---|---|
| `INDEX.md` | 🗂️ **فهرست موضوعی** — جست‌وجوی سریع، پاسخ‌های آماده، نگاشت معکوس فایل→مستندات |
| `AI-PROJECT-HANDOVER.md` | ⭐ نقشهٔ فشردهٔ کل پروژه |
| `00-START-HERE.md` | ترتیب مطالعه، وضعیت فعلی، هشدارهای فوری |
| `01-PROJECT-OVERVIEW.md` | چیست، برای چه کسی، دامنهٔ کسب‌وکار |
| `02-TECH-STACK.md` | همهٔ پکیج‌ها با نسخه و نقش |
| `03-PROJECT-STRUCTURE.md` | درخت کامل پوشه‌ها + توضیح هر بخش |
| `04-ARCHITECTURE.md` | لایه‌ها، ماژول‌ها، الگوها، گراف وابستگی |
| `05-APP-STARTUP-FLOW.md` | bootstrap هر سه بخش، مرحله به مرحله |
| `06-NAVIGATION.md` | همهٔ routeها، redirectها، تب‌ها، تناقض‌ها |
| `07-AUTHENTICATION.md` | OTP، JWT، گاردها، storage، KYC |
| `08-DATA-FLOW.md` | جریان‌های end-to-end با مسیر دقیق فایل |
| `09-API-BACKEND.md` | **همهٔ ۱۱۷ endpoint** با گارد و شکل پاسخ |
| `10-DATABASE.md` | ۲۲ مدل، ۱۲ enum، migrations، نقش‌ها |
| `11-BUSINESS-LOGIC.md` | قوانین enforce‌شده + قوانین مرده |
| `12-UI-COMPONENTS.md` | صفحه‌ها، کامپوننت‌ها، stub‌ها، پنل ادمین |
| `13-STATE-MANAGEMENT.md` | ۳ Context + storage + الگوهای غیربدیهی |
| `14-ERROR-HANDLING.md` | خطاها، loading/empty/error state، Sentry |
| `15-SECURITY.md` | **۱۵ یافتهٔ امنیتی** (`S1`–`S15`) + نکات مثبت + اولویت اقدام |
| `16-HISTORY-AND-IMPORTANT-DECISIONS.md` | ۵۹ کامیت، فازها، تصمیم‌های معماری |
| `17-KNOWN-ISSUES.md` | **۳۱ باگ** (`B1`–`B31`) + ۱۰ تناقض + فهرست `UNVERIFIED` |
| `18-DEPENDENCY-MAP.md` | وابستگی‌ها + گراف ماژول‌ها + مرده‌ها |
| `19-CHANGE-IMPACT-MAP.md` | ⭐ قبل از هر تغییر — نقشهٔ اثر |
| `20-DEVELOPMENT-WORKFLOW.md` | اجرا، build، test، verify، EAS |
| `21-AI-AGENT-RULES.md` | ⭐ قوانین اجباری برای AI |
| `22-ORIGINAL-DOCS.md` | 📜 ۳۰ سند اصلی توسعه‌دهنده — بازیابی از git + ارزیابی اعتبار |
| `original-docs/` | خودِ آن ۳۰ فایل (verbatim از `git show HEAD:…`) |

---

> **⚠️ آخرین هشدار**
>
> این مستندات بر اساس کد واقعی و با اجرای دستورات تأیید شده‌اند،
> ولی **کد منبع حقیقت نهایی است.** اگر تناقضی بین اینجا و سورس دیدید،
> **سورس برنده است** و لطفاً این فایل را به‌روز کنید.
>
> موارد `UNVERIFIED` را به‌عنوان واقعیت نقل نکنید.
