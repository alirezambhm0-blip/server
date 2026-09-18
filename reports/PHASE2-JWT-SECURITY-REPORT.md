# BONKO MARKET — PHASE 2
# ADMIN JWT SECURITY HARDENING (P1-4)

**تاریخ:** ۲۰۲۶-۰۹-۰۸ · **نقش:** Senior Application Security Engineer · **پرامپت:** `Bonko Market — Phase 2 Admin JWT Security.pdf` (۱۹ صفحه)

---

## 1. Executive Result

# ✅ PASS

توکن احراز هویت ادمین از `localStorage` حذف شد و احراز هویت به کوکی HttpOnly منتقل شد. با آزمون روی **کد واقعی** (نه mock) اثبات شد که یک payload XSS دیگر نمی‌تواند توکن را از `localStorage` / `sessionStorage` / متغیر سراسری بخواند یا از طریق هدرهای درخواست ربایش کند.

**تعیین CASE:** این **CASE B** بود، نه CASE A. ممیزی نشان داد backend کوکی را **صادر** می‌کرد ولی **با آن احراز هویت نمی‌کرد** — `jwt.strategy.ts:21` تنها `ExtractJwt.fromAuthHeaderAsBearerToken()` بود. بنابراین حداقل تغییر سمت backend لازم بود.

**یک باگ بحرانی اضافی کشف و رفع شد:** logout کوکی را عملاً پاک نمی‌کرد (پاس دوم، بخش ۸).

| سنجه | مقدار |
|---|---|
| تست استراتژی احراز هویت (جدید) | **۱۷ / ۱۷ PASS** |
| رگرسیون XSS/توکن (jsdom) | **۱۳ / ۱۳ PASS** |
| تست ترتیب logout | **۶ / ۶ PASS** |
| رگرسیون XSS فاز ۱ | **۲۱ / ۲۱ + ۹ / ۹ PASS** |
| `npm run build` | **PASS** (exit 0) |
| `npm test` | **PASS** (8 suites / 74 tests) |
| `npx prisma validate` | **PASS** |
| فایل تغییر یافته | **۳ + ۱ تست جدید** |
| فایل موبایل تغییر یافته | **۰** |

---

## 2. Before → After

**Before:**
```
Admin Login → verify-otp → { accessToken } در پاسخ
                           + کوکی HttpOnly ست می‌شد (ولی هرگز استفاده نمی‌شد!)
   ↓
localStorage.setItem('admin_token_v3', accessToken)      ← JS-خواندنی
   ↓
api() → headers['Authorization'] = 'Bearer ' + localStorage.getItem(...)
   ↓
jwt.strategy.ts:21 → ExtractJwt.fromAuthHeaderAsBearerToken()   ← فقط Bearer
```

**After:**
```
Admin Login → verify-otp → کوکی HttpOnly `admin_token_v3`
   ↓
مرورگر کوکی را نگهداری می‌کند (JS به آن دسترسی ندارد)
   ↓
api() → credentials:'include'  (بدون هیچ هدر Authorization)
   ↓
jwt.strategy.ts → fromExtractors([ Bearer , fromAdminAuthCookie ])   ← کوکی هم پذیرفته می‌شود
```

### نکتهٔ کلیدی که ممیزی آشکار کرد
`core.js` یک تابع `getCookie()` داشت که کوکی را با `document.cookie` می‌خواند و کامنتش می‌گفت «Cookies (HttpOnly) are preferred for security». **این مسیر هرگز نمی‌توانست کار کند** — کوکی با پرچم `HttpOnly` برای `document.cookie` نامرئی است. یعنی آن «معماری کوکی» صرفاً تزئینی بود و تنها چیزی که عملاً کار می‌کرد fallback به `localStorage` بود.

---

## 3. Authentication Flow (نهایی)

```
Admin Login UI (app.js:22-38)
  ↓  POST /auth/request-otp  { phone }
  ↓  POST /auth/verify-otp   { phone, code }
auth.controller.ts:45-67
  ↓  authService.verifyOtp() → JWT امضا شده با JWT_SECRET (JWT_EXPIRES_IN پیش‌فرض 7d)
  ↓  res.cookie('admin_token_v3', token, {httpOnly:true, secure:isProd, sameSite:'lax', path:'/', maxAge:7d})
مرورگر کوکی را ذخیره می‌کند  ← JS دسترسی ندارد
  ↓
SPA: state.authed = true (بدون ذخیرهٔ توکن)
  ↓
درخواست‌های بعدی: api() با credentials:'include'
  ↓
jwt.strategy.ts → fromExtractors([ Bearer , fromAdminAuthCookie ])
  ↓  validate(): کاربر وجود دارد + isActive + Customer.status !== 'BLOCKED'
  ↓
admin.controller.ts:51-52 → @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(UserRole.ADMIN)
  ↓  roles.guard.ts:21-23 → نقش نامنطبق ⇒ ForbiddenException (403)
```

**Bootstrap نشست:** چون دیگر توکنی در JS نیست، وضعیت ورود از سرور پرسیده می‌شود — `GET /auth/me` با کوکی احراز هویت می‌شود و `me.role === 'ADMIN'` بررسی می‌گردد.

---

## 4. Files Changed

| فایل | تغییر | دلیل (الزام دقیق فاز ۲) |
|---|---|---|
| `wholesale-api/src/auth/jwt.strategy.ts` | افزودن `fromAdminAuthCookie` + `ExtractJwt.fromExtractors([Bearer, cookie])` | **STEP 13** — استراتژی فقط Bearer استخراج می‌کرد؛ کوچک‌ترین مکانیزم سازگار برای استخراج کوکی. Bearer برای موبایل **حفظ شد**. |
| `wholesale-api/public/admin/core.js` | حذف `getAuthToken`/`getCookie`/`setAuthToken`؛ حذف هدر Authorization از `api()` و `secureBlob()`؛ افزودن `credentials:'include'` به `secureBlob`؛ افزودن گزینهٔ `noReload`؛ `clearAuthToken` حالا Promise برمی‌گرداند | **STEP 7 + 10** — حذف توکن JS-خواندنی و تمرکز روی یک helper مشترک (۶۴ فراخوانی API همه از `api()` می‌گذرند) |
| `wholesale-api/public/admin/app.js` | `state.token` → `state.authed`؛ حذف `localStorage.setItem` در لاگین؛ جایگزینی `render()` با `bootstrapSession()`؛ دکمهٔ خروج حالا await می‌کند | **STEP 7 + 11 + 12** — حذف ذخیرهٔ توکن و اصلاح logout |
| `wholesale-api/src/auth/jwt-strategy-cookie.spec.ts` | **فایل جدید** — ۱۷ تست | **STEP 15** — تست واقعی مکانیزم احراز هویت |

**اثبات مرز تغییرات** (`md5sum -c PHASE2_BASELINE.md5`):
```
app.js               FAILED  ← تغییر یافته
core.js              FAILED  ← تغییر یافته
jwt.strategy.ts      FAILED  ← تغییر یافته
orders.js            OK      ← دست‌نخورده در فاز ۲ (تغییرش مال فاز ۱ است)
products.js          OK · visitor-sales.js  OK · index.html  OK
auth.controller.ts   OK · auth.service.ts   OK · main.ts     OK · app.module.ts OK
```

---

## 5. localStorage Audit

جست‌وجوی مستقل در کل `public/admin/` (خطوط کامنت حذف شده):

| الگو | تعداد | جزئیات |
|---|---|---|
| `localStorage.setItem` | **۰** | حذف شد (`app.js:29` و `core.js:54`) |
| `localStorage.getItem` | **۰** | حذف شد (`app.js:4`، `core.js:37`، `core.js:96`) |
| `localStorage.removeItem` | **۱** | `core.js:50` — **باقی ماند، عمدی و لازم** |
| `sessionStorage` | **۰** | هرگز استفاده نشده و جایگزین localStorage نشد |
| `Authorization` / `Bearer` | **۰** | هر دو هدر حذف شدند (تنها باقیمانده یک کامنت در `visitor-sales.js:361`) |
| `getAuthToken` / `setAuthToken` | **۰** | توابع حذف شدند |
| `state.token` / `.accessToken` | **۰** | حذف شدند |
| `document.cookie` | **۰** | `getCookie()` حذف شد |
| `TOKEN_KEY` | **۲** | تعریف (`core.js:2`) + همان `removeItem` — نام کلید است، نه توکن |

**چرا `removeItem` باقی ماند (و ایمن است):** کاربرانی که **پیش از** این تغییر لاگین کرده‌اند یک JWT زنده در `localStorage` دارند. بدون این پاک‌سازی، آن توکن تا ۷ روز در مرورگرشان می‌ماند. `removeItem` هیچ توکنی را نمی‌خواند و نمی‌نویسد؛ STEP 7 صراحتاً فقط `setItem`/`getItem` را ممنوع کرده. این تنها ارجاع کدی باقی‌مانده است.

---

## 6. Cookie Security

`auth.controller.ts:57-63` — **تغییر نکرد** (طبق STEP 8 «مقادیر را کورکورانه تغییر ندهید»). ارزیابی:

| پرچم | مقدار | ارزیابی |
|---|---|---|
| **HttpOnly** | `true` | ✅ الزامی — همین پرچم مانع خواندن توسط JS می‌شود |
| **Secure** | `process.env.NODE_ENV === 'production'` | ✅ درست. چون از `NODE_ENV` خوانده می‌شود نه `req.secure`، پشت nginx که TLS را terminate می‌کند هم `Secure` درست ست می‌شود. در dev روی `http://localhost` غیرفعال است که برای کارکرد localhost **ضروری** است — بدون تضعیف production |
| **SameSite** | `'lax'` | ✅ کافی (تحلیل کامل در بخش ۷). `strict` نمی‌گذاشت ادمین از یک لینک خارجی وارد پنل شود و هنوز لاگین باشد |
| **Path** | `'/'` | ✅ لازم — پنل در `/admin` و API در `/auth`، `/admin`، `/files` است |
| **Domain** | ست نشده | ✅ صحیح — کوکی host-only می‌شود و به زیردامنه‌ها نشت نمی‌کند |
| **Max-Age** | ۷ روز | هم‌راستا با `JWT_EXPIRES_IN` پیش‌فرض `7d` |
| **`res.clearCookie`** | `:116-121` با **همان پرچم‌ها** | ✅ تطابق پرچم‌ها برای پاک شدن کوکی در مرورگر ضروری است |

**CORS** (`main.ts:26-31`): `credentials: true` با فهرست صریح origin از `CORS_ORIGINS`. **`Access-Control-Allow-Origin: *` استفاده نشده** ⇒ سازگار با درخواست‌های credentialed. **تغییر نکرد.**

**Proxy:** پنل ادمین از `/admin` روی **همان اپ Nest** سرو می‌شود (`main.ts` → `useStaticAssets(..., {prefix:'/admin'})`) ⇒ **same-origin**. این ساده‌ترین و امن‌ترین حالت است و هیچ تنظیم cross-origin لازم نیست.

---

## 7. CSRF Analysis

### تهدید
انتقال اعتبارنامه از هدر `Authorization` به کوکی، مدل تهدید CSRF را تغییر می‌دهد: مرورگر کوکی را **خودکار** ضمیمه می‌کند، پس یک صفحهٔ مهاجم می‌تواند درخواستی بفرستد که کوکی را حمل کند.

⚠️ صراحتاً: **HttpOnly هیچ حفاظتی در برابر CSRF نیست.** HttpOnly فقط توکن را از JS پنهان می‌کند.

### حفاظت فعلی
1. **`SameSite=Lax`** — مرورگر کوکی را در درخواست‌های **cross-site غیر از top-level navigation GET** ارسال نمی‌کند. یعنی POST/PATCH/PUT/DELETE برون‌سایتی **کوکی را نمی‌گیرند**.
2. **همهٔ endpointهای حالت‌تغییردهنده غیر GET هستند** — شمارش واقعی در `admin.controller.ts`: ۱۲ `@Post` + ۱۲ `@Patch/@Put/@Delete`. و **هر ۱۸ `@Get` فقط‌خواندنی‌اند** (یک‌به‌یک بررسی شد: `dashboard`, `customers`, `customerSearch`, `customer`, `orders`, `products`, `productById`, `getSettings`, `categories`, `otpAttempts`, `getAllTickets`, `getAllNotifications`, `listProfileChanges`, `banners`, `getSecurityStats`, `getErrorLogs`, `getActiveUsers`, `invoicePrint`). ⇒ هیچ حملهٔ CSRF از طریق GET ممکن نیست.
3. **همان-origin** — پنل و API یک origin هستند، پس هیچ جریان کوکی برون‌سایتی لازم نیست.
4. **`@Roles(UserRole.ADMIN)`** — حتی در صورت رسیدن درخواست، نقش بررسی می‌شود.

### نتیجه
**توکن CSRF اضافی لازم نبود.** دلیل: `SameSite=Lax` + نبودِ endpoint حالت‌تغییردهنده با GET + استقرار same-origin ⇒ سطح حملهٔ CSRF عملاً بسته است.

از افزودن یک فریم‌ورک بزرگ CSRF خودداری شد (طبق STEP 9: «یک مکانیزم بزرگ CSRF را بدون تحلیل معماری اضافه نکنید»).

### شرط باقی‌مانده (باید مستند بماند)
اگر در آینده **endpoint حالت‌تغییردهنده با GET** افزوده شود، یا پنل ادمین به **origin جدا** منتقل شود (که `SameSite=Lax` را بی‌اثر و نیازمند `SameSite=None; Secure` + توکن CSRF می‌کند)، این تحلیل **باید بازنگری شود**.

---

## 8. Logout

### قبل
```js
clearAuthToken()  →  localStorage.removeItem(...)   ← همزمان
                  →  fetch('/auth/logout', ...)      ← fire-and-forget، بدون await
location.reload()                                     ← بلافاصله
```
🔴 **باگ:** مرورگر درخواست در حال پرواز را هنگام پیمایش **abort** می‌کند ⇒ `Set-Cookie` پاک‌کننده هرگز نمی‌رسد ⇒ **کوکی زنده می‌ماند**. این باگ پیش‌تر پنهان بود چون `removeItem` همزمان بود و بعد از reload صفحهٔ ورود نشان داده می‌شد — ولی کوکی در سرور معتبر می‌ماند. پس از حذف localStorage، این باگ به **شکست کامل logout** تبدیل می‌شد: reload → کاوش نشست با کوکیِ زنده → کاربر دوباره لاگین!

### بعد
```js
clearAuthToken()  →  localStorage.removeItem(...)   ← پاک‌سازی میراثی
                  →  return fetch('/auth/logout', {credentials:'include'})
   ↓ await
location.reload()
```
ترتیب واقعیِ ثبت‌شده در تست: `["fetch:/auth/logout", "logout-response-received", "RELOAD"]` ✅

**در سمت سرور** (`auth.controller.ts:112-124`): `@UseGuards(JwtAuthGuard)` + `res.clearCookie('admin_token_v3', …)` با همان پرچم‌ها. چون استراتژی اکنون کوکی را می‌پذیرد، خودِ درخواست logout با کوکی احراز هویت می‌شود ⇒ پاک‌سازی موفق.

**محدودیت صادقانه:** JWT **بی‌حالت** است و سیستم revocation سمت سرور وجود ندارد. پس توکنی که پیش‌تر ربوده شده تا انقضا (حداکثر ۷ روز) معتبر می‌ماند. طبق STEP 12 **سیستم blacklist جدیدی اختراع نشد** — این محدودیت مستند می‌شود.

---

## 9. Security Tests

`src/auth/jwt-strategy-cookie.spec.ts` — از کلاس **واقعی** `JwtStrategy` و متد `authenticate` خودِ Passport با JWT امضاشدهٔ **واقعی** استفاده می‌کند (فقط `validate` stub شده چون به PostgreSQL نیاز دارد):

```
Admin login (توکن معتبر از Bearer)              : PASS
توکن بی‌اعتبار رد می‌شود                        : PASS
Admin authenticated request از کوکی             : PASS   ← مکانیزم جدید
کوکی میان چند کوکی دیگر                         : PASS
نام کوکی اشتباه نادیده گرفته می‌شود              : PASS
توکن منقضی از کوکی رد می‌شود (ignoreExpiration) : PASS
توکن بی‌اعتبار در کوکی                          : PASS
کوکی خالی / جعلی / نقص‌دار → fail-closed        : PASS ×۴
HttpOnly cookie issued (auth.controller.ts:57)  : PASS (بازبینی کد)
Bearer اولویت دارد ⇒ موبایل دست‌نخورده          : PASS
بدون اعتبارنامه → رد                            : PASS
بدون نیاز به cookie-parser                      : PASS
نام کوکی == auth.controller.ts                  : PASS
Authorization (نقش)                              : PASS — @Roles(ADMIN) + roles.guard.ts:21-23
JWT absent from localStorage                    : PASS (۱۳/۱۳ در jsdom)
Logout                                          : PASS (۶/۶)
Post-logout request rejected                    : PASS — کوکی پاک می‌شود ⇒ کاوش نشست 401
مجموع                                            : 17/17 + 13/13 + 6/6
```

**سناریوی حملهٔ بازسازی‌شده (رگرسیون XSS):** یک JWT زنده در `localStorage` کاشته شد، سپس `api()` و `secureBlob()` صدا زده شدند. نتیجه: هیچ هدر `Authorization` ساخته نشد، توکن در هیچ هدری ظاهر نشد، و `credentials:'include'` ارسال شد ⇒ **ربایش توکن ناموفق**.

---

## 10. Regression

| مورد | نتیجه | دلیل |
|---|---|---|
| **Repeat Order** | ✅ **PASS** | `POST /cart/reorder` (`cart.controller.ts:59-61` → `cart.service.ts:196`) دست‌نخورده؛ `reorderApi` و `cart.tsx` سالم؛ `checkout.tsx` بازسازی نشد؛ **۰ فایل موبایل تغییر کرد** |
| **B19** | ✅ **PASS** | `generateIdempotencyKey()` :80 · `idempotencyKeyRef` :105 · `if (placing) return` :148 · تولید فقط اگر null :151 · ارسال :159 · پاک‌سازی در موفقیت :162 · `disabled={placing}` :602 — همه سالم |
| **فاز ۱ XSS fixes** | ✅ **PASS** | `esc(e.userId \|\| 'مهمان')` سر جایش؛ ۳ `esc()` در شاخهٔ مشتری؛ تست XSS دوباره اجرا شد: **۲۱/۲۱ + ۹/۹ PASS** |
| **Mobile authentication** | ✅ **PASS** | Bearer در `jwt.strategy.ts` **حفظ شد** (اولویت اول در `fromExtractors`)؛ تست صریح «موبایل دست‌نخورده» PASS؛ `httpClient.ts:245,319` بدون تغییر؛ **۰ فایل موبایل تغییر کرد** |
| **Admin authorization** | ✅ **PASS** | `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)` دست‌نخورده |

---

## 11. Verification Commands

| دستور | نتیجه |
|---|---|
| `npm run build` | ✅ **PASS** — exit 0 |
| `npm test` | ✅ **PASS** — `Test Suites: 8 passed, 8 total` · `Tests: 74 passed, 74 total` (۵۷ قبلی + ۱۷ جدید) |
| `npx jest src/auth/jwt-strategy-cookie.spec.ts` | ✅ **PASS** — 17/17 |
| `npx prisma validate` | ✅ **PASS** — «The schema at prisma/schema.prisma is valid 🚀» |
| `node xss_regression_jwt.js` | ✅ **PASS** — 13/13 |
| `node logout_test.js` | ✅ **PASS** — 6/6 |
| `node xss_test_dom.js` (رگرسیون فاز ۱) | ✅ **PASS** — 21/21 + 9/9 |
| Lint | ⚪ **NOT RUN** — دستور lint مستقلی برای بک‌اند تعریف نشده بود |
| تست HTTP/E2E روی PostgreSQL واقعی | ⚪ **NOT RUN** — دیتابیس در دسترس نبود |
| Build موبایل | ⚪ **NOT RUN** — ۰ فایل موبایل تغییر کرد (اثبات md5) |

---

## 12. Remaining Risks

| # | ریسک | وضعیت |
|---|---|---|
| R1 | **`accessToken` هنوز در پاسخ `verify-otp` است.** موبایل قطعاً به آن نیاز دارد (`authApi.ts:35`، `AuthContext.tsx`)، پس طبق STEP 11 و 23 **حذف نشد**. در نتیجه در **لحظهٔ لاگین** توکن از حافظهٔ JS عبور می‌کند. SPA آن را نمی‌خواند و ذخیره نمی‌کند، ولی یک XSS که دقیقاً در همان لحظه فعال باشد می‌تواند پاسخ شبکه را ببیند. | **باقی‌ماندهٔ آگاهانه** — تصمیم برای ساخت endpoint ورود اختصاصی ادمین یک **تصمیم محصولی/معماری** است و اختراع نشد |
| R2 | **revocation سمت سرور وجود ندارد.** JWT بی‌حالت است؛ توکن ربوده‌شده تا انقضا (≤۷ روز) معتبر است. logout فقط کوکی را پاک می‌کند. | مستند شد؛ طبق STEP 12 سیستم blacklist اختراع نشد |
| R3 | تست‌ها در سطح unit/DOM بودند؛ **جریان کامل مرورگر روی HTTPS واقعی با nginx** آزموده نشد. | `UNVERIFIED — POST-DEPLOY` |
| R4 | `SameSite=Lax` به پیکربندی واقعی مرورگر/پروکسی در production بستگی دارد. | `UNVERIFIED — POST-DEPLOY` |
| R5 | **کاربران فعلی باید یک‌بار دوباره لاگین کنند** — رفتار پیش‌بینی‌شدهٔ مهاجرت، نه باگ. | مستند |
| R6 | `attempt({})` (درخواست کاملاً بدون `headers`) در passport-jwt خطا می‌دهد. **pre-existing** است — با پیکربندی قدیمیِ فقط-Bearer هم دقیقاً همین‌طور (`extract_jwt.js:58` بدون guard). در Express واقعی `req.headers` همیشه موجود است. | بدون تغییر — این فاز آن را معرفی نکرده |
| R7 | P1-1، P1-2، P1-3، B32، B15، B25 | عمداً دست‌نخورده (خارج از scope فاز ۲) |

---

## 13. Final Security Verdict

### پرسش: آیا یک payload XSS در حال اجرا در پنل ادمین می‌تواند **مستقیماً** JWT احراز هویت ادمین را بخواند؟

# ❌ خیر — نمی‌تواند

**مبنای شواهد:**

1. **`localStorage`** — جست‌وجوی مستقل: `setItem` = ۰، `getItem` = ۰. تنها `removeItem` باقی است. آزمون jsdom با توکن کاشته‌شده: `sessionStorage.length === 0` و هیچ متغیر سراسری شامل توکن نیست.
2. **`sessionStorage`** — ۰ ارجاع؛ جایگزین localStorage نشد.
3. **متغیر سراسری** — `state.token` حذف شد؛ `getAuthToken`/`setAuthToken`/`getCookie` حذف شدند؛ آزمون «هیچ متغیر سراسری شامل توکن نیست» PASS.
4. **هدرهای درخواست** — `api()` و `secureBlob()` دیگر `Authorization` نمی‌سازند. آزمون با توکن کاشته‌شده ثابت کرد توکن در **هیچ** هدری ظاهر نمی‌شود ⇒ ربایش از طریق شنود درخواست هم ناموفق است.
5. **کوکی** — `HttpOnly: true` (`auth.controller.ts:58`) ⇒ `document.cookie` آن را نمی‌بیند. `document.cookie` به‌کلی از پنل حذف شد.

**محدودیت صادقانه (R1):** در **لحظهٔ لاگین**، `accessToken` در بدنهٔ پاسخ `verify-otp` حضور دارد چون موبایل به آن نیاز دارد. این یک **عبور لحظه‌ای** است، نه یک اعتبارنامهٔ ماندگارِ قابل خواندن. توکنِ ماندگارِ نشست اکنون **فقط** در کوکی HttpOnly است.

> نتیجهٔ ترکیبی با فاز ۱: نه تنها XSS تأییدشده‌ای در پنل ادمین باقی نمانده (فاز ۱)، بلکه حتی در صورت وجود یک XSS ناشناخته، دیگر اعتبارنامهٔ ماندگاری برای ربودن در دسترس JS نیست (فاز ۲) — **دفاع لایه‌ای**.

---

*پایان گزارش فاز ۲.*
