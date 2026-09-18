# 18 — DEPENDENCY MAP

> این فایل نشان می‌دهد **چه چیزی به چه چیزی وابسته است** — تا قبل از هر تغییر
> بدانید چه چیزهای دیگری تحت تأثیر قرار می‌گیرند.

---

## 1. وابستگی بین سه بخش پروژه

```
┌─────────────────────┐         ┌─────────────────────┐
│  wholesale-mobile   │         │  public/admin/      │
│  (Expo)             │         │  (Vanilla JS)       │
└──────────┬──────────┘         └──────────┬──────────┘
           │  HTTP + Bearer JWT            │  HTTP + Bearer JWT
           │                               │
           └────────────┬──────────────────┘
                        ▼
              ┌───────────────────┐
              │  wholesale-api    │   ← منبع حقیقت
              │  (NestJS)         │
              └─────────┬─────────┘
                        │ Prisma
                        ▼
              ┌───────────────────┐
              │  PostgreSQL       │
              └───────────────────┘
```

`CONFIRMED` **هیچ وابستگی کد مستقیمی بین سه بخش نیست.**
تنها قرارداد مشترک: **شکل JSON پاسخ‌های API.**

### ۱-۱. نقاط همگام‌سازی اجباری
| تغییر در | باید در این‌ها هم اعمال شود |
|---|---|
| `prisma/schema.prisma` | DTO بک‌اند + `wholesale-mobile/src/types/*.ts` |
| شکل پاسخ یک endpoint | `wholesale-mobile/src/api/*Api.ts` + `public/admin/*.js` |
| مقدار یک `enum` | `schema.prisma` + `wholesale-mobile/src/constants/enums.ts` |
| افزودن endpoint | `*Api.ts` (موبایل) و/یا `core.js http()` (ادمین) |
| مسیر route موبایل | `notification-templates.ts` (`data.route`) |

⚠️ `CONFIRMED` **نمونهٔ واقعی ناهمگامی:** `PaymentMethod` در schema چهار مقدار دارد،
در `src/constants/enums.ts` موبایل فقط سه تا (`CASH_ON_DELIVERY` غایب).

---

## 2. وابستگی‌های درون بک‌اند

### ۲-۱. گراف ماژول‌ها
```
PrismaModule  (@Global)  ◄── همه (بدون import صریح)
                              └─ استثنا: VisitorSalesModule صریح import می‌کند (غیرضروری)

ConfigModule  (isGlobal) ◄── همه

SmsModule ────────────► AuthModule
NotificationsModule ──► AuthModule
JwtModule(async) ─────► AuthModule
AuthModule ───exports──► AuthService, OptionalJwtAuthGuard
                              └── مصرف‌کننده: SearchModule، AdminModule (forwardRef)

ProductsModule ───────► AdminModule, SearchModule
CategoriesModule ─────► AdminModule
OrdersModule ─────────► AdminModule
FilesModule ──────────► AdminModule
BannersModule ────────► AdminModule
AuthModule ──🔁forwardRef──► AdminModule
```

### ۲-۲. 🔁 تنها چرخه: `AdminModule ↔ AuthModule`
`CONFIRMED` `admin.module.ts:14`:
```ts
imports: [ProductsModule, CategoriesModule, OrdersModule, FilesModule,
          BannersModule, forwardRef(() => AuthModule)],
```
`CONFIRMED` `AdminService` با `@Inject(forwardRef(() => AuthService))` تزریق می‌کند
(`admin.controller.ts:62`).

⚠️ **`forwardRef` را حذف نکنید** — احتمالاً خطای DI در bootstrap می‌دهد.

### ۲-۳. ترتیب ماژول‌ها در `app.module.ts` — 🔴 معنادار است
```ts
imports: [
  ConfigModule.forRoot(...), ThrottlerModule.forRoot(...),
  ScheduleModule.forRoot(),  EventEmitterModule.forRoot(),

  PrismaModule, SmsModule, AuthModule, CartModule, CategoriesModule,
  ProductsModule, OrdersModule, FilesModule, AdminModule,   // ← AdminModule اینجاست
  TicketsModule, NotificationsModule, AppVersionModule,
  BackupModule, BannersModule, SearchModule, ProfileModule,
  VisitorSalesModule,                                        // ← و این آخر
]
```

🔴 `CONFIRMED` **این ترتیب یک باگ امنیتی را پنهان می‌کند:**
`AdminController @Get('customers/search')` قبل از
`CustomerSearchController @Get('search')` ثبت می‌شود، پس مسیر
`/admin/customers/search` به ادمین می‌رسد و مشتری ۴۰۳ می‌گیرد.

> ⚠️ **اگر ترتیب را عوض کنید، نشت PII فعال می‌شود.** → `15-SECURITY.md` §S3

### ۲-۴. وابستگی فایل‌های پرطرفدار (بک‌اند)
```
prisma.service.ts        ◄── همهٔ سرویس‌ها (۱۷ ماژول)
get-user.decorator.ts    ◄── همهٔ controllerها (@GetUser / RequestUser)
jwt-auth.guard.ts        ◄── orders, cart, notifications, tickets, profile,
                            search, products, favorites, files, visitor-sales,
                            admin, categories
roles.guard.ts           ◄── admin, orders, products, categories, files
roles.decorator.ts       ◄── roles.guard.ts
normalization.ts         ◄── search.service, products.service, categories.service
notification-templates.ts ◄── notification-events.listener
events.ts                ◄── orders.service, notification-events.listener
too-many-requests.exception.ts ◄── auth.service
```

⚠️ **`prisma.service.ts` پرمصرف‌ترین فایل است.** تغییرش همه‌جا را تحت تأثیر می‌گذارد.

---

## 3. وابستگی‌های درون موبایل

### ۳-۱. گراف Context
```
AuthContext  ◄── CartContext        (useAuth: isLoggedIn, accessToken)
             ◄── FavoritesContext   (useAuth: isLoggedIn)
             ◄── تقریباً همهٔ routeها
             ◄── components/ui/GuestGuard.tsx

CartContext  ◄── app/(tabs)/cart.tsx
             ◄── app/(tabs)/_layout.tsx   (برای tabBarBadge)
             ◄── components/product/ProductCard.tsx

FavoritesContext ◄── components/product/ProductCard.tsx
               ◄── app/product-detail.tsx
```

### ۳-۲. گراف لایهٔ API
```
همهٔ *Api.ts ──► httpClient.ts ──► axios
                       │
                       ├── baseURL از .env / DEV_IP
                       ├── request interceptor  → authStorage (خواندن توکن)
                       └── response interceptor → authStorage (پاک‌کردن در 401)
```

🔴 **`httpClient.ts` گلوگاه است.** هر تغییری در آن روی **همهٔ درخواست‌های اپ** اثر می‌گذارد.

### ۳-۳. گراف ذخیره‌سازی
```
authStorage.ts ──► expo-secure-store   (accessToken, customer)
               └─► AsyncStorage        (guestModeActive, hasSeenWelcome)

cartStorage.ts ──► AsyncStorage        (cache سبد)
```

### ۳-۴. وابستگی‌های `_layout.tsx`
```
app/_layout.tsx
  ├── @/context/AuthContext
  ├── @/context/CartContext
  ├── @/context/FavoritesContext
  ├── @/components/ui/OfflineBanner
  ├── @/hooks/useForceUpdate          ← ⚠️ import مرده
  ├── @/components/ui/ErrorBoundary   (CustomFallback)
  ├── @sentry/react-native
  ├── expo-font (useFonts)
  ├── expo-splash-screen
  └── ../assets/fonts/*.ttf           ← 🔴 مسیر خراب (B26)
```

### ۳-۵. 🔴 وابستگی چرخه‌ای
```
app/(tabs)/orders.tsx:15  →  import Fonts from '../_layout'
app/_layout.tsx:151       →  export default Sentry.wrap(RootLayout)
```
`CONFIRMED` `grep -c "Fonts\." orders.tsx` → **0** (استفاده نمی‌شود).

> حذف این import بی‌خطر است، ولی طبق قوانین **اول از کاربر بپرسید**.

### ۳-۶. فایل‌های پلتفرمی (جفت)
`CONFIRMED` Metro به‌صورت خودکار `.web.tsx` را برای وب انتخاب می‌کند:
```
src/components/animated-icon.tsx      ↔  animated-icon.web.tsx  (+ .module.css)
src/components/app-tabs.tsx           ↔  app-tabs.web.tsx
src/hooks/use-color-scheme.ts         ↔  use-color-scheme.web.ts
```
> **اگر یکی را عوض کردید، هر دو را به‌روز کنید.**

### ۳-۷. ⚠️ دو منبع تنظیمات alias
```
babel.config.js   → babel-plugin-module-resolver  →  @/* → ./src/*
tsconfig.json     → paths                          →  @/* → ./src/*
```
🔴 **هر دو باید همگام بمانند.** اگر فقط یکی عوض شود:
`tsc` pass می‌شود ولی Metro در runtime شکست می‌خورد (یا برعکس).

---

## 4. وابستگی‌های پنل ادمین

### ۴-۱. 🔴 ترتیب `<script>` — اجباری
```html
<script src="core.js"></script>            ← 1
<script src="orders.js"></script>          ← 2
<script src="products.js"></script>        ← 3
<script src="visitor-sales.js"></script>   ← 4
<script src="app.js"></script>             ← 5 (آخر)
```

`CONFIRMED` هیچ‌کدام `type="module"` ندارند → global function روی `window`.

> **اگر فایل جدیدی اضافه می‌کنید، باید قبل از `app.js` در `index.html` بیاید** —
> وگرنه `app.js` خطای `ReferenceError` می‌دهد.

### ۴-۲. گراف globalها
```
core.js            → http(), getToken(), setToken(), toast(), fmt(), fa(), ...
                       ▲ همهٔ فایل‌های دیگر از این‌ها استفاده می‌کنند
orders.js          → renderOrders(), چاپ فاکتور
products.js        → renderProducts(), renderCategories(), renderBanners()
visitor-sales.js   → renderVisitorSales()
app.js             → renderLayout(), router(), bootstrap()
                       ▲ همهٔ renderXxx ها را صدا می‌زند
```

---

## 5. وابستگی‌های خارجی

### ۵-۱. بک‌اند
| سرویس | پکیج | نقطهٔ تماس | اگر قطع شود |
|---|---|---|---|
| ملی‌پیامک | `soap` | `sms.service.ts` | 🔴 ورود غیرممکن |
| Expo Push | `expo-server-sdk` | `notifications.service.ts` | 🟡 in-app کار می‌کند، push نه |
| Sentry | `@sentry/node` | `main.ts` | ✅ بی‌اثر (از قبل غیرفعال) |
| PostgreSQL | `@prisma/client` | همه‌جا | 🔴 کل API از کار می‌افتد |
| filesystem | `fs` | `files.service.ts` | 🔴 آپلود/سرو فایل |

⚠️ `CONFIRMED` WSDL ملی‌پیامک روی **HTTP ساده** است:
`http://api.payamak-panel.com/post/send.asmx?wsdl`

⚠️ `CONFIRMED` `axios` در بک‌اند نصب است ولی **صفر ارجاع** دارد (dead dependency).

### ۵-۲. موبایل
| سرویس | پکیج | اگر قطع شود |
|---|---|---|
| Expo Push | `expo-notifications` | 🟡 `try/catch` در `AuthContext` → اپ کار می‌کند |
| Sentry | `@sentry/react-native` | ✅ `enabled: !__DEV__` |
| EAS Update | `expo-updates` | 🟡 OTA متوقف |
| NetInfo | `@react-native-community/netinfo` | 🟡 `OfflineBanner` |

⚠️ `CONFIRMED` `AuthContext.tsx:16-20`:
```ts
// expo-notifications: در Expo Go SDK 53+ حذف شده — فقط در dev build کار می‌کند
let Notifications: any = null;
try { Notifications = require("expo-notifications"); } catch {}
```
✅ **عمدی** — چون در Expo Go موجود نیست.

---

## 6. 🔗 نگاشت «تغییر → وابستگی» (سریع)

| اگر این را عوض کنید | این‌ها را چک کنید |
|---|---|
| `prisma/schema.prisma` | migration · DTO · `src/types/*.ts` موبایل · `admin/*.js` |
| `prisma.service.ts` | همهٔ ۱۷ ماژول |
| `main.ts` | CORS · static · `/docs` · ValidationPipe · Sentry |
| `app.module.ts` (ترتیب) | 🔴 تعارض مسیرها (B20) |
| `jwt.strategy.ts` | همهٔ endpointهای محافظت‌شده |
| `roles.guard.ts` | همهٔ endpointهای `@Roles` |
| `orders.service.ts` | ۶۷۴ خط تست · سه مسیر ساخت سفارش |
| `notification-templates.ts` | routeهای موبایل (`data.route`) |
| `normalization.ts` | `search.service` · `products.service` · دادهٔ موجود در `nameNormalized` |
| `httpClient.ts` | همهٔ درخواست‌های موبایل |
| `AuthContext.tsx` | `CartContext` · `FavoritesContext` · همهٔ routeها |
| `CartContext.tsx` | `cart.tsx` · `_layout.tsx` (badge) · `ProductCard` |
| `theme.ts` | فقط آن‌هایی که واقعاً import می‌کنند (نه home/browse!) |
| `babel.config.js` | `tsconfig.json` (paths) |
| `app/_layout.tsx` | کل اپ |
| `public/admin/index.html` | ترتیب همهٔ `<script>`ها |
| `public/admin/core.js` | همهٔ viewهای پنل |

---

## 7. وابستگی‌های نسخه‌ای که باید هم‌نسخه بمانند

| گروه | وضعیت فعلی | چرا |
|---|---|---|
| `prisma` CLI ↔ `@prisma/client` | ✅ هر دو `^5.22.0` | schema/client |
| `@nestjs/*` | ✅ همه `^11` | breaking بین major |
| `expo` ↔ `react-native` ↔ `react` | ✅ `~56.0.13` / `0.85.3` / `19.2.3` | `npx expo install` |
| `react-native-reanimated` ↔ `react-native-worklets` | ✅ `4.3.1` / `0.8.3` | Reanimated 4 |
| `jest` ↔ `ts-jest` | ⚠️ `^30` / `^29.2.5` | mismatch ولی تست‌ها pass |
| `expo-build-properties` | 🔴 `^57.0.17` روی SDK 56 | `UNVERIFIED` |
| `typescript` موبایل | ⚠️ `~6.0.3` (بک‌اند `^5.7.3`) | متفاوت ولی مستقل |

### ۷-۱. تاریخچهٔ تصمیم‌های نسخه
`CONFIRMED` کامیت `f11b7f8`:
- `sharp` → `0.35.4` (major، برای رفع آسیب‌پذیری)
- `expo-image-picker` ۵۷ → **۵۶** (هم‌ترازی با SDK 56)
- `expo-updates` → `56.0.26`
- `@sentry/react-native` → `7.11`
- **«released-absurd major downgrades rejected»** — downgradeهای پیشنهادی `npm audit` رد شدند
- **«metro-chain pinned by RN»** — زنجیرهٔ metro با RN pin شده، دستی تغییر ندهید

---

## 8. وابستگی‌های مرده (نصب ولی بی‌استفاده)

`CONFIRMED`

### بک‌اند
| پکیج | وضعیت |
|---|---|
| `bcrypt` + `@types/bcrypt` | ❌ صفر ارجاع (پروژه password ندارد) |
| `axios` | ❌ صفر ارجاع در `src/` |
| `supertest` + `@types/supertest` | ❌ هیچ `*.e2e-spec.ts` نیست |

### موبایل
| پکیج | وضعیت |
|---|---|
| — | `UNVERIFIED` — بررسی کامل انجام نشد |

⚠️ **حذف نکنید بدون تأیید کاربر.** ممکن است برای فاز بعدی نگه داشته شده باشند.
