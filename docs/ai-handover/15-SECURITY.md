# 15 — SECURITY

> ⚠️ **این فایل مهم‌ترین سند پروژه است.** ۵ یافتهٔ بحرانی باز وجود دارد.
> هیچ‌کدام از این‌ها در مستندات قبلی پروژه ثبت نشده بود.
>
> **هیچ secret، رمز، توکن یا مقدار حساسی در این فایل نوشته نشده — فقط نام کلیدها.**

---

## 0. خلاصهٔseverity

| # | یافته | شدت | وضعیت |
|---|---|---|---|
| S1 | Rate limiting کاملاً بی‌اثر | 🔴 بحرانی | ✅ **رفع شد** |
| S2 | قفل OTP به‌خاطر rollback هرگز فعال نمی‌شود | 🔴 بحرانی | ✅ **رفع شد** |
| S3 | `visitor-sales` بدون `RolesGuard` → سفارش جعلی | 🔴 بحرانی | ✅ **رفع شد** |
| S4 | `JWT_SECRET` زنده — ⚠️ از **زیپ** لو رفته نه git داخلی | 🔴 بحرانی | 🟡 نیازمند اقدام کاربر |
| S5-A | منطق OTP و حذف خودکار `testCode` در production | 🔴 بحرانی | ✅ **کد آماده** — هیچ تغییری لازم نیست |
| S5-B | اتصال واقعی ملی‌پیامک | 🔴 بحرانی | 🔵 **نیازمند Deploy** — کد نوشته شده، هرگز با اکانت واقعی تست نشده |
| S6 | `GET /products/favorites` نشت `costPrice` | 🟠 زیاد | ✅ **رفع شد** (P1) |
| S7 | قیمت عمده بدون احراز هویت در API | 🟠 زیاد | ✅ **رفع شد** (P1) |
| S8 | `JwtStrategy` وضعیت `Customer.status` را چک نمی‌کند | 🟠 زیاد | ✅ **رفع شد** (P1) |
| S9 | کنترلر ادمین بدون `@Roles` (رفتار `RolesGuard` استاندارد NestJS است) | 🟠 زیاد | ✅ **تست سیستماتیک** (P1) |
| S10 | کد OTP به‌صورت plaintext در DB | 🟠 زیاد | باز |
| S11 | `POST /app/log-error` عمومی و بدون محدودیت | 🟡 متوسط | باز |
| S12 | `SentryFilter` مقدار `request.body` را به Sentry می‌فرستد | 🟡 متوسط | بالقوه |
| S13 | `.env` با مقادیر زنده داخل زیپ push‌شده | 🔴 بحرانی | باز |
| S14 | `/docs` پشت reverse proxy باز می‌شود | 🟡 متوسط | بالقوه |
| S15 | `POST /files/kyc` بدون `RolesGuard` | 🟢 کم | عمدی |

---

## S1 — ✅ Rate limiting کاملاً بی‌اثر — **رفع شد**

### شواهد
`CONFIRMED` `app.module.ts:26-31`:
```ts
ThrottlerModule.forRoot([
  { ttl: 60000, limit: 60 },
]),
```
✅ ماژول **ثبت شده** است.

`CONFIRMED` `main.ts` را کامل خواندم — **هیچ `app.useGlobalGuards(new ThrottlerGuard())` نیست.**

`CONFIRMED` `grep -rn "ThrottlerGuard\|@Throttle" src` → **صفر نتیجه.**

### نتیجه
> تنظیمات `ttl: 60000, limit: 60` **هیچ اثری ندارند.**
> هر endpoint را می‌توان بدون محدودیت صدا زد.

### حملهٔ ممکن
```
POST /auth/request-otp  × بی‌نهایت  → پیامک انبوه + هزینهٔ مالی
POST /auth/verify-otp   × بی‌نهایت  → brute force (به S2 نگاه کنید)
POST /app/log-error     × بی‌نهایت  → پرکردن جدول ErrorLog
```

### اصلاح پیشنهادی (اجرا نکنید بدون تأیید)
```ts
// main.ts
import { ThrottlerGuard } from '@nestjs/throttler';
app.useGlobalGuards(new ThrottlerGuard());
```
⚠️ **هشدار:** این کار ممکن است اپ موبایل را بشکند اگر جایی بیش از ۶۰ درخواست
در دقیقه می‌فرستد. **اول روی یک نمونهٔ واقعی تست کنید.**

---

## S2 — 🔴 قفل OTP هرگز فعال نمی‌شود

### شواهد
`CONFIRMED` `auth.service.ts:233-247` — داخل `$transaction`:
```ts
if (record.code !== code) {
  const newAttempts = record.attempts + 1;
  await tx.otp.update({
    where: { phone },
    data: { attempts: newAttempts, lastAttemptAt: now },   // ← ۱. ثبت
  });
  const remaining = OTP_CONFIG.MAX_VERIFY_ATTEMPTS - newAttempts;
  if (remaining <= 0) throw new TooManyRequestsException(...);
  throw new Error(`WRONG_CODE:${remaining}`);              // ← ۲. throw → ROLLBACK
}
```

`CONFIRMED` در Prisma، interactive transaction روی throw **rollback می‌شود**.
پس `attempts` هرگز زیاد نمی‌شود.

`CONFIRMED` شرط قفل (`auth.service.ts:210-219`):
```ts
if (record.attempts >= OTP_CONFIG.MAX_VERIFY_ATTEMPTS && ...) {
  throw new TooManyRequestsException('حساب شما ... قفل شده است');
}
```
→ `record.attempts` همیشه ۰ می‌ماند → **این شرط هیچ‌وقت true نمی‌شود.**

`UNVERIFIED` — رفتار rollback بر اساس مستندات Prisma است؛ DB واقعی در دسترس نبود.

### ترکیب با S1
```
کد ۶ رقمی  →  ۸۹۹,۹۹۹ حالت (randomInt هیچ‌وقت 999999 نمی‌دهد)
بدون rate limit (S1)
بدون قفل (S2)
بدون cooldown مؤثر (cooldown فقط روی request-otp است، نه verify-otp)
```

🔴 **این جدی‌ترین یافتهٔ امنیتی پروژه است.**
یک مهاجم می‌تواند با چند صد هزار درخواست، وارد **هر حسابی** شود —
شامل حساب ادمین.

---

## S3 — ✅ `visitor-sales` بدون `RolesGuard` — **رفع شد**

### شواهد
`CONFIRMED` `visitor-sales.controller.ts` (۵۲ خط، کامل خوانده شد):

```ts
@Controller('admin/visitor-sales')
@UseGuards(JwtAuthGuard)          // ← 🔴 فقط JWT، بدون RolesGuard
export class VisitorSalesController { ... }

@Controller('admin/customers')
@UseGuards(JwtAuthGuard)          // ← 🔴 فقط JWT
export class CustomerSearchController {
  @Get('search')
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.svc.searchCustomers(q, Number(limit) || 10);
  }
}

@Controller('visitor/orders')
@UseGuards(JwtAuthGuard)          // ← 🔴 فقط JWT
export class VisitorOrderController { ... }
```

`CONFIRMED` **`RolesGuard` هیچ‌جا در این فایل import هم نشده.**

### ۳-۱. نشت PII — `GET /admin/customers/search?q=...`
`CONFIRMED` `visitor-sales.service.ts:81-112` این فیلدها را برمی‌گرداند:
```
id · storeName · ownerName (نام و نام خانوادگی) · phone · address
businessType · lastOrderDate
```
🔴 **هر کاربر لاگین‌شده** (حتی `PENDING` که هنوز تایید نشده) می‌تواند
**نام، شماره تلفن و آدرس همهٔ مشتریان تاییدشده** را بگیرد.

> ⚠️ در عمل این endpoint به‌خاطر تعارض با `AdminController` (که `ADMIN` می‌خواهد)
> **۴۰۳ می‌دهد** — چون `AdminModule` زودتر در `app.module.ts` آمده.
> `CONFIRMED` این با probe واقعی تأیید شد.
>
> 🔴 **ولی این یک تصادف است، نه یک کنترل امنیتی.** اگر ترتیب ماژول‌ها عوض شود،
> نشتی فعال می‌شود. **به این تصادف تکیه نکنید.**

### ۳-۲. سفارش جعلی — `POST /visitor/orders`
`CONFIRMED` `visitor-sales.controller.ts:46-51`:
```ts
@Post()
async create(@Req() req: RequestWithUser, @Body() body: ...) {
  const userName = [req.user.customer?.firstName, req.user.customer?.lastName]
                     .filter(Boolean).join(' ') || req.user.phone;
  return this.svc.createVisitorOrder(req.user.userId, userName, body);
}
```

`CONFIRMED` `visitor-sales.service.ts:115-133` فقط **مشتری هدف** را چک می‌کند:
```ts
if (!customer || customer.status !== 'APPROVED') {
  throw new ForbiddenException('مشتری تایید نشده');
}
```
🔴 **هیچ‌جا چک نمی‌شود که `req.user` خودش ادمین یا ویزیتور باشد.**

> **حمله:** یک مشتری تاییدشده می‌تواند:
> ```
> POST /visitor/orders
> { "customerId": "<id مشتری دیگر>", "items": [...] }
> ```
> و برای **هر مشتری دیگری** سفارش ثبت کند — با `orderSource: VISITOR_IN_PERSON`
> و `placedByName` = نام خودش.

### ۳-۳. `dashboard` و `orders` — محافظت نرم
`CONFIRMED` این دو یک چک نرم دارند:
```ts
const isAdmin = req.user.role === 'ADMIN';
return this.svc.getDashboard(req.user.userId, isAdmin, ...);
```
✅ سرویس بر اساس `isAdmin` داده را محدود می‌کند. این بهتر از هیچی است.

---

## S4 — 🔴 `JWT_SECRET` زنده در ریپازیتوری عمومی

### شواهد
`CONFIRMED`
- `wholesale-api/.env` شامل `JWT_SECRET` با **طول ۲۳** و **غیر-placeholder** است
- `wholesale-api/.gitignore` آن را exclude می‌کند (پس در inner git نیست)
- **ولی** کل workspace داخل `workspace-01a078c1-...zip` قرار دارد
- و آن زیپ **به گیت‌هاب push شده** (`cuntinue_whosale01.git`)

### نتیجه
> هر کسی که به آن ریپازیتوری دسترسی دارد، می‌تواند **JWT دلخواه بسازد**:
> ```js
> jwt.sign({ sub: '<userId>', phone: '...', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '7d' })
> ```
> و **دسترسی کامل ادمین** بگیرد.

`CONFIRMED` `auth.module.ts` از `config.getOrThrow<string>('JWT_SECRET')` استفاده می‌کند
و `jwt.strategy.ts` از `configService.getOrThrow<string>('JWT_SECRET')` —
پس همان secret برای امضا و verify استفاده می‌شود.

### اقدام فوری
```
۱. JWT_SECRET جدید تولید کنید (حداقل ۳۲ کاراکتر تصادفی)
۲. .env را به‌روز کنید
۳. سرویس را restart کنید → همهٔ توکن‌های فعلی باطل می‌شوند
۴. زیپ را از تاریخچهٔ گیت پاک کنید (git filter-repo) یا ریپازیتوری را خصوصی کنید
```

---

## S5 — 🔴 `testCode` در پاسخ OTP — 🔵 **به دو قسمت تقسیم شد**

### شواهد
`CONFIRMED` `auth.service.ts:164-179` — **تنها** مسیر ارسال OTP:
```ts
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  await this.smsService.sendOtp(phone, code);
  return { message: 'کد تایید ارسال شد', cooldown: ... };   // ← بدون testCode
}
this.logger.debug(`[DEV] OTP for ${phone} => ${code}`);
return { message: '...(Development Mode)', testCode: code, cooldown: ... };
```
`CONFIRMED` `.env` خط ۱۰: `NODE_ENV=development`.
`CONFIRMED` `verifyOtp` (`:197`) هیچ کدی برنمی‌گرداند.
`CONFIRMED` `RELEASE-CHECKLIST.md:65` مستند کرده: «`NODE_ENV=production`
(خروجی testCode در OTP خاموش می‌شود)» و در واحد systemd (`:92`) هم
`Environment=NODE_ENV=production` آمده است.

### نتیجهٔ فعلی (چون `NODE_ENV=development` است)
```
POST /auth/request-otp { "phone": "0912..." }
→ { "message": "...", "testCode": "123456" }     ← 🔴 کد واقعی
```

> اگر همین `.env` بدون تغییر `NODE_ENV` به production برود،
> **هر کسی می‌تواند وارد هر حسابی شود.**

---

### S5-A — ✅ منطق OTP و حذف خودکار `testCode` — **کد آماده است**

`CONFIRMED` **هیچ تغییر کدی لازم نیست.** gate از قبل وجود دارد و درست کار
می‌کند: به محض `NODE_ENV=production`، هم پیامک واقعی ارسال می‌شود و هم
`testCode` از پاسخ حذف می‌گردد.

موارد مرتبط که قبلاً رفع شده‌اند:
- `S2` — قفل brute-force (ثبت attempt بیرون از transaction) ✅ P0
- `S1` — rate limiting روی هر دو endpoint OTP ✅ P0

**تنها اقدام باقی‌مانده:** در `.env` سرور مقدار `NODE_ENV=production` باشد.

> ℹ️ پیشنهاد قبلی این سند («منطق را پشت feature flag صریح ببرید نه `NODE_ENV`»)
> یک **بهبود اختیاری** است، نه لازمهٔ رفع. `RELEASE-CHECKLIST` هم `NODE_ENV`
> را به‌عنوان مکانیزم مستند کرده، پس تغییرش نیازمند هماهنگی با آن سند است.
> تا وقتی مالک پروژه درخواست نکند، تغییر نمی‌دهیم.

---

### S5-B — 🔵 اتصال واقعی ملی‌پیامک — **نیازمند Deploy**

`CONFIRMED` اتصال SOAP **کاملاً پیاده‌سازی شده** (`sms/sms.service.ts`) — stub نیست:
```
:29   wsdlUrl = 'http://api.payamak-panel.com/post/send.asmx?wsdl'
:31   soap.createClientAsync(wsdlUrl)
:61   client.SendByBaseNumberAsync({ username, password, text:[code], to, bodyId })
:99   parseResponseCode()   ← کد پاسخ > 100 یعنی موفقیت
:111  maskPhoneNumber()     ← شماره در لاگ ماسک می‌شود
```
`CONFIRMED` اعتبارنامه در `.env` **پر شده** (`MELIPAYAMAK_USERNAME`،
`MELIPAYAMAK_PASSWORD`، `MELIPAYAMAK_BODY_ID`).

**چرا هنوز «باز» است:** این کد **هرگز در برابر اکانت واقعی ملی‌پیامک اجرا نشده.**

| مورد | وضعیت |
|---|---|
| معتبر بودن `MELIPAYAMAK_BODY_ID` (پترن تاییدشده) | `UNVERIFIED` |
| درست بودن قاعدهٔ `responseCode > 100` در عمل | `UNVERIFIED` |
| دسترسی خروجی سرور به `api.payamak-panel.com` | `UNVERIFIED` |
| رسیدن واقعی پیامک به شمارهٔ کاربر | `UNVERIFIED` |

### اقدام لازم بعد از Deploy (چک‌لیست S5-B)
1. `NODE_ENV=production` در `.env` سرور
2. ارسال یک کد به یک شمارهٔ واقعی و دریافت آن
3. بررسی لاگ: `SMS OTP sent successfully ... ResponseCode: <n>`
4. بررسی اینکه پاسخ API دیگر `testCode` **ندارد**
5. تست مسیر خطا: `MELIPAYAMAK_BODY_ID` غلط ⇒ باید `500` با پیام فارسی بدهد، نه crash

### ⚠️ یافتهٔ امنیتی حین بررسی (گزارش، بدون تغییر)
`CONFIRMED` آدرس WSDL در `sms.service.ts:29` با **`http://`** است نه `https://`.
یعنی `username` و `password` ملی‌پیامک روی کانال رمزنگاری‌نشده ارسال می‌شوند.
این **آدرس رسمی خود اپراتور** است و تغییرش بدون اطلاع از پشتیبانی HTTPS سمت
ملی‌پیامک = حدس زدن. پس تغییر داده نشد؛ تصمیم با مالک پروژه است.

`CONFIRMED` دو کلید مرده در `.env` که کد هرگز نمی‌خواند:
`MELIPAYAMAK_FROM` و `MELIPAYAMAK_OTP_TOKEN`.

---

## S6 — ✅ `GET /products/favorites` نشت `costPrice` — **رفع شد (P1)**

> **رفع:** `getMyFavorites` حالا `{ costPrice, nameNormalized, ...safe }` را
> destruct می‌کند و فقط `safe` را برمی‌گرداند. قالب پاسخ عمداً **camelCase**
> نگه داشته شد چون `toLocalProduct` در موبایل به آن وابسته است.

### شواهد
`CONFIRMED` `products/favorites.controller.ts` + `products.service.ts:446`
(`getMyFavorites`) — ردیف **خام Prisma** را برمی‌گرداند، بدون عبور از
`mapOrderToResponse`-گونه mapper.

`CONFIRMED` مدل `Product` فیلد `costPrice Int?` دارد
(`schema.prisma:97`، اضافه‌شده در migration `20260725190136_add_cost_price`).

### نتیجه
🔴 **قیمت خرید بنکو** (حاشیهٔ سود) به مشتری نشان داده می‌شود.

⚠️ `CONFIRMED` این همچنین `toLocalProduct` در موبایل را می‌شکند،
چون شکل پاسخ با `Product` معمولی فرق دارد.

### مقایسه با بقیه
`CONFIRMED` همهٔ endpointهای دیگر محصولات از mapper عبور می‌کنند.
**این تنها استثناست.**

---

## S7 — ✅ قیمت عمده بدون احراز هویت در API — **رفع شد (P1)**

> **رفع:** هلپر خصوصی `priceFields(p, canSeePrices)` در `products.service.ts`
> جایگزین **سه بلوک بایت‌یکسان** قیمت شد. قاعده دقیقاً همان قاعدهٔ UI است:
> `user?.role === 'ADMIN' || user?.customer?.status === 'APPROVED'`.
> وقتی `canSeePrices` نادرست باشد، پاسخ می‌گیرد
> `price/discounted_price/original_price/discount_percentage = null` به‌همراه
> `price_visible: false`. پیش‌فرض پارامتر `false` است (**fail-closed**).
>
> **پوشش:** `GET /products` · `GET /products/:idOrSlug` ·
> `GET /products/:id/similar` · `GET /search` · `GET /search/suggestions`.
>
> ⚠️ **یافتهٔ جانبی:** `GET /products/:id/similar` **هیچ گاردی نداشت** —
> `@GetUser() user` اعلام شده بود ولی `@UseGuards` نبود، پس `user` همیشه
> `undefined` بود و حتی مشتری تاییدشده هم قیمت نمی‌دید. `OptionalJwtAuthGuard`
> اضافه شد.

### شواهد
`CONFIRMED` `products.controller.ts`:
```ts
@UseGuards(OptionalJwtAuthGuard)      // ← توکن اختیاری
@Get()
findAll(...)
```
`CONFIRMED` `optional-jwt-auth.guard.ts`:
```ts
handleRequest<TUser>(err, user): TUser {
  return (user || null) as unknown as TUser;   // هرگز throw نمی‌کند
}
```

`CONFIRMED` پاسخ شامل فیلد `price` است، **فارغ از وضعیت کاربر**.

`CONFIRMED` پنهان‌سازی فقط در `wholesale-mobile/src/components/product/PriceBox.tsx` انجام می‌شود.

### نتیجه
```bash
curl http://host/products        # بدون هیچ توکنی
→ [{ "id": "...", "name": "...", "price": 125000, ... }]
```

🔴 **قانون مرکزی کسب‌وکار («قیمت فقط برای تاییدشده‌ها») در API اجرا نمی‌شود.**

### نکتهٔ طراحی
`CONFIRMED` `OptionalJwtAuthGuard` **عمدی** است — مهمان باید بتواند محصولات را ببیند.
مشکل از guard نیست، از این است که **فیلد `price` شرطی حذف نمی‌شود.**

### الگوی درست
```ts
const canSeePrice = user?.customer?.status === 'APPROVED';
return products.map(p => canSeePrice ? p : { ...p, price: null, oldPrice: null });
```

---

## S8 — ✅ `JwtStrategy` وضعیت `Customer.status` را چک نمی‌کند — **رفع شد (P1)**

> **رفع:** `jwt.strategy.ts` حالا وقتی `user.customer?.status === 'BLOCKED'` باشد
> `UnauthorizedException('حساب شما مسدود شده است…')` پرتاب می‌کند.
> کوئری اضافه‌ای زده نمی‌شود — `customer` از قبل `include` شده بود.

### شواهد
`CONFIRMED` `jwt.strategy.ts:27-47` (کامل):
```ts
async validate(payload: JwtPayload): Promise<RequestUser> {
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    include: { customer: true },
  });
  if (!user)          throw new UnauthorizedException('کاربر احراز هویت نشده است');
  if (!user.isActive) throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
  return { userId: user.id, phone: user.phone, role: user.role, customer: user.customer };
}
```

🔴 **`user.customer.status` چک نمی‌شود.**

### نتیجه
یک مشتری `REJECTED` یا `BLOCKED` که `user.isActive === true` است:
- ✅ توکن معتبر دارد
- ✅ به همهٔ endpointهای `JwtAuthGuard`-only دسترسی دارد
  (`/cart`, `/orders`, `/notifications`, `/tickets`, `/search/history`, ...)
- ❌ ~~می‌تواند `POST /visitor/orders` بزند~~ — **S3 رفع شد**؛ اکنون ۴۰۳ می‌گیرد
- ❌ فقط `POST /orders` را نمی‌تواند (چون `orders.service.ts:289` جداگانه چک می‌کند)

### نکته
`CONFIRMED` `cart.service.ts:10-28` **خودش** `BLOCKED` را چک می‌کند:
```ts
if (user.customer.status === 'BLOCKED') {
  throw new ForbiddenException('حساب شما مسدود شده است');
}
```
→ پس هر سرویس باید **خودش** چک کند. این الگوی پراکنده خطرناک است.

---

## S9 — 🟠 `RolesGuard` fail-open

### شواهد
`CONFIRMED` `roles.guard.ts:11-25`:
```ts
canActivate(context: ExecutionContext): boolean {
  const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;                    // ← 🔴 پیش‌فرض: اجازه
  }
  const { user } = context.switchToHttp().getRequest<RequestWithUser>();
  if (!user) throw new ForbiddenException('دسترسی مجاز نیست');
  if (!requiredRoles.includes(user.role)) {
    throw new ForbiddenException('شما دسترسی لازم برای این بخش را ندارید');
  }
  return true;
}
```

### نتیجه
> اگر `@Roles(...)` را روی یک endpoint ادمین **فراموش کنید**،
> آن endpoint برای **همه** باز می‌شود — بدون هیچ خطایی.

### نمونهٔ واقعی
`CONFIRMED` `visitor-sales.controller.ts` هم `RolesGuard` را ندارد **و هم** `@Roles` را.
هیچ‌کدام هشدار نمی‌دهند.

---

## S10 — 🟠 کد OTP به‌صورت plaintext در DB

### شواهد
`CONFIRMED` `schema.prisma:215-231`:
```prisma
model Otp {
  phone String @unique
  code  String          // ← 🔴 بدون hash
  ...
}
```

`CONFIRMED` همچنین `OtpAttempt.code String?` با کامنت:
```
// کدی که تلاش شده (اختیاری — می‌توان برای امنیت کمتر ذخیره کرد)
```
→ ولی **در عمل ذخیره می‌شود.**

### نتیجه
هر کسی که به DB دسترسی دارد (dump، بکاپ، دسترسی read-only)
می‌تواند کدهای فعال را ببیند.

⚠️ `CONFIRMED` `backups/` روی دیسک محلی ذخیره می‌شود و شامل این داده‌هاست.

---

## S11 — 🟡 `POST /app/log-error` عمومی

### شواهد
`CONFIRMED` `app-version.controller.ts` — هیچ guard ندارد.

`CONFIRMED` مدل `ErrorLog`:
```prisma
model ErrorLog {
  id, message, stack?, deviceInfo?, userId?, createdAt
  @@index([createdAt])
}
```

### نتیجه
```bash
while true; do curl -X POST http://host/app/log-error \
  -d '{"message":"x","stack":"..."}'; done
```
→ رشد نامحدود جدول، بدون احراز هویت، بدون rate limit (S1).

---

## S12 — 🟡 `SentryFilter` مقدار `request.body` را به Sentry می‌فرستد

### شواهد
`CONFIRMED` `sentry.filter.ts:29-36`:
```ts
Sentry.captureException(exception, {
  tags: { requestId },
  extra: {
    url: request.url,
    method: request.method,
    body: request.body,        // ← 🔴 کل body
  },
});
```

### وضعیت فعلی
✅ **بالقوه است، نه فعال** — چون `SENTRY_DSN` تنظیم نیست (S1 در `main.ts`).

### اگر فعال شود
endpointهایی که body حساس دارند:
| endpoint | دادهٔ حساس در body |
|---|---|
| `POST /auth/request-otp` | شماره تلفن |
| `POST /auth/verify-otp` | **کد OTP** |
| `POST /auth/onboarding` | **کد ملی**، آدرس، نام |
| `PATCH /auth/profile` | اطلاعات شخصی |
| `POST /admin/settings` | ممکن است secret داشته باشد |

### اقدام قبل از فعال‌سازی
```ts
const REDACT = ['code', 'nationalCode', 'password', 'token'];
const safeBody = Object.fromEntries(
  Object.entries(request.body ?? {}).map(([k, v]) =>
    [k, REDACT.includes(k) ? '[REDACTED]' : v])
);
```

---

## S13 — 🔴 `.env` با مقادیر زنده داخل زیپ push‌شده

### شواهد
`CONFIRMED` کلیدهای موجود در `wholesale-api/.env` (فقط نام‌ها):
```
DATABASE_URL          ← شامل username/password دیتابیس
JWT_SECRET            ← طول ۲۳، غیر-placeholder
MELIPAYAMAK_USERNAME  ← پر شده
MELIPAYAMAK_PASSWORD  ← پر شده
MELIPAYAMAK_BODY_ID   ← پر شده
NODE_ENV=development
PORT, OTP_*, BACKUP_*
```

🔴 **این مقادیر در این سند نوشته نشده‌اند و نباید نوشته شوند.**

### زنجیرهٔ نشت
```
wholesale-api/.env  (در inner git نیست — .gitignore)
        ↓ ولی
کل workspace → workspace-01a078c1-...zip (۲۴ مگابایت)
        ↓
push به github.com/alirezambhm0-blip/cuntinue_whosale01.git
```

### اقدام فوری
```
۱. JWT_SECRET را بچرخانید
۲. DATABASE_URL / رمز دیتابیس را بچرخانید
۳. اعتبارنامه‌های ملی‌پیامک را بچرخانید
۴. ریپازیتوری را خصوصی کنید یا تاریخچه را بازنویسی کنید
۵. .env.example بسازید (بدون مقدار واقعی)
```

---

## S14 — 🟡 `/docs` پشت reverse proxy باز می‌شود

### شواهد
`CONFIRMED` `main.ts:85-92`:
```ts
app.use(['/docs', '/docs-json'], (req, res, next) => {
  const remote = req.socket.remoteAddress ?? '';
  if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
    next();
    return;
  }
  res.status(404).json({ statusCode: 404, message: 'Not Found' });
});
```

✅ طراحی هوشمندانه — از `remoteAddress` استفاده می‌کند نه هدر `Host`
(کامنت کد صریحاً این را توضیح می‌دهد).

### مشکل
🔴 **اگر پشت nginx/caddy باشید، `remoteAddress` آدرس proxy است** (`127.0.0.1`).
→ شرط همیشه true می‌شود → `/docs` برای **همه** باز است.

### اقدام قبل از دیپلوی
```
۱. سرور را پشت proxy واقعی بالا بیاورید
۲. curl https://yourdomain/docs  → باید 404 بدهد
۳. اگر 200 داد، از X-Forwarded-For با trust proxy استفاده کنید
   یا /docs را در proxy مسدود کنید
```

---

## S15 — 🟢 `POST /files/kyc` بدون `RolesGuard` (عمدی)

### شواهد
`CONFIRMED` `files.controller.ts:42-52`:
```ts
@UseGuards(JwtAuthGuard)          // ← فقط JWT
@Post('kyc')
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
async uploadKyc(@UploadedFile() file, @Query('docType') docType?: KycDocType) {
  if (!docType || !VALID_DOC_TYPES.includes(docType)) {
    throw new BadRequestException(`نوع مدرک نامعتبر است...`);
  }
  ...
}
```

✅ **این عمدی و درست است** — مشتری باید بتواند مدارکش را آپلود کند.

✅ کنترل‌های موجود:
- `docType` با allowlist چک می‌شود (`VALID_DOC_TYPES`, 4 مقدار)
- `fileSize: 6 * 1024 * 1024`
- سرو از `GET /files/kyc/:filename` که `RolesGuard + @Roles(ADMIN)` دارد

⚠️ باقی‌مانده: هیچ محدودیتی روی **تعداد** آپلود نیست → یک کاربر می‌تواند
دیسک را پر کند.

---

## موارد امنیتی که **درست** پیاده شده‌اند

`CONFIRMED` — این‌ها را **تغییر ندهید**:

| ✅ مورد | محل | چرا درست است |
|---|---|---|
| فایل‌های KYC از static سرو نمی‌شوند | `main.ts:64-66` | فقط `FilesController` با `RolesGuard` |
| `useStaticAssets` فقط برای `/admin` | `main.ts:53-57` | `uploads/` exposed نیست |
| `/docs` با `remoteAddress` نه هدر `Host` | `main.ts:85-92` | با جعل هدر دور زده نمی‌شود |
| پاسخ `/docs` = 404 نه 403 | `main.ts:91` | وجودش قابل کشف نیست |
| `JwtStrategy` هر request به DB می‌زند | `jwt.strategy.ts:28` | قطع فوری دسترسی |
| کوکی `admin_token_v3` با `httpOnly` | `auth.service.ts` | از XSS محافظت می‌شود |
| توکن در `expo-secure-store` | `authStorage.ts` | رمزنگاری‌شده |
| CORS با allowlist صریح | `main.ts:37-50` | نه `origin: '*'` |
| `whitelist + forbidNonWhitelisted` | `main.ts:29-35` | mass assignment جلوگیری می‌شود |
| Snapshot قیمت در `OrderItem` | `orders.service.ts:338` | دستکاری قیمت بعد از سفارش ممکن نیست |
| مبلغ سفارش سمت سرور محاسبه می‌شود | `orders.service.ts:376` | کلاینت نمی‌تواند قیمت بفرستد |
| کسر موجودی اتمیک | `orders.service.ts:355` | race condition ندارد |
| `SentryFilter` پاسخ 5xx را عمومی می‌کند | `sentry.filter.ts:41-45` | stack نشت نمی‌کند |

---

## اولویت اقدام

```
فوری (قبل از هر دیپلوی):
  ۱. S4  — JWT_SECRET را بچرخانید
  ۲. S13 — همهٔ اعتبارنامه‌ها را بچرخانید + ریپو را خصوصی کنید
  ۳. S5-A — ✅ کد آماده (gate خودکار) · S5-B — 🔵 تست بعد از Deploy
  ۴. ✅ S3  — RolesGuard به visitor-sales.controller.ts — **انجام شد**

کوتاه‌مدت:
  ۵. S1  — app.useGlobalGuards(new ThrottlerGuard())  + تست رگرسیون
  ۶. S2  — انتقال ثبت attempts به بیرون از $transaction
  ۷. S6  — ✅ انجام شد (P1)
  ۸. S7  — ✅ انجام شد (P1)

میان‌مدت:
  ۹.  S8  — ✅ انجام شد (P1)
  ۱۰. S10 — hash کردن کد OTP
  ۱۱. S11 — guard روی /app/log-error
  ۱۲. S12 — redaction قبل از فعال‌کردن Sentry
```

⚠️ **هیچ‌کدام از این اصلاحات را بدون تأیید صریح کاربر انجام ندهید.**
→ `21-AI-AGENT-RULES.md`
