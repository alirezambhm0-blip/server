# 14 — ERROR HANDLING

---

## 1. بک‌اند — لایه‌های مدیریت خطا

### ۱-۱. فیلتر سراسری: 🔴 غیرفعال
`CONFIRMED` از `main.ts:17-27`:
```ts
if (process.env.SENTRY_DSN) {
  Sentry.init({ ... });
  app.useGlobalFilters(new SentryFilter());   // ← فقط داخل این if
  logger.log('Sentry Crash Reporting initialized');
}
```

🔴 `CONFIRMED` **`SENTRY_DSN` در `.env` وجود ندارد** → کل این بلوک اجرا نمی‌شود.

> **پیامد:** نه `SentryFilter` فعال است، نه Sentry خطاها را می‌گیرد.
> مدیریت خطا کاملاً به **فیلتر پیش‌فرض NestJS** واگذار شده.

### ۱-۲. `SentryFilter` (اگر فعال شود)
`CONFIRMED` از `common/sentry.filter.ts` (47 خط):
```ts
@Catch()
export class SentryFilter implements ExceptionFilter {
  catch(exception, host) {
    const requestId = request.headers['x-request-id'] || Math.random().toString(36).substring(7);
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = 'خطای سرور. لطفاً با پشتیبانی تماس بگیرید.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (status < 500) {
        response.status(status).json(res);   // ← خطاهای 4xx عیناً عبور می‌کنند
        return;
      }
    }

    Sentry.captureException(exception, { tags:{requestId}, extra:{url, method, body} });
    console.error(`[RequestId: ${requestId}]`, exception);

    // Never leak stack traces to client!
    response.status(status).json({ statusCode: status, message, requestId });
  }
}
```

✅ طراحی درست: 4xx عیناً عبور می‌کند، 5xx با پیام عمومی فارسی + `requestId`.

⚠️ `CONFIRMED` **`request.body` به Sentry فرستاده می‌شود.** اگر روزی این endpoint
روی `request-otp` یا فرم KYC خطا بدهد، **کد OTP و اطلاعات مدارک به Sentry می‌روند.**

⚠️ `CONFIRMED` `SentryFilter` یک `ExceptionFilter` است، نه `BaseExceptionFilter` —
پس `HttpException`های 5xx را هم می‌گیرد و پیامشان را با پیام عمومی جایگزین می‌کند.

---

## 2. ✅ رفتار واقعی NestJS (آزمایش‌شده)

`CONFIRMED` **با اجرای یک اپ NestJS حداقلی با همان `@nestjs/common@11` نصب‌شده در پروژه:**

```
throw new Error('EXPIRED')           → 500 {"statusCode":500,"message":"Internal server error"}
throw new BadRequestException('bad') → 400 {"message":"bad","error":"Bad Request","statusCode":400}
```

### دو نتیجهٔ مهم

**۱. ✅ stack trace به کلاینت نشت نمی‌کند.**
فیلتر پیش‌فرض NestJS پیام عمومی `"Internal server error"` می‌دهد. stack فقط در
لاگ سمت سرور می‌آید.

**۲. 🔴 ولی پیام‌های فارسیِ معنادار کد هم هرگز به کاربر نمی‌رسند.**

---

## 3. 🔴 `throw new Error(...)` در کد محصول — ۹ مورد

`CONFIRMED` از `grep -rn "throw new Error(" src` (مورد دهم در فایل تست است):

| فایل:خط | پیام | HTTP واقعی | HTTP درست |
|---|---|---|---|
| `auth/auth.service.ts:224` | `'EXPIRED'` | **500** | 400 |
| `auth/auth.service.ts:229` | `'ALREADY_USED'` | **500** | 400 |
| `auth/auth.service.ts:246` | `` `WRONG_CODE:${remaining}` `` | **500** | 400 |
| `admin/admin.service.ts:205` | «این شماره همراه قبلاً … ثبت شده است.» | **500** | 409 |
| `admin/admin.service.ts:352` | «هیچ مشتری تایید شده ای … یافت نشد.» | **500** | 404 |
| `categories/categories.service.ts:93` | «این دسته‌بندی دارای محصول است …» | **500** | 409 |
| `profile/profile.service.ts:147` | «تغییر فیلدهای … نیاز به تایید ادمین دارد.» | **500** | 403 |
| `tickets/tickets.controller.ts:31` | «فقط مشتریان می‌توانند تیکت ثبت کنند» | **500** | 403 |
| `tickets/tickets.controller.ts:37` | «فقط مشتریان می‌توانند پاسخ دهند» | **500** | 403 |

> **پیامد کاربری:** در همهٔ این موارد کاربر «خطای سرور» می‌بیند،
> نه دلیل واقعی. متن‌های فارسیِ دقیق که توسعه‌دهنده نوشته **هرگز نمایش داده نمی‌شوند.**

---

## 4. 🔴 بحرانی‌ترین مورد: OTP

### ۴-۱. `verifyOtp` هیچ `try/catch` ندارد
`CONFIRMED` از `auth.service.ts:197-260`:
```ts
async verifyOtp(dto: VerifyOtpDto, meta?) {
  const phone = this.normalizePhone(dto.phone);
  const code = dto.code.trim();
  const now = new Date();

  await this.prisma.$transaction(async (tx) => {     // ← ⚠️ بدون catch
    ...
    if (record.expiresAt < now)  throw new Error('EXPIRED');
    if (record.usedAt)           throw new Error('ALREADY_USED');
    if (record.code !== code) {
      await tx.otp.update({ data: { attempts: newAttempts, lastAttemptAt: now } });
      ...
      throw new Error(`WRONG_CODE:${remaining}`);
    }
    ...
  });
  // ← هیچ catch نیست
```
`CONFIRMED` تنها `catch` در این فایل در `requestOtp` (خط ۱۸۰) است، نه `verifyOtp`.

### ۴-۲. 🔴 پیامد دوم: rollback شمارندهٔ تلاش
`CONFIRMED` در Prisma، **interactive transaction** (`$transaction(async tx => ...)`)
اگر callback خطا بدهد، **rollback می‌شود**.

پس در مسیر کد اشتباه:
```
tx.otp.update({ data: { attempts: newAttempts } })   ← ثبت می‌شود
throw new Error(`WRONG_CODE:${remaining}`)           ← باعث rollback
→ attempts دوباره به مقدار قبلی برمی‌گردد
```

🔴 **نتیجه: شمارندهٔ تلاش هیچ‌وقت زیاد نمی‌شود → قفل ۱۵ دقیقه‌ای هرگز فعال نمی‌شود.**

```ts
// auth.service.ts:210-219 — این شرط هیچ‌وقت true نمی‌شود
if (record.attempts >= OTP_CONFIG.MAX_VERIFY_ATTEMPTS && ...) {
  throw new TooManyRequestsException('حساب شما ... قفل شده است');
}
```

`UNVERIFIED` — رفتار rollback بر اساس مستندات Prisma است؛ نتوانستم روی DB واقعی اجرا کنم.

### ۴-۳. ترکیب با نبود rate limit
`CONFIRMED` `ThrottlerGuard` اعمال نشده → `15-SECURITY.md` §S1.

> 🔴 **نتیجهٔ ترکیبی:** یک کد ۶ رقمی، بدون قفل، بدون rate limit.
> فضای جستجو ۸۹۹٬۹۹۹ کد است (به‌خاطر باگ `randomInt`).
> این **جدی‌ترین یافتهٔ امنیتی پروژه** است.

---

## 5. استثناهای سفارشی

### ۵-۱. `TooManyRequestsException` (429)
`CONFIRMED` از `common/too-many-requests.exception.ts`:
```ts
/**
 * TooManyRequestsException (HTTP 429) — برای اعلام cooldown/rate-limit
 * (NestJS به‌صورت پیش‌فرض این استثنا را خارج از بسته‌ی @nestjs/throttler
 * ندارد، بنابراین خودمان پیاده‌سازی می‌کنیم.)
 */
export class TooManyRequestsException extends HttpException {
  constructor(message: string | object = 'Too many requests') {
    super(typeof message === 'string'
            ? { message, statusCode: HttpStatus.TOO_MANY_REQUESTS }
            : message,
          HttpStatus.TOO_MANY_REQUESTS);
  }
}
```
✅ 4xx است → هم توسط فیلتر پیش‌فرض و هم `SentryFilter` **عیناً عبور می‌کند**.

استفاده‌شده در:
- `auth.service.ts:116` — قفل ۱۵ دقیقه‌ای
- `auth.service.ts:125` — cooldown ۶۰ ثانیه
- `auth.service.ts:242` — «تعداد تلاش‌های ناموفق بیش از حد مجاز بود»

### ۵-۲. `UnprocessableEntityException` ساختاریافته (422)
`CONFIRMED` از `orders.service.ts`:
```json
{
  "statusCode": 422,
  "message": {
    "error": "STOCK_UNAVAILABLE",
    "warnings": [
      { "type": "stock_unavailable", "product_id": "...",
        "product_name": "...", "available_stock": 3 }
    ]
  }
}
```
⚠️ `message` اینجا **آبجکت** است نه رشته. اگر UI آن را `String()` کند `[object Object]` می‌شود.

`CONFIRMED` انواع `warning.type`:
- `product_inactive` — محصول غیرفعال/حذف‌شده
- `stock_unavailable` — موجودی ناکافی (+ `available_stock`)

### ۵-۳. کدهای خطای رشته‌ای
`CONFIRMED` در `orders.service.ts` و `cart.service.ts`:
- `'CART_EMPTY'` (در `BadRequestException`)
- `'STOCK_UNAVAILABLE'` (در `UnprocessableEntityException`)

⚠️ این‌ها **رشتهٔ خام** هستند، نه enum. کلاینت باید string match کند.

---

## 6. مدیریت خطای Prisma

`CONFIRMED` تنها جایی که کد خطای Prisma صریحاً هندل می‌شود:
```ts
// orders.service.ts:361-369
catch (e) {
  // مسابقه خرید همزمان: اگر بین خواندن کالا و کسر، موجودی عوض شده باشد،
  // آپدیت شرطی ۰ رکورد می‌زند (P2025)
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    throw new UnprocessableEntityException({
      error: 'STOCK_UNAVAILABLE',
      warnings: [{ type: 'stock_unavailable', product_id: p.id, product_name: p.name }],
    });
  }
  throw e;
}
```

### ۶-۱. 🔴 کدهای Prisma که هندل **نمی‌شوند**
| کد | معنی | کجا رخ می‌دهد | HTTP فعلی |
|---|---|---|---|
| `P2002` | نقض unique constraint | `phone`، `slug`، `customerId_productId` | **500** |
| `P2003` | نقض FK | حذف `Category` با محصول | **500** |
| `P2025` | رکورد یافت نشد | همه‌جا به‌جز `orders.service` | **500** |

> ⚠️ `INFERRED` — این‌ها بر اساس الگوی کد استنباط شده‌اند، نه خطای مشاهده‌شده.
> **هیچ `ExceptionFilter` سراسری برای Prisma وجود ندارد.**

---

## 7. مدیریت خطا سمت موبایل

### ۷-۱. لایهٔ `httpClient.ts`
`CONFIRMED` از `src/api/httpClient.ts` (352 خط):
- **request interceptor:** افزودن `Authorization: Bearer`
- **response interceptor:** روی `401` → پاک‌کردن session
- **timeout** تنظیم شده

⚠️ `UNVERIFIED` — مکانیزم retry دقیق را در همان فایل ببینید.

### ۷-۲. الگوی رایج در Contextها
```ts
try {
  await api.xxx();
} catch (err: any) {
  const msg = err?.data?.message || err?.message || 'خطا در به‌روزرسانی سبد';
  setSyncError(typeof msg === 'string' ? msg : 'خطا در به‌روزرسانی سبد');
}
```
`CONFIRMED` از `CartContext.tsx:93-99`.

✅ `typeof msg === 'string'` چک می‌شود — پس حالت `message` آبجکتی (۴۲۲) هندل شده.

### ۷-۳. الگوی رایج در routeها
```ts
catch (err: any) {
  const msg = Array.isArray(err?.data?.message)
    ? err.data.message.join('، ')      // ← ValidationPipe آرایه می‌دهد
    : err?.data?.message || err?.message || 'خطا';
}
```
`CONFIRMED` از `CartContext.tsx:190, 246`.

✅ **آرایهٔ `ValidationPipe` درست هندل می‌شود** (با «، » فارسی join می‌شود).

### ۷-۴. 🔴 `ErrorBoundary.tsx`
`CONFIRMED` دو مشکل:
```ts
// ۱. IP hardcode
const API = 'http://10.75.109.83:3000';

// ۲. catch خالی
catch {}
```
> **پیامد:** اگر گزارش خطا به آن IP شکست بخورد، **بی‌صدا نادیده گرفته می‌شود** —
> و آن IP هم با `.env` (`10.73.183.83`) نمی‌خواند.

### ۷-۵. ⚠️ خطاهای خاموش
`CONFIRMED` الگوی `.catch(() => {})` در همه‌جا رایج است:
- `AuthContext.tsx:100` — `authStorage.saveTokensAndCustomer(...).catch(() => {})`
- `AuthContext.tsx:185` — `notificationsApi.removePushToken().catch(() => {})`
- `CartContext.tsx:78` — `cartStorage.saveCart(list).catch(() => {})`
- `FavoritesContext.tsx:49-56` — rollback بدون اطلاع کاربر

`INFERRED` عمدی است (best-effort operations) ولی **دیباگ را سخت می‌کند.**

---

## 8. لاگ‌گیری

### ۸-۱. بک‌اند
| ابزار | کجا |
|---|---|
| `Logger` از `@nestjs/common` | `main.ts` (Bootstrap)، `notification-events.listener.ts`، `auth.service.ts` |
| `console.error` | `SentryFilter` (غیرفعال) |
| Sentry | 🔴 غیرفعال |
| جدول `ErrorLog` | از `POST /app/log-error` (عمومی!) |

`CONFIRMED` `auth.service.ts:185`:
```ts
this.logger.error(`OTP Process Error: ${msg}`);
```

⚠️ `CONFIRMED` **هیچ request logger / interceptor لاگ وجود ندارد.**

### ۸-۲. موبایل
`CONFIRMED` فقط `console.warn` / `console.error`:
```ts
console.warn('[Auth] getMe refresh failed:', e?.message || e);
console.warn('[Cart] operation failed', err);
console.warn('[Favorites] Failed to refresh', e);
```

✅ **پیشوند `[Auth]` / `[Cart]` / `[Favorites]`** — الگوی خوب، حفظش کنید.

`CONFIRMED` Sentry موبایل (`@sentry/react-native`) در `_layout.tsx` init می‌شود
با `enabled: !__DEV__` — یعنی **فقط در build پروداکشن فعال است**.

---

## 9. جریان کامل خطا (نمودار)

```
خطا در Service
   │
   ├─ HttpException (4xx/5xx)
   │     │
   │     ├─ SentryFilter فعال؟ ──بله──► 4xx: عیناً عبور
   │     │                        5xx: پیام عمومی فارسی + requestId + Sentry
   │     │
   │     └─ نه (وضعیت فعلی) ──► فیلتر پیش‌فرض NestJS
   │                              4xx: عیناً عبور ✅
   │                              5xx: "Internal server error" ✅ (بدون نشتی)
   │
   └─ Error خام (۹ مورد)
         │
         └─ 500 "Internal server error"  🔴 پیام فارسی گم می‌شود
               + در Prisma interactive transaction → ROLLBACK
```

---

## 10. قواعد مدیریت خطا

### ۱۰-۱. برای کد جدید
```
☐ هرگز throw new Error(...) — از HttpException استفاده کنید
☐ برای «یافت نشد»       → NotFoundException
☐ برای «دادهٔ نامعتبر»  → BadRequestException
☐ برای «تعارض»          → ConflictException
☐ برای «دسترسی»         → ForbiddenException
☐ برای «شرط کسب‌وکاری»  → UnprocessableEntityException
☐ برای «rate limit»     → TooManyRequestsException (سفارشی)
☐ کدهای Prisma را هندل کنید (P2002، P2003، P2025)
☐ پیام فارسی و کاربرپسند بنویسید
☐ اگر داخل $transaction هستید، catch را بیرون از transaction بگذارید
```

### ۱۰-۲. ⚠️ تلهٔ `$transaction`
```ts
// ❌ غلط — rollback باعث از دست رفتن attempts می‌شود
await this.prisma.$transaction(async (tx) => {
  await tx.otp.update({ data: { attempts: n + 1 } });
  throw new Error('WRONG_CODE');
});

// ✅ درست — شمارنده را بیرون از transaction ثبت کنید
await this.prisma.$transaction(...).catch(async (e) => {
  if (e instanceof WrongCodeError) {
    await this.prisma.otp.update({ data: { attempts: n + 1 } });
    throw new BadRequestException(`کد اشتباه است. ${remaining} تلاش باقی‌مانده`);
  }
  throw e;
});
```

### ۱۰-۳. ⚠️ قبل از فعال‌کردن `SENTRY_DSN`
`SentryFilter` مقدار `request.body` را به Sentry می‌فرستد.
**اول یک redaction برای `code`، `nationalCode` و فیلدهای KYC اضافه کنید.**
