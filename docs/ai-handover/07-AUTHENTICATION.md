# 07 — AUTHENTICATION

---

## 1. اصل طراحی: **بدون رمز عبور**

`CONFIRMED` این پروژه **password ندارد**. احراز هویت فقط از طریق
**کد یکبار مصرف پیامکی (OTP)** انجام می‌شود.

شواهد:
- `bcrypt` در `package.json` هست ولی `grep -rn "bcrypt" src` → **صفر ارجاع**
- هیچ فیلد `password` در `prisma/schema.prisma` نیست
- هیچ endpoint لاگین با username/password وجود ندارد

---

## 2. جریان کامل احراز هویت

```
۱. POST /auth/request-otp
   body: { phone: "0912..." }
   ├─ بررسی lock (۵ تلاش ناموفق → ۱۵ دقیقه قفل)
   ├─ بررسی cooldown (۶۰ ثانیه بین درخواست‌ها)
   ├─ تولید کد ۶ رقمی
   ├─ ذخیره در DB (Otp)
   ├─ ارسال پیامک از طریق ملی‌پیامک (SOAP)
   └─ پاسخ: { message, expiresIn }
      ⚠️ اگر NODE_ENV !== "production" → testCode هم برمی‌گردد

۲. POST /auth/verify-otp
   body: { phone, code }
   ├─ اعتبارسنجی کد + TTL + attempts
   ├─ upsert User (role=CUSTOMER) + Customer (status=PENDING)
   ├─ ساخت JWT
   ├─ ست کردن کوکی HttpOnly admin_token_v3
   └─ پاسخ: { accessToken, customer, expiresIn }

۳. POST /auth/onboarding          ← 🔒 JwtAuthGuard
   body: CompleteOnboardingDto (KYC کامل + ۴ تصویر)
   ├─ ذخیرهٔ اطلاعات فروشگاه
   ├─ onboardingCompleted = true
   ├─ emit('kyc.submitted')  ✅ شنونده دارد
   └─ پاسخ: { customer }

۴. ادمین در پنل: تایید یا رد
   ├─ تایید → status = APPROVED
   │            + prisma.notification.create(...)   ✅ in-app ساخته می‌شود
   │            + emit('kyc.approved')              🔴 بدون شنونده → push نمی‌رود
   └─ رد    → status = REJECTED
                + prisma.notification.create(...)   ✅ in-app ساخته می‌شود
                + emit('kyc.rejected')              🔴 بدون شنونده → push نمی‌رود

۵. GET /auth/me                   ← 🔒 JwtAuthGuard
   └─ { customer, unreadNotificationCount }
```

---

## 3. پیکربندی OTP

`CONFIRMED` از `wholesale-api/src/auth/auth.service.ts:25-31`:

```ts
export const OTP_CONFIG = {
  CODE_LENGTH: 6,
  CODE_TTL_MS: 2 * 60 * 1000,        // ۲ دقیقه
  MAX_VERIFY_ATTEMPTS: 5,            // ۵ تلاش اشتباه
  LOCK_DURATION_MS: 15 * 60 * 1000,  // قفل ۱۵ دقیقه‌ای
  RESEND_COOLDOWN_MS: 60 * 1000,     // ۶۰ ثانیه بین درخواست‌ها
};
```

✅ `CONFIRMED` **این مقادیر hardcode هستند و هیچ کلید `.env` متناظری ندارند.**

بررسی کلیدهای واقعی `.env` (با `grep -oE '^[A-Z_][A-Z0-9_]*=' .env`):
```
هیچ‌کدام از این‌ها وجود ندارند:
  OTP_TTL · OTP_MAX_ATTEMPTS · OTP_LOCK_MINUTES · OTP_COOLDOWN
```
پس برای تغییر این مقادیر **باید کد عوض شود** (`auth.service.ts:25-31`) + deploy.

⚠️ `INFERRED` شاید بهتر باشد از `.env` خوانده شوند — ولی **بدون تأیید کاربر تغییر ندهید**
(رفتار فعلی تست‌شده است: کامیت `2ec4761`).

### ۳-۱. 🔴 باگ تأییدشده: تولید کد
```ts
randomInt(100000, 1000000)
```
`CONFIRMED` `crypto.randomInt(min, max)` **max را شامل نمی‌شود** (exclusive).
پس کد `999999` **هرگز تولید نمی‌شود** — ۸۹۹٬۹۹۹ کد ممکن به‌جای ۹۰۰٬۰۰۰.

> **اثر عملی:** ناچیز (فضای کد ۰.۰۰۰۱٪ کوچک‌تر می‌شود) ولی یک باگ واقعی است.
> اصلاح درست: `randomInt(100000, 1000000)` → `randomInt(0, 1000000)` با padStart،
> یا `randomInt(100000, 1000001)`.

### ۳-۲. ⚠️ کد OTP به‌صورت plaintext ذخیره می‌شود
`CONFIRMED` در جدول `Otp` فیلد `code` بدون hash ذخیره می‌شود.
هر کسی که به DB دسترسی دارد می‌تواند کدهای فعال را ببیند.

### ۳-۳. 🔴 `testCode` در پاسخ
```
NODE_ENV=development  (مقدار فعلی در .env)
```
`CONFIRMED` در محیط غیر-production، پاسخ `request-otp` شامل کد واقعی است.
اگر این `.env` به production برود، **هر کسی می‌تواند وارد هر حسابی شود.**

---

## 4. JWT

### ۴-۱. ساخت توکن
`CONFIRMED` از `auth/auth.service.ts` (متد `verifyOtp`):

| فیلد | مقدار |
|---|---|
| `sub` | `user.id` |
| `phone` | شماره تلفن |
| `role` | `CUSTOMER` / `ADMIN` / `VISITOR` |
| `expiresIn` | `JWT_EXPIRES_IN` یا پیش‌فرض `7d` |
| الگوریتم | پیش‌فرض `jsonwebtoken` = `HS256` |

⚠️ `CONFIRMED` در `auth.module.ts`:
```ts
secret: config.getOrThrow<string>('JWT_SECRET')
```
`getOrThrow` → اگر `JWT_SECRET` در `.env` نباشد، **اپ اصلاً راه نمی‌افتد**.

### ۴-۲. کوکی
`CONFIRMED` بک‌اند کوکی `admin_token_v3` را با `httpOnly` ست می‌کند.

🔴 `CONFIRMED` **ولی پنل ادمین نمی‌تواند آن را بخواند** —
`core.js` از `document.cookie` استفاده می‌کند که برای کوکی HttpOnly همیشه خالی است.
پس پنل همیشه از `localStorage` استفاده می‌کند.

⚠️ `CONFIRMED` **تنها جایی که `POST /auth/logout` صدا زده می‌شود پنل ادمین است.**
اپ موبایل آن را صدا نمی‌زند.

### ۴-۳. اعتبارسنجی (`JwtStrategy`)
`CONFIRMED` از `auth/jwt.strategy.ts`:

```ts
super({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  ignoreExpiration: false,
  secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
});

async validate(payload) {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    include: { customer: true },      // ← ⭐ customer هم لود می‌شود
  });
  if (!user)          throw new UnauthorizedException('کاربر احراز هویت نشده است');
  if (!user.isActive) throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
  return { userId, phone, role, customer };
}
```

✅ **تصمیم عمدی و مثبت:** هر request یک کوئری DB می‌زند، پس
غیرفعال‌کردن کاربر **بلافاصله** اثر می‌کند (بدون صبر برای انقضای توکن).

⚠️ `CONFIRMED` **`validate` وضعیت `Customer.status` را چک نمی‌کند.**
یعنی مشتری `REJECTED` یا `BLOCKED` که `user.isActive === true` است
**توکن معتبر دارد** و می‌تواند به همهٔ endpointهای JWT-only دسترسی داشته باشد.
محدودیت خرید باید جداگانه در هر سرویس چک شود.

### ۴-۴. شکل `request.user`
`CONFIRMED` از `auth/get-user.decorator.ts`:
```ts
export interface RequestUser {
  userId: string;
  phone: string;
  role: UserRole;
  customer: Customer | null;
}
```
با `@GetUser()` یا `@Req() req: AuthedRequest` در دسترس است.

---

## 5. Guardها

### ۵-۱. سه guard موجود

| Guard | فایل | رفتار |
|---|---|---|
| `JwtAuthGuard` | `auth/jwt-auth.guard.ts` | `AuthGuard('jwt')` خالص — 401 اگر توکن نباشد |
| `OptionalJwtAuthGuard` | `auth/optional-jwt-auth.guard.ts` | `handleRequest` → `user \|\| null` — هرگز throw نمی‌کند |
| `RolesGuard` | `auth/roles.guard.ts` | `@Roles(...)` را می‌خواند؛ اگر metadata نباشد → `true` |

### ۵-۲. `OptionalJwtAuthGuard` — برای مرور مهمان
```ts
handleRequest<TUser>(err, user): TUser {
  return (user || null) as unknown as TUser;   // بدون throw
}
```
✅ استفاده در `GET /products` تا هم مهمان و هم کاربر لاگین‌شده بتوانند ببینند.

⚠️ `CONFIRMED` **این guard در `AuthModule` export شده** و `SearchModule` هم
`AuthModule` را import می‌کند — پس هر دو در دسترس‌اند.

### ۵-۳. `RolesGuard` — منطق
```ts
const requiredRoles = reflector.getAllAndOverride(ROLES_KEY, [handler, class]);
if (!requiredRoles || requiredRoles.length === 0) return true;   // ← ⚠️ پیش‌فرض: اجازه
if (!user) throw new ForbiddenException('دسترسی مجاز نیست');
if (!requiredRoles.includes(user.role)) throw new ForbiddenException(...);
return true;
```

⚠️ `CONFIRMED` **اگر `@Roles` نباشد، همه عبور می‌کنند.** این fail-open است.
پس forgetting `@Roles` روی یک endpoint ادمین = دسترسی عمومی.

### ۵-۴. 🔴 `RolesGuard` در `visitor-sales.controller.ts` نیست
`CONFIRMED` → `15-SECURITY.md` §S4.

### ۵-۵. `UserRole.VISITOR`
`CONFIRMED` نقش **استفاده می‌شود**:
- `prisma/seed.ts:43` کاربر `VISITOR` از `VISITOR1_PHONE`/`VISITOR2_PHONE` می‌سازد
- `original-docs/README-TEST.md` همین را برای تست IDOR مستند کرده
- `visitor-sales.controller.ts` اکنون `@Roles(UserRole.ADMIN, UserRole.VISITOR)` دارد

⚠️ در `.env` فعلی `VISITOR1/2_PHONE` تنظیم نشده (فقط در `.env.example`) →
الان کاربر `VISITOR` فعالی وجود ندارد، ولی **قصد طراحی روشن است** و نباید نقش را حذف کرد.

---

## 6. جدول endpointهای `auth.controller.ts`

`CONFIRMED` — ۹ endpoint:

| متد | مسیر | Guard | DTO | توضیح |
|---|---|---|---|---|
| POST | `/auth/request-otp` | — (عمومی) | `RequestOtpDto` | ارسال کد |
| POST | `/auth/verify-otp` | — (عمومی) | `VerifyOtpDto` | تایید کد + صدور JWT |
| POST | `/auth/onboarding` | `JwtAuthGuard` | `CompleteOnboardingDto` | تکمیل KYC |
| GET | `/auth/me` | `JwtAuthGuard` | — | پروفایل + تعداد unread |
| GET | `/auth/kyc-status` | `JwtAuthGuard` | — | وضعیت تایید |
| PATCH | `/auth/profile` | `JwtAuthGuard` | `UpdateProfileDto` | ویرایش پروفایل |
| POST | `/auth/profile/sensitive-change` | `JwtAuthGuard` | `SensitiveChangeDto` | درخواست تغییر حساس |
| GET | `/auth/profile/pending-changes` | `JwtAuthGuard` | — | تغییرات در انتظار |
| POST | `/auth/logout` | `JwtAuthGuard` | — | خروج (فقط پنل صدا می‌زند) |

⚠️ `CONFIRMED` **هیچ `@Roles` در `auth.controller.ts` نیست** — همه برای همهٔ نقش‌ها باز است.

---

## 7. KYC (Onboarding)

### ۷-۱. مدارک لازم
`CONFIRMED` از `auth/dto/complete-onboarding.dto.ts` (۲۷۶ خط):

| فیلد | نوع |
|---|---|
| نام، نام خانوادگی، نام فروشگاه | متن |
| کد ملی | `@IsString` + الگو |
| تلفن ثابت | اختیاری |
| استان | `@Equals('زنجان')` |
| شهر | `@IsIn(['ابهر','خرمدره','هیدج','صائین‌قلعه'])` |
| آدرس | متن |
| تصویر کارت ملی | آپلود |
| تصویر پروانه کسب | آپلود |
| سلفی | آپلود |
| نمای فروشگاه | آپلود |

### ۷-۲. 🔒 محدودیت جغرافیایی hardcode
```
خدمات‌رسانی فعلاً فقط در استان زنجان فعال است
شهر انتخاب شده خارج از محدوده پوشش‌دهی لجیستیک ماست
```
`CONFIRMED` این رشته‌ها در DTO هستند، نه در `Setting` یا `.env`.
**اضافه‌کردن یک شهر = تغییر کد + migration نیست، ولی deploy لازم دارد.**

### ۷-۳. وضعیت‌های `Customer.status`
```
PENDING   → در انتظار بررسی ادمین
APPROVED  → ✅ می‌تواند قیمت ببیند و سفارش بدهد
REJECTED  → باید مدارک را اصلاح کند
BLOCKED   → مسدود
```

⚠️ `CONFIRMED` **ناهمخوانی در redirect موبایل:**
`index.tsx` برای `REJECTED` به onboarding می‌فرستد؛
`_layout.tsx` این حالت را **چک نمی‌کند** → `05-APP-STARTUP-FLOW.md` §5.

---

## 8. احراز هویت سمت موبایل

### ۸-۱. ذخیره‌سازی توکن
`CONFIRMED` از `src/storage/authStorage.ts` (۳۲۶ خط):

| داده | محل |
|---|---|
| `accessToken` | **expo-secure-store** (رمزنگاری‌شده) |
| `customer` | **expo-secure-store** |
| `guestModeActive` | AsyncStorage |
| `hasSeenWelcome` | AsyncStorage |

⚠️ `CONFIRMED` `authStorage.clearAll()` هر دو را پاک می‌کند.

### ۸-۲. تزریق توکن
`CONFIRMED` در `src/api/httpClient.ts` یک request interceptor:
```
Authorization: Bearer <accessToken>
```

### ۸-۳. مدیریت 401
`CONFIRMED` response interceptor روی 401 → پاک‌کردن session → بازگشت به welcome.

### ۸-۴. 🔴 `logout()` سرور را صدا نمی‌زند
`CONFIRMED` از `AuthContext.tsx:179-199`:
```ts
const logout = async () => {
  if (customer?.id) await notificationsApi.removePushToken().catch(() => {});
  await authStorage.clearAll();
  setCustomer(null); setAccessToken(null); setUnreadNotificationCount(0);
  setAuthStatus("unauthenticated");
};
```
❌ **هیچ فراخوانی `POST /auth/logout` نیست.**

> **پیامد:** توکن JWT تا ۷ روز معتبر می‌ماند. اگر لو رفته باشد، logout کاربر باطلش نمی‌کند.

---

## 9. احراز هویت پنل ادمین

`CONFIRMED` پنل ادمین **endpoint جدا ندارد** — همان `/auth/request-otp` و `/auth/verify-otp`.
تفاوت فقط در این است که شمارهٔ واردشده `role === 'ADMIN'` دارد.

### ۹-۱. 🔴 باگ `getAuthToken()`
`CONFIRMED` در `public/admin/core.js`:
```js
// تلاش برای خواندن کوکی HttpOnly
document.cookie  // ← همیشه خالی برای کوکی‌های HttpOnly
```
→ همیشه به fallback (`localStorage`) می‌رسد.

### ۹-۲. seed ادمین
`CONFIRMED` `prisma/seed.ts` یک کاربر ادمین می‌سازد.
🔴 **مقدار شمارهٔ ادمین در seed.ts است — آن را در مستندات/خروجی چاپ نکنید.**

---

## 10. خلاصهٔ نقاط ضعف احراز هویت

| # | مسئله | شدت | منبع |
|---|---|---|---|
| A1 | `testCode` در پاسخ غیر-production | 🔴 بحرانی | `auth.service.ts` |
| A2 | `JWT_SECRET` زنده در زیپ گیت‌هاب | 🔴 بحرانی | `.env` |
| A3 | rate limit اعمال نشده → brute force روی OTP | 🔴 بحرانی | `app.module.ts` |
| A4 | `validate` وضعیت `Customer.status` را چک نمی‌کند | 🟠 زیاد | `jwt.strategy.ts:27-47` |
| A5 | کد OTP به‌صورت plaintext در DB | 🟠 زیاد | جدول `Otp` |
| A6 | `RolesGuard` fail-open | 🟠 زیاد | `roles.guard.ts:16-18` |
| A7 | موبایل `POST /auth/logout` را صدا نمی‌زند | 🟡 متوسط | `AuthContext.tsx:179` |
| A8 | `randomInt` هیچ‌وقت ۹۹۹۹۹۹ نمی‌دهد | 🟢 کم | `auth.service.ts` |
| A9 | کوکی `admin_token_v3` عملاً بی‌استفاده | 🟢 کم | `core.js` |
| A10 | `bcrypt` نصب ولی بی‌استفاده | 🟢 کم | `package.json` |

→ جزئیات در `15-SECURITY.md`
