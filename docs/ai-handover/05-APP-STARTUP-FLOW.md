# 05 — APP STARTUP FLOW

---

## 1. بک‌اند — ترتیب دقیق bootstrap

`CONFIRMED` از `wholesale-api/src/main.ts` (۱۰۳ خط، `bootstrap()`)

```
۱. NestFactory.create<NestExpressApplication>(AppModule)
     └─ در همین مرحله همهٔ ماژول‌ها initialize می‌شوند:
         • PrismaService (onModuleInit → $connect)
         • ConfigModule (.env خوانده می‌شود)
         • EventEmitterModule (شنونده‌ها ثبت می‌شوند)
         • ScheduleModule (@Cron ها زمان‌بندی می‌شوند)

۲. اگر process.env.SENTRY_DSN موجود بود:
     • Sentry.init({ dsn, nodeProfilingIntegration, tracesSampleRate:1.0, profilesSampleRate:1.0 })
     • app.useGlobalFilters(new SentryFilter())
   🔴 CONFIRMED: SENTRY_DSN در .env نیست → این بلوک اجرا نمی‌شود.

۳. app.useGlobalPipes(new ValidationPipe({
       whitelist: true,            ← فیلدهای ناشناخته حذف می‌شوند
       forbidNonWhitelisted: true, ← فیلد ناشناخته = خطای 400
       transform: true,            ← DTO instance ساخته می‌شود
   }))
   ⚠️ هیچ skipMissingProperties یا exceptionFactory سفارشی نیست.

۴. CORS:
     origin = CORS_ORIGINS?.split(',')  ??  [
       'http://localhost:3000',
       'http://localhost:19006',   ← Metro bundler
       'http://127.0.0.1:3000',
     ]
     credentials: true
     methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
     allowedHeaders: Content-Type, Authorization

۵. Static admin:
     if (fs.existsSync('public/admin')) app.useStaticAssets(..., { prefix: '/admin' })

۶. ساخت دایرکتوری‌های uploads:
     uploads/kyc · uploads/products · uploads/categories  (mkdirSync recursive)
     ⚠️ static سرو نمی‌شوند — فقط از طریق FilesController

۷. Swagger:
     • DocumentBuilder → title 'Bonko Market API', version '1.0', addBearerAuth()
     • 🛡️ middleware روی ['/docs','/docs-json']:
          req.socket.remoteAddress باید 127.0.0.1 / ::1 / ::ffff:127.0.0.1 باشد
          وگرنه → 404 (عمداً 404، نه 403)
     • SwaggerModule.setup('docs', ...) با persistAuthorization: true

۸. app.listen(PORT ?? 3000, '0.0.0.0')
   ⚠️ به 0.0.0.0 bind می‌شود — از بیرون قابل دسترسی است.
```

### ۱-۱. چیزهایی که در bootstrap **نیست**
`CONFIRMED`
- ❌ `helmet()` — نصب نیست
- ❌ `compression()` — نصب نیست
- ❌ `app.setGlobalPrefix(...)` — **پیشوند `/api` وجود ندارد**
- ❌ `app.useGlobalGuards(new ThrottlerGuard())` — 🔴 rate limit اعمال نشده
- ❌ `app.useGlobalInterceptors(...)` — هیچ logging interceptor
- ❌ `express.json({ limit })` سفارشی — پیش‌فرض NestJS

> ⚠️ `CONFIRMED` **URLها بدون prefix هستند:** `/auth/...`, `/orders/...`, `/products/...`
> ولی متن Swagger می‌گوید `/auth/verify-otp`. این درست است.
> اگر مستندات قدیمی `/api/auth/...` نوشته‌اند، **غلط است**.

---

## 2. بک‌اند — زمان‌بندی `@Cron` بکاپ

`CONFIRMED` `src/backup/backup.service.ts`:
```ts
@Cron(process.env.BACKUP_INTERVAL)
```

🔴 **مشکل ترتیب:** decoratorها در **زمان parse فایل** ارزیابی می‌شوند،
یعنی **قبل از** اینکه `ConfigModule` فایل `.env` را بخواند.

`UNVERIFIED` — نتوانستم سرور را اجرا کنم تا ببینم واقعاً چه می‌شود.
سه حالت ممکن:
1. `.env` توسط shell/source قبلاً در `process.env` باشد → کار می‌کند
2. نباشد → `process.env.BACKUP_INTERVAL` = `undefined` → `@Cron(undefined)` احتمالاً خطا
3. رشتهٔ خالی → رفتار نامشخص

> **قاعده:** این را «درست» نکنید بدون اینکه واقعاً سرور را با `.env` اجرا کرده باشید.
> اگر درستش می‌کنید، الگوی درست `@nestjs/schedule` استفاده از
> `SchedulerRegistry` + `CronJob` در `onModuleInit` است.

---

## 3. موبایل — ترتیب دقیق راه‌اندازی

`CONFIRMED` از `wholesale-mobile/app/_layout.tsx`

### ۳-۱. در سطح ماژول (قبل از render)
```
۱. import ها اجرا می‌شوند
     ⚠️ orders.tsx:15 → import Fonts from '../_layout'  ← 🔴 import چرخه‌ای (dead)

۲. SplashScreen.preventAutoHideAsync()            ← خط ۲۱

۳. Sentry.init({
       dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || "",
       tracesSampleRate: 1.0,
       enabled: !__DEV__,                          ← در DEV خاموش است
       integrations: [Sentry.reactNavigationIntegration()],
   })                                              ← خط ۲۳-۲۸
```

### ۳-۲. Render ریشه
```
۴. RootLayout() اجرا می‌شود (خط ۱۰۸)
     useFonts({ 6 وزن Vazirmatn })  ← از ../assets/fonts/ 🔴 مسیر خراب

۵. اگر (!fontsLoaded && !fontError) → return null
     ⚠️ یعنی تا فونت لود نشود، هیچ‌چیز render نمی‌شود.

۶. StatusBar style="dark"
   Sentry.ErrorBoundary fallback={SentryFallback → CustomFallback}
   AuthProvider            ← syncAuthState() در useEffect شروع می‌شود
     CartProvider
       FavoritesProvider
         SafeAreaProvider
           SafeAreaView edges=[top,left,right,bottom] onLayout={onLayoutRootView}
             FontApplied   ← RNText.defaultProps.style را patch می‌کند
             OfflineBanner
             RootNavigator
```

### ۳-۳. `onLayoutRootView`
```ts
if (fontsLoaded || fontError) await SplashScreen.hideAsync();
```
⚠️ `CONFIRMED` اگر `useFonts` خطا بدهد (`fontError`)، splash **همچنان پنهان می‌شود**
و اپ با فونت سیستم بالا می‌آید. این رفتار عمدی است (خطای فونت نباید اپ را بلاک کند).

### ۳-۴. `FontApplied` — patch کردن `defaultProps`
```ts
RNText.defaultProps.style = [{ fontFamily: "Vazirmatn" }, RNText.defaultProps.style];
RNTextInput.defaultProps.style = [{ fontFamily: "Vazirmatn" }, RNTextInput.defaultProps.style];
```
⚠️ `CONFIRMED` در `useMemo` با `[]` انجام می‌شود (فقط یک‌بار) و داخل `try/catch` خالی است.

🔴 **این یک الگوی deprecated در React 19 است.** `defaultProps` روی function componentها
در React 19 حذف شده. `INFERRED` ممکن است در React 19.2 بی‌اثر باشد یا warning بدهد.
`UNVERIFIED` — نتوانستم اپ را اجرا کنم.

> **قبل از «تمیز کردن» این کد، اول verify کنید فونت‌ها هنوز اعمال می‌شوند.**

---

## 4. موبایل — restore کردن session

`CONFIRMED` از `src/context/AuthContext.tsx:65-131` → `syncAuthState()`

```
useEffect(() => syncAuthState(), [])     ← فقط یک‌بار در mount
    │
    ├─ setLoading(true); setAuthStatus("loading")
    │
    ├─ const stored = await authStorage.getTokensAndCustomer()
    │
    ├─ ❌ اگر stored === null:
    │     • setCustomer(null), setAccessToken(null), setUnreadNotificationCount(0)
    │     • const guestActive = await authStorage.getGuestModeActive()
    │     • setAuthStatus(guestActive ? "guest" : "unauthenticated")
    │     • return
    │
    ├─ ✅ اگر stored موجود بود:
    │     • setCustomer(stored.customer); setAccessToken(stored.accessToken)
    │     • setAuthStatus("authenticated")        ← 🟡 قبل از verify شدن توکن!
    │     • await authStorage.setGuestModeActive(false)
    │     • 🔸 void getMeApi()  (async، best-effort، منتظر نمی‌ماند)
    │           → اگر موفق: setCustomer(me.customer) + unreadNotificationCount
    │                       + ذخیرهٔ دوباره در storage
    │           → اگر خطا: فقط console.warn — state ذخیره‌شده باقی می‌ماند
    │     • 🔸 اگر Platform.OS !== "web" && Notifications:
    │           getExpoPushTokenAsync() → notificationsApi.registerPushToken()
    │
    └─ catch → authStorage.clearAll() + setAuthStatus("unauthenticated")
```

### ۴-۱. ⚠️ رفتار مهم: `authenticated` قبل از اعتبارسنجی
`CONFIRMED` `authStatus` بلافاصله `"authenticated"` می‌شود، **بدون** اینکه توکن چک شود.
اعتبارسنجی واقعی وقتی اتفاق می‌افتد که interceptor در `httpClient.ts` یک `401` بگیرد.

> **پیامد:** یک کاربر با توکن منقضی، لحظه‌ای UI لاگین‌شده می‌بیند تا اولین درخواست 401 بدهد.

### ۴-۲. چهار حالت `authStatus`
```ts
export type AuthStatus = "loading" | "unauthenticated" | "guest" | "authenticated";
```
`CONFIRMED` کامنت صریح در `AuthContext.tsx:22-26`:
| حالت | معنی |
|---|---|
| `loading` | در حال restore از storage |
| `unauthenticated` | نه session نه guest — باید `welcome` را ببیند |
| `guest` | کاربر مهمان، لاگین نکرده ولی داخل اپ است |
| `authenticated` | کاربر واقعی با accessToken و customer |

---

## 5. موبایل — منطق redirect (دو جا، ناسازگار!)

### ۵-۱. `app/index.tsx` — نسخهٔ کامل
```
if (authStatus === "loading") return null;

isRejectedCustomer = customer?.status === "REJECTED"

if (authenticated && (needsOnboarding || isRejectedCustomer))  → /onboarding
if (authenticated || guest)                                    → /(tabs)/home
else                                                           → /welcome
```

### ۵-۲. `app/_layout.tsx` → `RootNavigator` — نسخهٔ ناقص
```
if (!rootNavigationState?.key || authStatus === "loading") return;

rootSegment = segments[0]

if (unauthenticated && (rootSegment === "(tabs)" || rootSegment === "onboarding"))
    → /welcome
else if (authenticated && needsOnboarding && rootSegment !== "onboarding")
    → /onboarding
else if (authenticated && !needsOnboarding && (rootSegment === "welcome" || rootSegment === "(auth)"))
    → /(tabs)/home

if (redirectTo && lastRedirectRef.current !== redirectTo) router.replace(redirectTo)
```

### 🔴 تناقض تأییدشده — `REJECTED`

| | `index.tsx` | `_layout.tsx` |
|---|---|---|
| `needsOnboarding` | ✅ چک می‌شود | ✅ چک می‌شود |
| **`status === "REJECTED"`** | ✅ **چک می‌شود** | ❌ **چک نمی‌شود** |
| `guest` | ✅ → home | ❌ هیچ شرطی ندارد |

> **پیامد `CONFIRMED`:** مشتری ردشده که **قبلاً** onboarding را کامل کرده
> (`needsOnboarding === false`) و مستقیم به یک تب می‌رود، توسط `_layout` به onboarding
> هدایت نمی‌شود. فقط اگر از `index.tsx` وارد شده باشد redirect می‌شود.

> **پیامد دوم:** کاربر `guest` در `_layout` هیچ redirect نمی‌گیرد. اگر در `(auth)` باشد
> همان‌جا می‌ماند.

---

## 6. موبایل — جریان ورود (login)

```
welcome.tsx
   │
   ├─ «ورود / ثبت‌نام» → router.push("/(auth)/login")
   │
   └─ «ورود به عنوان مهمان» → handleContinueAsGuest()
          ├─ router.replace(...)        ← ⚠️ کامنت خودش می‌گوید «لازم نیست»
          └─ continueAsGuest()          ← setGuestModeActive(true) در AsyncStorage
                                          setAuthStatus("guest")

(auth)/login.tsx
   │  شماره تلفن → POST /auth/request-otp
   │     ⚠️ NODE_ENV=development → پاسخ شامل testCode است
   └─ router.push("/(auth)/otp?phone=...")

(auth)/otp.tsx
   │  ۶ رقم → POST /auth/verify-otp
   │     → { accessToken, customer }
   └─ await login(token, customer)
          ├─ authStorage.saveTokensAndCustomer()
          ├─ setGuestModeActive(false)
          ├─ setAuthStatus("authenticated")
          ├─ await getMeApi()   ← در login منتظر می‌ماند (برخلاف restore)
          └─ registerPushToken()

onboarding.tsx (اگر needsOnboarding)
   │  فرم چندمرحله‌ای KYC + آپلود ۴ تصویر
   └─ POST /auth/onboarding → completeOnboarding(customer)

→ /(tabs)/home
```

⚠️ `CONFIRMED` **تناقض در `welcome.tsx`:** `handleContinueAsGuest` هم
`router.replace` می‌کند و هم `continueAsGuest()` را صدا می‌زند،
در حالی که کامنت خودش می‌گوید replace «لازم نیست».

---

## 7. پنل ادمین — ترتیب bootstrap

`CONFIRMED` از `public/admin/index.html` و `app.js`

```
۱. index.html بارگذاری می‌شود (dir="rtl"، lang="fa")
۲. styles.css
۳. core.js      → global: http(), getToken(), setToken(), toast(), fmt(), fa(), ...
۴. orders.js
۵. products.js
۶. visitor-sales.js
۷. app.js       → bootstrap:
      • getAuthToken()
      • اگر نبود → فرم لاگین (همان OTP مشتری)
      • اگر بود → renderLayout() + route بر اساس location.hash
```

### ۷-۱. 🔴 باگ تأییدشده در `getAuthToken()`
`CONFIRMED` `core.js` سعی می‌کند توکن را از `document.cookie` بخواند:
```js
// تلاش برای خواندن کوکی HttpOnly — غیرممکن است
document.cookie  →  کوکی HttpOnly در JavaScript قابل دیدن نیست
```
پس همیشه به fallback (`localStorage`) می‌رسد.

> **پیامد:** کوکی `admin_token_v3` که بک‌اند ست می‌کند هرگز توسط پنل خوانده نمی‌شود.
> پنل فقط از `Authorization: Bearer <localStorage>` استفاده می‌کند.

---

## 8. نمودار وضعیت کامل (موبایل)

```
                        ┌──────────┐
      cold start  ────► │ loading  │
                        └────┬─────┘
                             │ syncAuthState()
              ┌──────────────┼───────────────┐
              │              │               │
     stored=null      stored=null      stored OK
     guest=false      guest=true
              ▼              ▼               ▼
      ┌───────────────┐ ┌─────────┐  ┌───────────────┐
      │unauthenticated│ │  guest  │  │ authenticated │
      └───────┬───────┘ └────┬────┘  └──────┬────────┘
              │              │              │
        /welcome        /(tabs)/home   needsOnboarding?
              │              │              │
        login → OTP    addToCart →     ┌────┴────┐
              │        «وارد شوید»    yes        no
              │              │          │         │
              └──────────────┼──────► /onboarding │
                             │          │    REJECTED?
                             │          └────┴────┐
                             │           yes      no
                             │            │        │
                             │      /onboarding  /(tabs)/home
                             │
                       logout() → authStorage.clearAll() → unauthenticated
                       ⚠️ POST /auth/logout هرگز صدا زده نمی‌شود
```

---

## 9. چیزهایی که در startup **اتفاق نمی‌افتد** (ولی انتظارش را دارید)

`CONFIRMED`
| مورد | وضعیت |
|---|---|
| `useForceUpdate()` در `_layout.tsx` | ⚠️ فقط import شده (خط ۱۷) — **هرگز صدا زده نمی‌شود** |
| `POST /auth/logout` هنگام خروج | ❌ فقط پاک‌کردن local storage |
| ثبت `notificationRouting` برای deep link | ❌ فایل هرگز import نشده |
| merge سبد مهمان بعد از لاگین | `UNVERIFIED` — باید در `login` جستجو شود |
| health check / readiness | ❌ NOT FOUND |
| `lastSeenAt` | ❌ هرگز نوشته نمی‌شود |
