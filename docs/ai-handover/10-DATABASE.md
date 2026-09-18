# 10 — DATABASE

> **منبع:** `wholesale-api/prisma/schema.prisma` (۵۱۵ خط) + `prisma/migrations/`
>
> **۲۲ مدل · ۱۲ enum · ۱۶ دایرکتوری migration**

---

## 1. پیکربندی

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

`CONFIRMED` PostgreSQL 16 از طریق `docker-compose.yml` (ریشهٔ پروژه).

⚠️ `CONFIRMED` **هیچ `binaryTargets` یا `previewFeatures` تنظیم نشده.**

---

## 2. 🔴 بزرگ‌ترین مشکل schema: naming ناهمگون

`CONFIRMED` این پروژه **سه سبک نام‌گذاری ستون را با هم دارد**:

| سبک | مثال |
|---|---|
| **snake_case با `@map`** | `subtotal_amount`, `order_number`, `user_id`, `is_read`, `deep_link` |
| **CamelCase بدون `@map`** | `idempotencyKey`, `customerId`, `paymentMethod`, `totalAmount`, `guestName` |
| **ترکیبی در یک مدل** | مدل `Order` هر سه سبک را دارد |

### ۲-۱. بدترین نمونه: مدل `Order`
`CONFIRMED` از `schema.prisma:149-176` — با کامنت‌های خود schema:

```prisma
model Order {
  idempotencyKey     String?       @unique // CamelCase (تایید شده)
  customerId         String?       // CamelCase (تایید شده)
  guestName          String?       // CamelCase
  guestPhone         String?       // CamelCase
  orderNumber        String        @unique @map("order_number") // snake_case (تایید شده)
  paymentMethod      PaymentMethod // CamelCase (رفع ارور فعلی: حذف @map)
  paymentStatus      PaymentStatus @default(UNPAID) // احتمالاً CamelCase   ← 🔴
  subtotalAmount     Int           @map("subtotal_amount") // snake_case (تایید شده)
  shippingAmount     Int           @default(0) // احتمالاً CamelCase        ← 🔴
  totalAmount        Int           // احتمالاً CamelCase                    ← 🔴
  ...
}
```

🔴 **سه کامنت صراحتاً می‌گویند «احتمالاً».** یعنی خود توسعه‌دهنده هم مطمئن نبوده
که ستون واقعی در DB چه نامی دارد.

⚠️ `CONFIRMED` **این فقط یک مسئلهٔ زیبایی نیست.** چون `@map` ندارد،
Prisma انتظار دارد ستون DB دقیقاً `shippingAmount` (با حرف بزرگ) باشد.
در PostgreSQL نام‌های بدون quote به lowercase تبدیل می‌شوند →
اگر migration آن ستون را `"shippingAmount"` با quote نساخته باشد، **کوئری خطا می‌دهد.**

`UNVERIFIED` — **نتوانستم migrationها را روی یک PostgreSQL واقعی اعمال کنم**
(نه دسترسی root داشتم نه docker). پس نمی‌دانم این در عمل کار می‌کند یا نه.

> **قاعدهٔ حیاتی:** قبل از هر تغییر روی مدل `Order`، روی یک DB واقعی
> `npx prisma migrate deploy` و سپس یک `order.create` تست کنید.

### ۲-۲. کامنت‌های «حذف @map» در `Customer`
```prisma
userId                String         @unique // حذف @map - رفع ارور customers.user_id
firstName             String?        // حذف @map
lastName              String?        // حذف @map
storeName             String?        // حذف @map
nationalCode          String?        // حذف @map
postalCode            String?        // حذف @map
onboardingCompleted   Boolean        @default(false) // حذف @map
```
`INFERRED` یعنی قبلاً `@map` داشته‌اند و برای رفع خطا حذف شده‌اند.
**دیتابیس احتمالاً ستون‌های snake_case دارد که دیگر با schema نمی‌خوانند.**

### ۲-۳. `Category` — تنها استثنا
```prisma
nameNormalized String?   @map("name_normalized") // فقط این snake_case است
```
`CONFIRMED` بقیهٔ فیلدهای `Category` بدون `@map` هستند.

---

## 3. مدل‌ها (۲۲ تا)

### ۳-۱. هویت و مشتری

#### `User` → جدول `users`
```
id           String  @id @default(uuid())
phone        String  @unique          ← شناسهٔ اصلی کاربر
role         UserRole @default(CUSTOMER)
isActive     Boolean @default(true)   ← ⭐ JwtStrategy این را چک می‌کند
lastSeenAt   DateTime? @default(now()) ← 🔴 هرگز به‌روز نمی‌شود
createdAt / updatedAt
searchHistory     SearchHistory[]
customer          Customer?           ← 1:1
notifications     Notification[]
notificationReads NotificationRead[]
```

#### `Customer` → جدول `customers`
```
id, userId (@unique, 1:1 با User, onDelete: Cascade)
firstName, lastName, storeName, nationalCode, postalCode
landline, province, city, address, latitude, longitude, businessType

── مدارک KYC (فقط نام فایل، نه خود فایل) ──
nationalCardImage, businessLicenseImage,
selfieWithIdCardImage, storefrontImage

onboardingCompleted  Boolean @default(false)
status               CustomerStatus @default(PENDING)   ← ⭐ کلید دسترسی
notes                String?

── روابط ──
cartItems, orders, otpAttempts, tickets, pushTokens,
changeRequests, favorites
```

⚠️ `CONFIRMED` **`Order.customer` `onDelete` ندارد** (فقط `Customer.user` دارد).
پس حذف `Customer` با سفارش‌ها خطای FK می‌دهد → به همین دلیل
`DELETE /admin/customers/:id/hard` وجود دارد (حذف دستی).

### ۳-۲. کاتالوگ

#### `Category` → `categories`
```
id, name, nameNormalized (@map, @@index), slug (@unique)
imageUrl, isActive, sortOrder, createdAt, updatedAt
products  Product[]
```
⚠️ `CONFIRMED` **خودارجاعی نیست** — `parentId` ندارد. دسته‌بندی‌ها **تخت** هستند.

#### `Product` → `products`
```
id, categoryId, name, nameNormalized (@@index), slug (@unique)
description, galleryImages (String[]), imageUrl
price          Int        ← ⭐ قیمت عمده
costPrice      Int?       ← 🔴 قیمت خرید — هرگز به مشتری ندهید
oldPrice       Int?       ← برای نمایش تخفیف
unit           ProductUnit @default(CARTON)
stock          Int @default(0)
minOrderQty    Int @default(1)   ← ⚠️ در orders.service چک نمی‌شود
isActive, isFeatured, isNew, isDiscounted
brand, productCode, unitDetails
itemsPerPackage Int?, packageType String?
sortOrder, createdAt, updatedAt
cartItems, orderItems, favorites, category
```

🔴 `CONFIRMED` **هیچ `@@index([categoryId])` یا `@@index([isActive])` روی `Product` نیست.**
فقط `@@index([nameNormalized])`.
> **پیامد کارایی:** کوئری‌های `where: { categoryId }` و `where: { isActive: true }`
> در حجم بالا کند می‌شوند.

#### `Favorite` → `favorites`
```
id, customerId, productId, createdAt
@@unique([customerId, productId])
```

#### `CartItem` → `cart_items`
```
id, customerId, productId, quantity @default(1), createdAt, updatedAt
@@unique([customerId, productId])
```

### ۳-۳. سفارش

#### `Order` → `orders`
```
id
idempotencyKey     String? @unique   ← 🔴 هرگز نوشته نمی‌شود
customerId         String?           ← nullable برای سفارش مهمان
guestName, guestPhone String?        ← 🔴 هرگز نوشته نمی‌شوند
orderNumber        String @unique @map("order_number")
status             OrderStatus @default(PENDING)
paymentMethod      PaymentMethod     ← بدون @default (اجباری)
paymentStatus      PaymentStatus @default(UNPAID)
subtotalAmount     Int @map("subtotal_amount")
shippingAmount     Int @default(0)   ← 🔴 هرگز ست نمی‌شود
totalAmount        Int               ← = subtotalAmount
note, alternativeAddress, cancellationReason
orderSource        OrderSource @default(APP)
placedByUserId, placedByName, visitorNote   ← برای فروش حضوری
createdAt, updatedAt
items OrderItem[], customer Customer?, statusHistory OrderStatusHistory[]
```

⚠️ `CONFIRMED` **`idempotencyKey @unique` ولی هرگز پر نمی‌شود.**
یعنی محافظت در برابر double-submit **وجود ندارد**.
در PostgreSQL چند `NULL` در ستون unique مجاز است، پس خطا نمی‌دهد — فقط بی‌فایده است.

#### `OrderItem` → `order_items`
```
id, orderId, productId (nullable)
── snapshot قیمت در زمان خرید ──
productName, productPrice, productUnit, productImageUrl,
originalPrice, quantity, lineTotal, itemsPerPackageLabel
createdAt, order (onDelete: Cascade), product
```
✅ **طراحی درست:** قیمت و نام در زمان خرید snapshot می‌شوند،
پس تغییر قیمت محصول بعداً، سفارش‌های قدیمی را عوض نمی‌کند.

#### `OrderStatusHistory` → `order_status_history`
```
id, orderId, status, timestamp @default(now()), note, changedBy
order (onDelete: Cascade)
```

### ۳-۴. احراز هویت

#### `Otp` → `otps`
```
id, phone @unique          ← ⭐ upsert: هر شماره فقط یک کد فعال
code          String       ← 🔴 plaintext
attempts      Int @default(0)
expiresAt     DateTime
lastAttemptAt DateTime?    ← برای محاسبهٔ lock
usedAt        DateTime?    ← جلوگیری از replay
resendCount   Int @default(0)
```

#### `OtpAttempt` → `otp_attempts`
```
id, customerId?, phone, code?, action (RESEND|VERIFY), success, ip?, userAgent?, createdAt
@@index([phone, createdAt])
```
⚠️ `CONFIRMED` فیلد `code` اختیاری است و کامنت می‌گوید
«می‌توان برای امنیت کمتر ذخیره کرد» — ولی **در عمل ذخیره می‌شود**.

### ۳-۵. پشتیبانی

#### `Ticket` → `tickets`
```
id, customerId, subject, status @default(OPEN), createdAt, updatedAt
customer (onDelete: Cascade), messages TicketMessage[]
```

#### `TicketMessage` → `ticket_messages`
```
id, ticketId, senderType (CUSTOMER|ADMIN), senderId, body, createdAt
ticket (onDelete: Cascade)
```
⚠️ `CONFIRMED` `senderId` یک رشتهٔ بدون FK است —
می‌تواند ID مشتری **یا** ID ادمین باشد. هیچ رابطه‌ای تعریف نشده.

### ۳-۶. نوتیفیکیشن

#### `Notification` → `notifications`
```
id, userId? @map("user_id")
title, body, type?, category @default("system")
imageUrl, icon
targetType   NotificationTargetType @default(ALL)
targetStatus CustomerStatus?
targetUsers  String[]
deepLink     Json? @map("deep_link")
metadata     Json?
isRead       Boolean @default(false) @map("is_read")
readAt, isBroadcast @default(false), priority @default("normal")
expiresAt, androidChannel @default("promotions")
createdAt, updatedAt
user User?, reads NotificationRead[]
@@index([userId, isRead, createdAt])
```

⚠️ `CONFIRMED` **دو مکانیزم «خوانده‌شده» موازی:**
- `isRead` / `readAt` روی خود `Notification`
- جدول `NotificationRead` (چندبه‌چند)

🔴 `CONFIRMED` `markAllAsRead` فقط ردیف‌های `{ userId }` را به‌روز می‌کند →
نوتیفیکیشن‌های broadcast (که `userId === null` و `targetUsers` دارند)
**هرگز خوانده‌شده علامت نمی‌خورند.**

#### `NotificationRead` → `notification_reads`
```
id, notificationId, userId, readAt
@@unique([notificationId, userId])
```

### ۳-۷. جستجو و سایر

#### `SearchHistory` → `search_history`
```
id, userId?, query, queryNormalized @map, resultsCount, searchedAt
@@index([userId, searchedAt])
```

#### `SearchLog` → `search_logs`
```
id, userId?, query, queryNormalized, resultsCount, hadResults, categoryId?, createdAt
@@index([queryNormalized, createdAt])
```
⚠️ `CONFIRMED` **`SearchLog` هیچ رابطه‌ای با `User` ندارد** و `userId` یک رشتهٔ خام است.
`INFERRED` برای آنالیتیکس است — و `getAnalytics` یک stub است، پس عملاً بی‌استفاده.

#### `PushToken` → `push_tokens`
```
id, customerId, token @unique, platform, createdAt, lastUsedAt
customer (onDelete: Cascade)
```
⚠️ `CONFIRMED` `lastUsedAt @default(now())` است — یعنی در لحظهٔ ساخت «استفاده‌شده» ثبت می‌شود.
`UNVERIFIED` آیا بعداً به‌روز می‌شود یا نه.

#### `Setting` → `settings`
```
key   String @id
value String
```
⚠️ `CONFIRMED` **کلید primary رشته است، نه UUID** — تنها مدلی که این‌طور است.
`CONFIRMED` کلیدهای استفاده‌شده (از `admin.service.ts` / `admin.controller.ts`):
`STORE_NAME`, `VISITOR_PHONE`, و سایر تنظیمات پنل.

#### `Banner` → `banners`
```
id, title, imageUrl, linkUrl?, sortOrder, isActive, startDate?, endDate?, createdAt, updatedAt
```
⚠️ `CONFIRMED` **هیچ index ندارد.**

#### `ProfileChangeRequest` → `profile_change_requests`
```
id, customerId, field, oldValue?, newValue,
status ChangeRequestStatus @default(PENDING), adminNotes?, createdAt, updatedAt
customer (onDelete: Cascade)
```
`CONFIRMED` این جدول جریان «درخواست تغییر اطلاعات حساس» را پشتیبانی می‌کند
(`POST /auth/profile/sensitive-change` → تایید ادمین در `/admin/profile-changes/*`).

#### `ErrorLog` → `error_logs`
```
id, message, stack?, deviceInfo?, userId?, createdAt
@@index([createdAt])
```
⚠️ `CONFIRMED` از `POST /app/log-error` پر می‌شود که **عمومی و بدون rate limit** است.
> **خطر:** می‌تواند بدون احراز هویت پر شود → رشد نامحدود جدول.

---

## 4. enumها (۱۲ تا)

| enum | مقادیر | نکته |
|---|---|---|
| `UserRole` | `CUSTOMER` `ADMIN` `VISITOR` | `VISITOR` در `seed.ts` ساخته و در `visitor-sales` چک می‌شود |
| `CustomerStatus` | `PENDING` `APPROVED` `REJECTED` `BLOCKED` | ⭐ کلید دسترسی به قیمت |
| `OrderStatus` | `PENDING` `CONFIRMED` `PROCESSING` `SHIPPED` `DELIVERED` `CANCELLED` | |
| `PaymentMethod` | `CASH_ON_DELIVERY` `CARD_TO_CARD` `ZARRINPAL` `ZIBAL` | ⚠️ فقط اولی استفاده می‌شود |
| `PaymentStatus` | `UNPAID` `PENDING` `PAID` `FAILED` `CANCELLED` | |
| `ProductUnit` | `CARTON` `KG` `PACK` `PIECE` `GRAM` `LITER` `BOX` | |
| `OrderSource` | `APP` `ADMIN` `VISITOR_IN_PERSON` | ⚠️ `APP` هرگز صریحاً ست نمی‌شود |
| `OtpAction` | `RESEND` `VERIFY` | |
| `TicketStatus` | `OPEN` `ANSWERED` `CLOSED` | |
| `SenderType` | `CUSTOMER` `ADMIN` | |
| `NotificationTargetType` | `ALL` `STATUS_BASED` `SPECIFIC_USERS` | |
| `ChangeRequestStatus` | `PENDING` `APPROVED` `REJECTED` | |

🔴 `CONFIRMED` **ناهمخوانی با موبایل:** `src/constants/enums.ts` در موبایل
`CASH_ON_DELIVERY` را **ندارد** — فقط `{CARD_TO_CARD, ZARRINPAL, ZIBAL}`.
یعنی تنها روش پرداخت واقعی در enum موبایل غایب است.

---

## 5. نمودار روابط

```
User (users)
 │ 1:1 (onDelete: Cascade)
 ▼
Customer (customers) ──────────────┬──────────────┬──────────────┐
 │                                 │              │              │
 │ 1:N                             │ 1:N          │ 1:N          │ 1:N
 ▼                                 ▼              ▼              ▼
Order (orders)               CartItem        Favorite       Ticket
 │ 1:N (Cascade)                 │ N:1            │ N:1        │ 1:N (Cascade)
 ▼                               ▼                ▼            ▼
OrderItem (order_items)      Product         Product      TicketMessage
 │ N:1 (بدون Cascade)            ▲
 ▼                               │ N:1
Product                          │
                             Category

User ──1:N──► Notification ──1:N──► NotificationRead ──N:1──► User
User ──1:N──► SearchHistory
Customer ──1:N──► OtpAttempt
Customer ──1:N──► PushToken
Customer ──1:N──► ProfileChangeRequest

مستقل (بدون رابطه): Otp, Setting, Banner, SearchLog, ErrorLog
```

---

## 6. Migrationها — ۱۶ دایرکتوری

`CONFIRMED` از `ls prisma/migrations`:

```
20260621145545_init                        ← 🔴 init #1
20260628182230_add_otp_model
20260705200752_add_customer_onboarding_kyc
20260707_otp_hardening                     ← ⚠️ بدون timestamp استاندارد
20260708003754_init                        ← 🔴 init #2
20260708_add_cod_payment                   ← ⚠️ بدون timestamp استاندارد
20260720182517_init                        ← 🔴 init #3
20260721232003_add_product_flags
20260722070706_add_product_features
20260724174052_add_favorites
20260724200140_add_settings_table
20260724224027_add_security_features
20260725190136_add_cost_price              ← 🔴 افزودن costPrice
20260727171318_enable_guest_orders
20260810095506_new3db                      ← 🔴 مخرب
20260817203724_add_items_per_package
```

### ۶-۱. 🔴 سه دایرکتوری `*_init`
`CONFIRMED` **سه migration با نام `init`** وجود دارد
(`20260621145545_init`, `20260708003754_init`, `20260720182517_init`).

`INFERRED` یعنی schema چند بار از صفر ساخته شده — احتمالاً با
`prisma migrate reset` یا حذف دستی `_prisma_migrations`.

> **پیامد:** روی یک DB جدید، `migrate deploy` ممکن است خطای
> «table already exists» بدهد، چون هر سه init جدول‌ها را می‌سازند.

### ۶-۲. 🔴 `20260810095506_new3db`
`CONFIRMED` نامش نشان می‌دهد یک بازسازی کامل DB بوده.

`UNVERIFIED` — **نتوانستم اعمالش کنم.** محتوایش را بخوانید قبل از هر دیپلوی:
```bash
cat wholesale-api/prisma/migrations/20260810095506_new3db/migration.sql
```

### ۶-۳. ⚠️ دو migration با نام غیراستاندارد
`20260707_otp_hardening` و `20260708_add_cod_payment` timestamp ۱۴ رقمی استاندارد
Prisma را ندارند.
`INFERRED` احتمالاً دستی ساخته شده‌اند. Prisma آن‌ها را بر اساس ترتیب الفبایی
اعمال می‌کند، پس باید مراقب ترتیب باشید.

### ۶-۴. 🔴 وضعیت تأیید: `UNVERIFIED`
**هیچ‌کدام از این migrationها روی یک PostgreSQL واقعی اعمال نشده‌اند.**
دلیل: در محیط تحلیل نه docker بود نه دسترسی root برای نصب PostgreSQL.

```bash
# آنچه واقعاً اجرا شد:
npx prisma validate     → ✅ "The schema is valid"
npx prisma generate     → ✅ Prisma Client v5.22.0 ساخته شد
# آنچه اجرا نشد:
npx prisma migrate deploy   → ❌ هرگز
npx prisma migrate status   → ❌ هرگز
```

> **قبل از اولین دیپلوی، حتماً روی یک DB خالی تست کنید.**

---

## 7. ایندکس‌ها

`CONFIRMED` همهٔ `@@index` های موجود:

| مدل | ایندکس |
|---|---|
| `Category` | `[nameNormalized]` |
| `Product` | `[nameNormalized]` |
| `OtpAttempt` | `[phone, createdAt]` |
| `Notification` | `[userId, isRead, createdAt]` |
| `SearchHistory` | `[userId, searchedAt]` |
| `SearchLog` | `[queryNormalized, createdAt]` |
| `ErrorLog` | `[createdAt]` |

### ۷-۱. ⚠️ ایندکس‌های غایب (بر اساس کوئری‌های واقعی کد)
| کوئری | فایل | ایندکس لازم |
|---|---|---|
| `product.findMany({ where: { categoryId } })` | `products.service.ts` | `[categoryId]` |
| `product.findMany({ where: { isActive } })` | `products.service.ts` | `[isActive]` یا `[isActive, sortOrder]` |
| `order.findMany({ where: { customerId, status } })` | `orders.service.ts:409` | `[customerId, createdAt]` |
| `order.findMany({ where: { status } })` | `orders.service.ts:560` (`listAll`) | `[status, createdAt]` |
| `banner.findMany({ where: { isActive } })` | `banners.service.ts` | `[isActive, sortOrder]` |
| `orderItem` روی `orderId` | — | ✅ Prisma خودکار برای FK می‌سازد |

⚠️ `INFERRED` — این‌ها پیشنهاد بر اساس الگوی کوئری‌ها هستند، نه خطای مشاهده‌شده.
قبل از افزودن، با `EXPLAIN ANALYZE` روی دادهٔ واقعی verify کنید.

---

## 8. Seed

`CONFIRMED` `prisma/seed.ts` با اسکریپت `npm run seed` (یا `npm run db:seed`).

محتوا (`INFERRED` از خواندن فایل): ساخت کاربر ادمین اولیه + دسته‌بندی‌های پایه.

🔴 **شماره تلفن و جزئیات ادمین در این فایل است — آن را در خروجی/مستندات چاپ نکنید.**

---

## 9. قواعد تغییر schema

```
☐ ۱. schema.prisma را ویرایش کنید
☐ ۲. npx prisma validate
☐ ۳. npx prisma migrate dev --name <descriptive_name>
☐ ۴. ⚠️ SQL تولیدشده را دستی بخوانید — به‌ویژه DROP COLUMN / ALTER TYPE
☐ ۵. روی یک کپی از دادهٔ واقعی تست کنید
☐ ۶. npx prisma generate
☐ ۷. npm run build && npm test
☐ ۸. اگر فیلد جدید به پاسخ API اضافه شد، DTO و تایپ موبایل را هم به‌روز کنید
```

### ۹-۱. ⚠️ کارهایی که نکنید
- ❌ `npx prisma format` — فایل را بازنویسی می‌کند و کامنت‌های «احتمالاً» را جابه‌جا می‌کند
- ❌ `npx prisma db push` روی DB دارای داده
- ❌ `prisma migrate reset` — هر سه `*_init` را دوباره اجرا می‌کند
- ❌ افزودن `@map` به فیلدی که قبلاً نداشته، بدون migration دستی

### ۹-۲. ⚠️ همگام‌سازی سه‌جانبه
هر تغییر فیلد باید در **سه جا** منعکس شود:
1. `prisma/schema.prisma`
2. DTO / تایپ پاسخ در بک‌اند
3. `wholesale-mobile/src/types/index.ts`
