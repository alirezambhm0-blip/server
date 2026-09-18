# 09 — API / BACKEND

> **منبع:** سرشماری کامل با اسکریپت روی همهٔ `*.controller.ts` + شمارش دستی
> `grep -cE "^\s*@(Get|Post|Put|Patch|Delete)\("` روی هر فایل.
>
> **جمع کل: ۱۱۷ endpoint** در ۱۵ فایل controller.
> **هیچ prefix سراسری وجود ندارد** — مسیرها همان‌طور که نوشته شده‌اند.

---

## 1. آمار کلی

| Controller | تعداد | Guard سطح کلاس |
|---|---|---|
| `admin.controller.ts` | **42** | `JwtAuthGuard, RolesGuard` + `@Roles(ADMIN)` |
| `orders.controller.ts` | 10 | `JwtAuthGuard` |
| `products.controller.ts` | 10 | — |
| `auth.controller.ts` | 9 | — |
| `cart.controller.ts` | 9 | — (method-level `JwtAuthGuard`) |
| `search.controller.ts` | 7 | — |
| `categories.controller.ts` | 5 | — |
| `files.controller.ts` | 5 | — |
| `notifications.controller.ts` | 5 | — |
| `tickets.controller.ts` | 4 | — |
| `visitor-sales.controller.ts` | 4 | — (۳ controller در یک فایل) |
| `profile.controller.ts` | 3 | — |
| `app-version.controller.ts` | 2 | — |
| `banners.controller.ts` | 1 | — |
| `favorites.controller.ts` | 1 | — |
| **جمع** | **117** | |

---

## 2. جدول کامل endpointها

علامت‌ها: 🔒 = JWT لازم · 👑 = فقط ADMIN · 🟡 = JWT اختیاری · 🌐 = عمومی · 🔴 = مشکل امنیتی

### ۲-۱. `auth.controller.ts` — ۹

| متد | مسیر | دسترسی |
|---|---|---|
| POST | `/auth/request-otp` | 🌐 |
| POST | `/auth/verify-otp` | 🌐 |
| POST | `/auth/onboarding` | 🔒 |
| GET | `/auth/me` | 🔒 |
| GET | `/auth/kyc-status` | 🔒 |
| PATCH | `/auth/profile` | 🔒 |
| POST | `/auth/profile/sensitive-change` | 🔒 |
| GET | `/auth/profile/pending-changes` | 🔒 |
| POST | `/auth/logout` | 🔒 |

### ۲-۲. `products.controller.ts` + `favorites.controller.ts` — ۱۱

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/products` | 🟡 `OptionalJwtAuthGuard` |
| GET | `/products/counts` | 🌐 |
| GET | `/products/favorites` | 🔒 🔴 **ردیف خام Prisma با `costPrice`** |
| POST | `/products/:id/favorite` | 🔒 |
| GET | `/products/:id` | 🟡 `OptionalJwtAuthGuard` |
| GET | `/products/:id/similar` | 🌐 |
| POST | `/products/toggle-favorite` | 🔒 |
| POST | `/products` | 🔒👑 |
| PUT | `/products/:id` | 🔒👑 |
| DELETE | `/products/:id` | 🔒👑 |
| POST | `/favorites/toggle` | 🔒 |

⚠️ `CONFIRMED` **سه endpoint مختلف برای علاقه‌مندی وجود دارد:**
`POST /products/:id/favorite` · `POST /products/toggle-favorite` · `POST /favorites/toggle`
`INFERRED` احتمالاً تکراری/تاریخی‌اند. قبل از حذف، ببینید موبایل کدام را صدا می‌زند.

### ۲-۳. `categories.controller.ts` — ۵

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/categories` | 🌐 |
| GET | `/categories/:id` | 🌐 |
| POST | `/categories` | 🔒👑 |
| PUT | `/categories/:id` | 🔒👑 |
| DELETE | `/categories/:id` | 🔒👑 |

### ۲-۴. `banners.controller.ts` — ۱

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/banners` | 🌐 |

### ۲-۵. `cart.controller.ts` — ۹ (همه 🔒)

| متد | مسیر |
|---|---|
| GET | `/cart` |
| POST | `/cart/items` |
| PUT | `/cart/items` |
| PATCH | `/cart/items/:productId` |
| DELETE | `/cart/items/:productId` |
| DELETE | `/cart` |
| POST | `/cart/merge` |
| POST | `/cart/validate` |
| POST | `/cart/reorder` |

### ۲-۶. `orders.controller.ts` — ۱۰ (کلاس: 🔒)

| متد | مسیر | دسترسی |
|---|---|---|
| POST | `/orders` | 🔒 |
| GET | `/orders` | 🔒 |
| GET | `/orders/latest` | 🔒 |
| GET | `/orders/active` | 🔒 |
| GET | `/orders/:id` | 🔒 |
| POST | `/orders/:id/cancel` | 🔒 |
| GET | `/orders/:id/invoice` | 🔒 |
| GET | `/orders/admin/all` | 🔒👑 |
| PATCH | `/orders/:id/status` | 🔒👑 |
| POST | `/orders/admin/create` | 🔒👑 |

✅ `CONFIRMED` **فرضیهٔ shadowing رد شد.** `/orders/admin/all` و `/orders/admin/create`
توسط `/:id` سایه نمی‌شوند — Express 5 سگمنت‌های ایستا را اولویت می‌دهد.
این با اجرای واقعی تأیید شد (`GET /orders/admin/all` → 200، `POST /orders/admin/create` → 201).

### ۲-۷. `search.controller.ts` — ۷

| متد | مسیر | دسترسی |
|---|---|---|
| GET | `/search` | 🟡 `OptionalJwtAuthGuard` |
| GET | `/search/suggestions` | 🌐 |
| GET | `/search/popular` | 🌐 |
| GET | `/search/history` | 🔒 |
| POST | `/search/history` | 🔒 |
| DELETE | `/search/history` | 🔒 |
| DELETE | `/search/history/:id` | 🔒 |

### ۲-۸. `notifications.controller.ts` — ۵ (همه 🔒)

| متد | مسیر |
|---|---|
| GET | `/notifications` |
| POST | `/notifications/:id/read` |
| POST | `/notifications/read-all` |
| POST | `/notifications/push-token` |
| DELETE | `/notifications/push-token` |

### ۲-۹. `tickets.controller.ts` — ۴ (همه 🔒)

| متد | مسیر |
|---|---|
| GET | `/tickets` |
| GET | `/tickets/:id` |
| POST | `/tickets` 🔴 **بدون DTO** |
| POST | `/tickets/:id/reply` |

### ۲-۱۰. `profile.controller.ts` — ۳ (همه 🔒)

| متد | مسیر |
|---|---|
| GET | `/user/profile` |
| PATCH | `/user/profile` 🔴 **بدون DTO** |
| PATCH | `/user/address` 🔴 **بدون DTO** |

⚠️ `CONFIRMED` **تداخل با `auth.controller.ts`:**
`PATCH /auth/profile` (با `UpdateProfileDto`) و `PATCH /user/profile` (بدون DTO)
هر دو پروفایل را ویرایش می‌کنند. `INFERRED` تکراری‌اند.

### ۲-۱۱. `files.controller.ts` — ۵

| متد | مسیر | دسترسی |
|---|---|---|
| POST | `/files/kyc` | 🔒 (هر کاربر لاگین‌شده) |
| GET | `/files/kyc/:filename` | 🔒👑 |
| POST | `/files/product` | 🔒👑 |
| POST | `/files/category` | 🔒👑 |
| GET | `/files/public/:kind/:filename` | 🌐 |

`CONFIRMED` محدودیت حجم: `fileSize: 6 * 1024 * 1024` (۶ مگابایت)
`CONFIRMED` `kind` مجاز در `servePublic`: فقط `product`, `category`, `banner`

⚠️ `CONFIRMED` **`POST /files/kyc` فقط `JwtAuthGuard` دارد — `RolesGuard` ندارد.**
این عمدی است (مشتری باید مدارکش را آپلود کند) ولی `docType` با allowlist چک می‌شود.

### ۲-۱۲. `app-version.controller.ts` — ۲ (🌐)

| متد | مسیر |
|---|---|
| GET | `/app/version` |
| POST | `/app/log-error` |

⚠️ `CONFIRMED` `POST /app/log-error` **عمومی و بدون rate limit** است —
می‌تواند برای پرکردن لاگ/دیتابیس سوءاستفاده شود.

### ۲-۱۳. `visitor-sales.controller.ts` — ۴ 🔴

سه controller در یک فایل:

| متد | مسیر | دسترسی واقعی |
|---|---|---|
| GET | `/admin/visitor-sales/dashboard` | 🔒 `JwtAuthGuard, RolesGuard` + `@Roles(ADMIN, VISITOR)` ✅ |
| GET | `/admin/visitor-sales/orders` | 🔒 `JwtAuthGuard, RolesGuard` + `@Roles(ADMIN, VISITOR)` ✅ |
| GET | `/admin/customers/search` | 🔒 فقط JWT — **تعارض با AdminController** 🔴 |
| POST | `/visitor/orders` | 🔒 `JwtAuthGuard, RolesGuard` + `@Roles(ADMIN, VISITOR)` ✅ |

🔴 `CONFIRMED` **هیچ `RolesGuard` در این فایل نیست.** هر مشتری تاییدشده می‌تواند
`POST /visitor/orders` را برای **هر مشتری دیگری** صدا بزند.

🔴 `CONFIRMED` **تعارض مسیر تأییدشده:**
- `AdminController @Get('customers/search')` → `/admin/customers/search` (👑)
- `CustomerSearchController @Get('search')` در همین فایل → `/admin/customers/search` (🔒 فقط)

چون `AdminModule` قبل از `VisitorSalesModule` در `app.module.ts` آمده،
`AdminController` برنده است → **مشتری ۴۰۳ می‌گیرد.**

> **پیامد:** `VisitorSalesService.searchCustomers` عملاً **کد مرده** است.

### ۲-۱۴. `admin.controller.ts` — ۴۲ (همه 🔒👑)

Guard سطح کلاس: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`

**مشتریان (۸)**
```
GET    /admin/dashboard
GET    /admin/customers
GET    /admin/customers/search       ← 🔴 برندهٔ تعارض با visitor-sales
GET    /admin/customers/:id
POST   /admin/customers
PUT    /admin/customers/:id
PATCH  /admin/customers/:id/status   ← تایید/رد KYC
DELETE /admin/customers/:id/hard
```

**سفارش‌ها (۴)**
```
GET    /admin/orders
PATCH  /admin/orders/:id/status
DELETE /admin/orders/:id/hard
GET    /admin/orders/:id/invoice-print
```

**محصولات (۵)**
```
GET    /admin/products
GET    /admin/products/:id
POST   /admin/products
PUT    /admin/products/:id
DELETE /admin/products/:id/hard
```

**دسته‌بندی‌ها (۴)**
```
GET    /admin/categories
POST   /admin/categories
PUT    /admin/categories/:id
DELETE /admin/categories/:id/hard
```

**بنرها (۴)**
```
GET    /admin/banners
POST   /admin/banners
PUT    /admin/banners/:id
DELETE /admin/banners/:id
```

**آپلود (۳)**
```
POST   /admin/upload/product
POST   /admin/upload/category
POST   /admin/upload/banner
```
⚠️ `CONFIRMED` این سه با `POST /files/{product,category}` **تکراری‌اند**.
تفاوت: نسخهٔ `admin/*` وقتی فایل نیست `{ error: 'no file' }` با **200** برمی‌گرداند
(نه `BadRequestException`).

**تیکت‌ها (۳)**
```
GET    /admin/tickets
POST   /admin/tickets/:id/reply
PATCH  /admin/tickets/:id/status
```

**نوتیفیکیشن (۲)**
```
GET    /admin/notifications
POST   /admin/notifications
```

**تغییرات پروفایل (۳)**
```
GET    /admin/profile-changes
POST   /admin/profile-changes/:id/approve
POST   /admin/profile-changes/:id/reject
```

**تنظیمات و امنیت (۶)**
```
GET    /admin/settings
POST   /admin/settings
GET    /admin/otp-attempts
GET    /admin/security/stats
GET    /admin/security/errors
GET    /admin/security/active-users
```

---

## 3. الگوهای پاسخ

### ۳-۱. صفحه‌بندی (pagination)
`CONFIRMED` الگوی رایج در `listAll`, `listCustomerOrders`, `listOtpAttempts`:
```json
{
  "items": [...],
  "total": 123,
  "page": 1,
  "pageSize": 20,
  "totalPages": 7
}
```
⚠️ `UNVERIFIED` — نام دقیق فیلدها را قبل از تکیه کردن، در همان متد چک کنید.
`INFERRED` همهٔ listها از یک الگو پیروی نمی‌کنند.

### ۳-۲. خطا
`CONFIRMED` پیش‌فرض NestJS:
```json
{ "statusCode": 400, "message": "...", "error": "Bad Request" }
```
با `ValidationPipe({ forbidNonWhitelisted: true })`، فیلد ناشناخته →
```json
{ "statusCode": 400, "message": ["property X should not exist"], "error": "Bad Request" }
```

### ۳-۳. 🔴 `throw new Error(...)` → HTTP 500 (بدون نشتی stack)

`CONFIRMED` **۹ نقطه** در کد محصول `throw new Error(...)` دارند (نه `HttpException`):

| فایل:خط | پیام | کاربر باید چه ببیند |
|---|---|---|
| `auth/auth.service.ts:224` | `'EXPIRED'` | ۴۰۰ «کد منقضی شده» |
| `auth/auth.service.ts:229` | `'ALREADY_USED'` | ۴۰۰ «کد قبلاً استفاده شده» |
| `auth/auth.service.ts:246` | `` `WRONG_CODE:${remaining}` `` | ۴۰۰ «کد اشتباه، N تلاش باقی‌مانده» |
| `admin/admin.service.ts:205` | «این شماره همراه قبلاً … ثبت شده است.» | ۴۰۹ |
| `admin/admin.service.ts:352` | «هیچ مشتری تایید شده ای … یافت نشد.» | ۴۰۴ |
| `categories/categories.service.ts:93` | «این دسته‌بندی دارای محصول است …» | ۴۰۹ |
| `profile/profile.service.ts:147` | «تغییر فیلدهای … نیاز به تایید ادمین دارد.» | ۴۰۳ |
| `tickets/tickets.controller.ts:31` | «فقط مشتریان می‌توانند تیکت ثبت کنند» | ۴۰۳ |
| `tickets/tickets.controller.ts:37` | «فقط مشتریان می‌توانند پاسخ دهند» | ۴۰۳ |

(دهمین مورد در `orders.service.spec.ts:534` است که فایل تست است، نه کد محصول.)

#### ✅ نتیجهٔ آزمایش واقعی
`CONFIRMED` با یک اپ NestJS حداقلی و همان `@nestjs/common@11` نصب‌شده در پروژه اجرا شد:
```
throw new Error('EXPIRED')            → 500 {"statusCode":500,"message":"Internal server error"}
throw new BadRequestException('bad')  → 400 {"message":"bad","error":"Bad Request","statusCode":400}
```

> **دو نتیجهٔ مهم:**
> 1. ✅ **stack trace به کلاینت نشت نمی‌کند** — فیلتر پیش‌فرض NestJS پیام عمومی می‌دهد.
>    (ادعای قبلی مبنی بر نشتی stack **نادرست بود** و با آزمایش رد شد.)
> 2. 🔴 **ولی کاربر پیام واقعی را هم نمی‌بیند.** پیام‌های فارسیِ معنادار
>    («کد اشتباه است، ۴ تلاش باقی‌مانده») هرگز به موبایل نمی‌رسند.

#### 🔴 بدترین مورد: OTP
`CONFIRMED` `auth.service.verifyOtp` **هیچ `try/catch` ندارد** —
`await this.prisma.$transaction(async (tx) => { ... })` بدون catch رها شده
(تنها `catch` در `requestOtp` خط ۱۸۰ است).

پس:
| سناریو | وضعیت HTTP واقعی | وضعیت درست |
|---|---|---|
| کد منقضی | **500** | 400 |
| کد قبلاً استفاده‌شده (replay) | **500** | 400 |
| **کد اشتباه** | **500** | 400 |

> **پیامد کاربری:** وقتی مشتری کد OTP را اشتباه وارد می‌کند، اپ خطای عمومی سرور
> نشان می‌دهد، نه «کد اشتباه است». همچنین شمارش `attempts` در DB ثبت می‌شود
> (خط ۲۳۵-۲۳۸) ولی کاربر از تعداد تلاش باقی‌مانده خبردار نمی‌شود.
>
> ⚠️ `CONFIRMED` توجه: `attempts: { increment: 1 }` در تراکنش است، ولی چون
> `throw` باعث rollback می‌شود، **افزایش attempts هم rollback می‌شود**.
> `UNVERIFIED` — برای تأیید این رفتار به DB واقعی نیاز است.

### ۳-۴. `UnprocessableEntityException` ساختاریافته
`CONFIRMED` در `orders.service.ts`:
```json
{
  "statusCode": 422,
  "message": {
    "error": "STOCK_UNAVAILABLE",
    "warnings": [{ "type": "stock_unavailable", "product_id": "...", "product_name": "...", "available_stock": 3 }]
  }
}
```
⚠️ `message` اینجا یک **آبجکت** است، نه رشته. اگر UI آن را `String()` کند، `[object Object]` می‌شود.

---

## 4. اعتبارسنجی ورودی

`CONFIRMED` از `main.ts:29-35`:
```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
```

### ۴-۱. DTOهای موجود
```
auth/dto/request-otp.dto.ts
auth/dto/verify-otp.dto.ts
auth/dto/complete-onboarding.dto.ts   (۲۷۶ خط)
auth/dto/update-profile.dto.ts
auth/dto/sensitive-change.dto.ts
cart/dto/add-item.dto.ts
cart/dto/update-item.dto.ts
cart/dto/merge-cart.dto.ts
categories/dto/create-category.dto.ts
categories/dto/update-category.dto.ts
notifications/dto/push-token.dto.ts
products/dto/create-product.dto.ts
products/dto/update-product.dto.ts
tickets/dto/ticket.dto.ts
```

### ۴-۲. 🔴 endpointهای بدون DTO
| endpoint | مشکل |
|---|---|
| `PATCH /user/profile` | هیچ DTO ندارد — `@Body()` خام |
| `PATCH /user/address` | هیچ DTO ندارد |
| `POST /tickets` | هیچ DTO ندارد |
| `POST /orders` | 🟡 از `@Body(...)` فیلد به فیلد می‌خواند |
| `POST /orders/:id/cancel` | `@Body('reason')` خام |

⚠️ `CONFIRMED` **`tickets/dto/ticket.dto.ts` وجود دارد** ولی `POST /tickets` از آن استفاده نمی‌کند.

> **پیامد:** این endpointها از `whitelist` سودی نمی‌برند — هر payloadی عبور می‌کند.

---

## 5. Swagger

`CONFIRMED`
- URL: `/docs` (UI) و `/docs-json` (OpenAPI JSON)
- Title: **Bonko Market API**
- Version: `1.0`
- Auth: `addBearerAuth()` + `persistAuthorization: true`
- 🔒 **فقط localhost** — middleware روی `req.socket.remoteAddress`
- پاسخ غیرمجاز: **404** (عمداً نه 403)

⚠️ `INFERRED` **اگر پشت reverse proxy باشید، `remoteAddress` آدرس proxy است**
→ `/docs` برای همه باز می‌شود. قبل از دیپلوی با nginx/caddy این را چک کنید.

⚠️ `CONFIRMED` اسکیمای DTOها با پلاگین `@nestjs/swagger` (تنظیم در `nest-cli.json`)
خودکار ساخته می‌شود — پس endpointهای بدون DTO در Swagger هم بی‌اسکیمایند.

---

## 6. قواعد اضافه‌کردن endpoint جدید

`CONFIRMED` / `INFERRED` از الگوهای موجود

1. **در controller مناسب بگذارید** — نه یک فایل جدید، مگر دامنهٔ جدید باشد.
2. **`@UseGuards(JwtAuthGuard)` اضافه کنید** — پیش‌فرض عمومی است، نه محافظت‌شده.
3. **برای ادمین `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`** —
   هر دو لازم است (`RolesGuard` بدون `JwtAuthGuard` کار نمی‌کند چون `req.user` نیست).
4. **DTO بنویسید** — وگرنه `whitelist` بی‌اثر است.
5. **اگر پاسخ شامل `Product` است، `costPrice` را حذف کنید.**
6. **از `mapOrderToResponse` برای سفارش استفاده کنید** — موجودیت خام برنگردانید.
7. **بعد از اضافه‌کردن، شمارش endpoint را به‌روز کنید** (این فایل + `AI-PROJECT-HANDOVER.md`).

### ۶-۱. چک‌لیست قبل از merge
```bash
cd wholesale-api
npm run build                                        # باید exit 0
npm test                                             # ۴ suite / ۱۸ تست
npx eslint "{src,apps,libs,test}/**/*.ts"            # باید 0/0
```
