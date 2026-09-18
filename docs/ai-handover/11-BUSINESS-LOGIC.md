# 11 — BUSINESS LOGIC

> این فایل **قوانین کسب‌وکاری** پروژه را مستند می‌کند — نه ساختار کد.
> هر قانون با مسیر دقیق فایل و شمارهٔ خط ارجاع داده شده تا بتوانید verify کنید.

---

## 1. قوانین دسترسی (Access Rules)

### ۱-۱. ⭐ قانون مرکزی: سه سطح دسترسی به قیمت

| وضعیت | `Customer.status` | قیمت عمده | افزودن به سبد | ثبت سفارش |
|---|---|---|---|---|
| مهمان | — (بدون حساب) | ❌ | ❌ | ❌ |
| در انتظار تایید | `PENDING` | ❌ | ✅ | ❌ |
| رد شده | `REJECTED` | ❌ | ✅ | ❌ |
| **تایید شده** | **`APPROVED`** | ✅ | ✅ | ✅ |
| مسدود | `BLOCKED` | ❌ | ❌ | ❌ |

`CONFIRMED` منابع:
- **نمایش قیمت:** `wholesale-mobile/src/components/product/PriceBox.tsx`
- **سبد خرید:** `cart.service.ts:10-28` (`getCustomerAndCheckAccess`) — فقط `BLOCKED` رد می‌شود
- **ثبت سفارش:** `orders.service.ts:289-290`:
  ```ts
  if (customer.status !== 'APPROVED') throw new ForbiddenException('حساب تایید نشده');
  ```

### ۱-۲. 🔴 قانون قیمت فقط سمت UI اجرا می‌شود
`CONFIRMED` `GET /products` فیلد `price` را **بدون احراز هویت** برمی‌گرداند.
`PriceBox.tsx` آن را پنهان می‌کند، ولی داده در پاسخ JSON هست.
→ `15-SECURITY.md` §S3.

### ۱-۳. ⚠️ تفاوت دو متد بررسی دسترسی
`CONFIRMED` **دو متد مشابه ولی متفاوت** وجود دارد:

| متد | فایل | رفتار |
|---|---|---|
| `getCustomerAndCheck` | `orders.service.ts:274` | اگر `customer` نبود → خطا |
| `getCustomerAndCheckAccess` | `cart.service.ts:10` | اگر `customer` نبود → **خودکار می‌سازد** (`status: PENDING`) |

```ts
// cart.service.ts:18-23
if (!user.customer) {
  const customer = await this.prisma.customer.create({
    data: { userId: user.id, status: 'PENDING', onboardingCompleted: false },
  });
  return { user, customer };
}
```

⚠️ `INFERRED` یعنی اگر `Customer` به هر دلیلی حذف شده باشد،
فراخوانی `GET /cart` یک `Customer` خام با `status: PENDING` می‌سازد.

### ۱-۴. 🔒 محدودیت جغرافیایی
`CONFIRMED` از `auth/dto/complete-onboarding.dto.ts`:
```
استان: فقط «زنجان»          (@Equals)
شهر:   ابهر | خرمدره | هیدج | صائین‌قلعه   (@IsIn)
```
⚠️ **hardcode در DTO است، نه در `Setting` یا `.env`.** افزودن شهر = تغییر کد + deploy.

---

## 2. قوانین احراز هویت

### ۲-۱. OTP
| قانون | مقدار | منبع |
|---|---|---|
| طول کد | ۶ رقم | `OTP_CONFIG.CODE_LENGTH` |
| اعتبار کد | ۲ دقیقه | `OTP_CONFIG.CODE_TTL_MS` |
| حداکثر تلاش | ۵ | `OTP_CONFIG.MAX_VERIFY_ATTEMPTS` |
| مدت قفل | ۱۵ دقیقه | `OTP_CONFIG.LOCK_DURATION_MS` |
| فاصلهٔ درخواست مجدد | ۶۰ ثانیه | `OTP_CONFIG.RESEND_COOLDOWN_MS` |
| Replay | با `usedAt` جلوگیری می‌شود | `Otp.usedAt` |
| یک کد فعال به ازای هر شماره | `phone @unique` + upsert | `Otp.phone` |

`CONFIRMED` `auth.service.ts:25-31`

### ۲-۲. ساخت خودکار حساب
`CONFIRMED` در `verify-otp`:
- اگر `User` با آن شماره نبود → ساخته می‌شود با `role: CUSTOMER`
- اگر `Customer` نبود → ساخته می‌شود با `status: PENDING`, `onboardingCompleted: false`

> **پیامد کسب‌وکاری:** هر شماره‌ای که OTP را درست وارد کند، یک حساب `PENDING` می‌گیرد.
> هیچ‌کس تا تایید ادمین نمی‌تواند بخرد.

### ۲-۳. قوانین KYC
`CONFIRMED`
1. کاربر باید **۴ تصویر** آپلود کند: کارت ملی، پروانه کسب، سلفی با کارت، نمای فروشگاه
2. `docType` باید در allowlist باشد (`files.controller.ts:31-36`)
3. حداکثر حجم هر فایل: **۶ مگابایت** (`fileSize: 6 * 1024 * 1024`)
4. بعد از تکمیل: `onboardingCompleted = true`، `status` همچنان `PENDING` می‌ماند
5. **تصمیم‌گیرنده فقط ادمین است** — هیچ اتوماسیونی وجود ندارد

### ۲-۴. تغییر اطلاعات حساس
`CONFIRMED` جریان دو مرحله‌ای:
```
کاربر → POST /auth/profile/sensitive-change
        → ردیف در ProfileChangeRequest (status: PENDING)
ادمین → POST /admin/profile-changes/:id/approve  → تغییر اعمال می‌شود
     یا POST /admin/profile-changes/:id/reject
```
`CONFIRMED` فیلدهای حساس (از کامنت `schema.prisma:487`):
`storeName`, `nationalCode`, `businessLicenseImage`

---

## 3. قوانین سفارش

### ۳-۱. پیش‌شرط‌های ثبت سفارش
`CONFIRMED` از `orders.service.ts:288-296`:
1. ✅ `customer.status === 'APPROVED'`
2. ✅ سبد خرید خالی نباشد (`CART_EMPTY`)
3. ✅ همهٔ محصولات `isActive` باشند
4. ✅ موجودی همهٔ محصولات کافی باشد
5. ❌ حداقل مبلغ سفارش — **چک نمی‌شود** (`MIN_ORDER_AMOUNT` صفر ارجاع)
6. ❌ اعتبارسنجی آدرس — **انجام نمی‌شود**

### ۳-۲. ⚠️ قانون all-or-nothing
`CONFIRMED` `orders.service.ts:326-328`:
```ts
if (warnings.length > 0) {
  throw new UnprocessableEntityException({ error: 'STOCK_UNAVAILABLE', warnings });
}
```
> **اگر حتی یک آیتم مشکل داشته باشد، کل سفارش رد می‌شود.**
> سفارش جزئی ثبت نمی‌شود.

### ۳-۳. 🔒 قانون اتمیک بودن موجودی
`CONFIRMED` `orders.service.ts:355-359` + کامنت صریح در `orders.service.ts:34-40`:
```ts
await tx.product.update({
  where: { id: p.id, stock: { gte: item.quantity } },   // ← شرط
  data:  { stock: { decrement: item.quantity } },
});
```
- اگر موجودی کافی نباشد → صفر رد آپدیت می‌شود → `P2025`
- `P2025` → `UnprocessableEntityException('STOCK_UNAVAILABLE')` → کل تراکنش rollback

> ⚠️ **این تصمیم عمدی است.** کامنت کد توضیح می‌دهد که Prisma از
> `lock`/`pessimistic_write` در `findMany` پشتیبانی نمی‌کند.
> **به `SELECT ... FOR UPDATE` «بهبودش» ندهید** — Prisma پشتیبانی نمی‌کند.

### ۳-۴. Snapshot قیمت
`CONFIRMED` `orders.service.ts:338-352` — در زمان خرید در `OrderItem` ذخیره می‌شود:
```
productName, productImageUrl, productUnit,
productPrice  = p.price
originalPrice = p.oldPrice || p.price
lineTotal     = unitPrice * quantity
itemsPerPackageLabel = `${p.itemsPerPackage} عدد در ${p.packageType}`
```
> ✅ تغییر قیمت محصول بعداً، سفارش‌های قدیمی را عوض نمی‌کند. **این رفتار را حفظ کنید.**

### ۳-۵. محاسبهٔ مبلغ
`CONFIRMED` `orders.service.ts:376-380`:
```ts
subtotalAmount: subtotal,
totalAmount: subtotal,      // ← ⚠️ یکسان
shippingAmount: (ست نمی‌شود → پیش‌فرض 0)
```
✅ **تصمیم نهایی مالک پروژه:** «در نسخهٔ فعلی Production، هزینهٔ ارسال **صفر**
است و محاسبهٔ Shipping در آینده طبق Business Rule جداگانه پیاده‌سازی خواهد شد.»

پس صفر بودن `shippingAmount` **باگ نیست، رفتار عمدی است.**

`CONFIRMED` وضعیت فعلی کد:
- `orders.service.ts:397,801` → `subtotalAmount: subtotal` و `totalAmount: subtotal`
- `cart.service.ts:135` → `final_total: subtotal`
- `MIN_ORDER_AMOUNT` و `FREE_SHIPPING_MIN_AMOUNT` (در `.env.example:27-28`)
  **صفر ارجاع در کل کد** دارند — عمداً وصل نشده‌اند
- ✅ `app/checkout.tsx` که `const shipping = 0` را hardcode داشت در P2 حذف شد
- فاکتور ادمین (`admin.controller.ts:457,601`) `shippingAmount` را می‌خواند و
  اگر روزی مقدار بگیرد، **بدون تغییر** نمایشش می‌دهد

⚠️ **قانون برای Agentها:** سرخود `shippingAmount` را ست نکنید و آن دو متغیر env
را به کد وصل نکنید. منتظر Business Rule جداگانه بمانید.
زیرساخت لازم (جدول `settings` + اندپوینت `GET/POST /admin/settings`) از قبل
موجود است ⇒ پیاده‌سازی آینده **بدون migration** ممکن خواهد بود.
جزئیات: `17` §B18.

### ۳-۶. پرداخت
`CONFIRMED`
- تنها روش پیاده‌سازی‌شده: `CASH_ON_DELIVERY`
- `paymentStatus` اولیه: `UNPAID`
- **قانون ضمنی:** وقتی `status` به `DELIVERED` می‌رسد → `paymentStatus = 'PAID'`

⚠️ **هیچ رکورد پرداخت واقعی وجود ندارد.** این فقط یک flag است.

### ۳-۷. چرخهٔ حیات سفارش
```
PENDING ──► CONFIRMED ──► PROCESSING ──► SHIPPED ──► DELIVERED
   │                                                          (→ paymentStatus = PAID)
   └────────────► CANCELLED  (از هر وضعیت قبل از DELIVERED)
```

### ۳-۸. قانون لغو سفارش
`CONFIRMED` از `orders.service.ts:483-542`:
1. فقط مالک سفارش می‌تواند لغو کند (`customerId === user.customer.id`)
2. 🔁 **موجودی برگردانده می‌شود** (`stock: { increment }`)
3. یک ردیف `OrderStatusHistory` با `CANCELLED` ساخته می‌شود
4. رویداد `order.status.changed` منتشر می‌شود

⚠️ `CONFIRMED` **باگ:** در emit، `previousStatus` به‌صورت hardcode `'PENDING'` است:
```ts
new OrderStatusChangedEvent(userId, orderId, result.orderNumber, 'PENDING', 'CANCELLED')
```
اگر سفارش از `CONFIRMED` لغو شود، متن نوتیفیکیشن وضعیت قبلی را غلط نشان می‌دهد.

### ۳-۹. شمارهٔ سفارش
`CONFIRMED` `orders.service.ts:72` → `generateOrderNumber()`
`UNVERIFIED` — قالب دقیق را در همان متد ببینید (احتمالاً پیشوند + تاریخ + شمارنده).

---

## 4. قوانین سبد خرید

### ۴-۱. ⚠️ `addItem` مقدار را **جایگزین** می‌کند، نه جمع
`CONFIRMED` `cart.service.ts:151-155`:
```ts
await this.prisma.cartItem.upsert({
  where: { customerId_productId: { customerId, productId } },
  update: { quantity },        // ← 🔴 جایگزینی، نه increment
  create: { customerId, productId, quantity },
});
```

> **پیامد:** اگر کلاینت `quantity: 1` بفرستد و کاربر قبلاً ۵ عدد داشته باشد،
> سبد به **۱** تغییر می‌کند نه ۶.
> کلاینت باید **همیشه مقدار نهایی** را بفرستد.

### ۴-۲. قوانین افزودن به سبد
`CONFIRMED` `cart.service.ts:142-158`:
| چک | خطا |
|---|---|
| محصول وجود ندارد | `NotFoundException('محصول یافت نشد')` |
| `!isActive` یا `stock <= 0` | `UnprocessableEntityException('این محصول ناموجود است')` |
| `quantity > stock` | `UnprocessableEntityException('موجودی این محصول کافی نیست. موجودی فعلی: N عدد')` |

⚠️ `CONFIRMED` **`minOrderQty` چک نمی‌شود** — با اینکه در `Product` وجود دارد.

### ۴-۳. `updateItem` با مقدار ≤ ۰
`CONFIRMED` `cart.service.ts:160-163`: اگر `quantity <= 0` باشد → **آیتم حذف می‌شود**.

### ۴-۴. قوانین سفارش مجدد (`reorder`)
`CONFIRMED` `cart.service.ts:196-247`:
- دو حالت: `mode: 'add'` (اضافه به سبد فعلی) یا `'replace'` (خالی کردن و جایگزینی)
- بررسی مالکیت سفارش (`order.customerId !== customer.id` → `NotFoundException`)
- اگر محصول ناموجود/غیرفعال باشد → در `summary.unavailable` (بدون خطا)
- اگر موجودی کمتر از مقدار سفارش قبلی باشد → `Math.min(...)` + `summary.adjusted`
- خروجی: `{ cart, summary: { added, adjusted, unavailable } }`

✅ **این طراحی خوب است** — کاربر می‌فهمد چه چیزی تنظیم شده.

### ۴-۵. قوانین ادغام سبد مهمان
`CONFIRMED` `cart.service.ts:249-261`:
```ts
for (const item of localItems) {
  try { await this.addItem(userId, item.productId, item.quantity); }
  catch { /* آیتم نامعتبر لوکال نادیده گرفته می‌شود تا بقیه merge انجام شود */ }
}
```
⚠️ **خطاها بی‌صدا نادیده گرفته می‌شوند.** کاربر نمی‌فهمد کدام آیتم اضافه نشد.
⚠️ `INFERRED` `addItem` هر بار `getCustomerAndCheckAccess` را صدا می‌زند → **N+1 کوئری**.

---

## 5. قوانین کاتالوگ

### ۵-۱. قیمت‌ها
| فیلد | معنی | به مشتری نشان داده می‌شود؟ |
|---|---|---|
| `price` | قیمت فروش عمده (ریال/تومان) | فقط `APPROVED` |
| `oldPrice` | قیمت قبل از تخفیف | ✅ برای نمایش خط‌خورده |
| `costPrice` | 🔴 قیمت خرید بنکو | **هرگز** |

`CONFIRMED` درصد تخفیف در UI محاسبه می‌شود: `(oldPrice - price) / oldPrice`

### ۵-۲. جستجو و نرمال‌سازی
`CONFIRMED` دو ستون:
- `name` — متن اصلی
- `nameNormalized` — نرمال‌شده با `normalizePersian()`

⚠️ `CONFIRMED` `search.service.ts` متد `findAll` روی **`name` خام** جستجو می‌کند،
ولی `suggest` روی `nameNormalized`. → نتایج ناسازگار.

### ۵-۳. اسلاگ
`CONFIRMED` هم `Product.slug` و هم `Category.slug` یکتا (`@unique`) هستند.
`products.service.findOne(idOrSlug)` هر دو را می‌پذیرد.

### ۵-۴. واحدها
`CONFIRMED` `ProductUnit`: `CARTON` (پیش‌فرض), `KG`, `PACK`, `PIECE`, `GRAM`, `LITER`, `BOX`
+ فیلدهای کمکی `unitDetails`, `itemsPerPackage`, `packageType`

`CONFIRMED` برچسب بسته‌بندی در زمان سفارش snapshot می‌شود:
```ts
itemsPerPackageLabel: `${p.itemsPerPackage} عدد در ${p.packageType}`
```

---

## 6. قوانین نوتیفیکیشن

### ۶-۱. چه چیزی نوتیفیکیشن می‌گیرد
| رویداد | in-app | push |
|---|---|---|
| ثبت سفارش (`order.created`) | ✅ | ✅ |
| تغییر وضعیت سفارش | ✅ | ✅ (به‌جز `PENDING` و `CONFIRMED`) |
| ارسال مدارک (`kyc.submitted`) | ✅ | ✅ |
| **تایید حساب** (`kyc.approved`) | ✅ (مستقیم در `admin.service`) | 🔴 **خیر** |
| **رد حساب** (`kyc.rejected`) | ✅ (مستقیم در `admin.service`) | 🔴 **خیر** |
| Broadcast ادمین | ✅ | ✅ |

⚠️ `CONFIRMED` `ORDER_STATUS_TEMPLATE` برای `PENDING` و `CONFIRMED` نگاشتی ندارد:
```ts
{ PROCESSING: 'ORDER_PREPARING', SHIPPED: 'ORDER_SHIPPED',
  DELIVERED: 'ORDER_DELIVERED', CANCELLED: 'ORDER_CANCELLED' }
```

### ۶-۲. قوانین ارسال push
`CONFIRMED` `sendPush` در الگوها — اگر صراحتاً `false` نباشد، push فرستاده می‌شود.

### ۶-۳. قوانین «خوانده‌شده»
🔴 `CONFIRMED` `markAllAsRead` فقط ردیف‌های دارای `{ userId }` را به‌روز می‌کند.
نوتیفیکیشن‌های broadcast (`userId === null` + `targetUsers[]`) **خوانده‌شده نمی‌شوند.**

⚠️ `CONFIRMED` دو مکانیزم موازی: `Notification.isRead` **و** جدول `NotificationRead`.

---

## 7. قوانین پنل ادمین

### ۷-۱. تایید/رد مشتری
`CONFIRMED` از `admin.service.ts:124-162` (`updateCustomerStatus`):
```
۱. customer.update({ data: { status, notes: notes ?? c.notes } })
۲. اگر status === 'APPROVED' و قبلاً APPROVED نبود:
     → notification.create({ type:'ACCOUNT_VERIFIED', priority:'high',
                             deepLink: { screen:'products_list', params:{} } })
     → emit('kyc.approved')
۳. اگر status === 'REJECTED' و قبلاً REJECTED نبود:
     → notification.create({ type:'ACCOUNT_REJECTED', priority:'high',
                             deepLink: { screen:'account', params:{} } })
     → emit('kyc.rejected')
```
⚠️ `CONFIRMED` شرط `c.status !== 'APPROVED'` از **ارسال مجدد** نوتیفیکیشن جلوگیری می‌کند.

### ۷-۲. حذف سخت مشتری
`CONFIRMED` `admin.service.ts:165-186` (`hardDeleteCustomer`) در یک `$transaction`:
- ابتدا وابستگی‌ها پاک می‌شوند (سفارش‌ها، سبد، و...)
- بعد `Customer` و `User`

⚠️ **این عمل برگشت‌ناپذیر است.** `UNVERIFIED` — نتوانستم روی DB واقعی تست کنم.

### ۷-۳. تنظیمات
`CONFIRMED` جدول `Setting` (key-value). کلیدهای شناخته‌شده:
`STORE_NAME`, `VISITOR_PHONE`
`UNVERIFIED` — فهرست کامل را با `GET /admin/settings` روی یک DB واقعی بگیرید.

---

## 8. قوانین فروش حضوری (Visitor Sales)

`CONFIRMED` از `visitor-sales.service.ts` (۳۱۳ خط) و `visitor-sales.controller.ts`

| ویژگی | مقدار |
|---|---|
| `orderSource` | `VISITOR_IN_PERSON` |
| `placedByUserId` | ID کاربر ویزیتور |
| `placedByName` | نام ویزیتور |
| `visitorNote` | یادداشت ویزیتور |
| سفارش برای مشتری دیگر | ✅ ممکن است |
| محافظت با `RolesGuard` | 🔴 **نیست** |

🔴 **این یعنی هر مشتری `APPROVED` می‌تواند برای هر مشتری دیگری سفارش ثبت کند.**
→ `15-SECURITY.md` §S4.

---

## 9. قوانین مالی (فاکتور)

### ۹-۱. دو مسیر فاکتور
| endpoint | متد | نام فروشنده |
|---|---|---|
| `GET /orders/:id/invoice` | `orders.service.getInvoice` (خط ۵۴۵) | `'بنکو مارکت'` (hardcode) |
| `GET /admin/orders/:id/invoice-print` | `admin.controller` | `settings.STORE_NAME \|\| 'بنکو پخش'` |

⚠️ `CONFIRMED` **دو نام متفاوت برای یک فروشگاه.**

### ۹-۲. قالب اعداد
`CONFIRMED` از `orders.service.ts:68-70`:
```ts
private fa(n: number): string { ... }   // تبدیل به ارقام فارسی
```
+ `new Intl.DateTimeFormat('fa-IR')` برای تاریخ شمسی

---

## 10. قوانینی که در config هستند ولی **اجرا نمی‌شوند**

`CONFIRMED` — این‌ها در `.env` هستند ولی `grep -rn` در `src/` **صفر ارجاع** نشان می‌دهد:

| کلید | انتظار | واقعیت |
|---|---|---|
| `MIN_ORDER_AMOUNT` | حداقل مبلغ سفارش | ❌ هرگز چک نمی‌شود |
| `FREE_SHIPPING_MIN_AMOUNT` | آستانهٔ ارسال رایگان | ❌ هرگز چک نمی‌شود |
| `MELIPAYAMAK_FROM` | شمارهٔ فرستندهٔ پیامک | ❌ استفاده نمی‌شود |
| `MELIPAYAMAK_OTP_TOKEN` | توکن API پیامک | ❌ استفاده نمی‌شود |
| `SENTRY_DSN` | گزارش خطا | ❌ **در `.env` وجود ندارد** |

⚠️ `INFERRED` این‌ها احتمالاً برای فازهای بعدی در نظر گرفته شده‌اند.
**حذفشان نکنید** — ولی بدانید که فعال نیستند.

---

## 11. خلاصهٔ تصمیم‌های کسب‌وکاری که نباید عوض شوند

| # | تصمیم | چرا |
|---|---|---|
| B1 | قیمت فقط برای `APPROVED` | نیازمندی محصول |
| B2 | کسر موجودی با update شرطی | Prisma از قفل پشتیبانی نمی‌کند |
| B3 | Snapshot قیمت در `OrderItem` | یکپارچگی مالی سفارش‌های قدیمی |
| B4 | نوتیفیکیشن بعد از commit تراکنش | جلوگیری از پیام غلط |
| B5 | سبد با `ref` در `CartContext` | حل stale closure |
| B6 | فایل‌های KYC پشت احراز هویت | حریم خصوصی |
| B7 | `/docs` فقط localhost + پاسخ 404 | پنهان‌سازی سطح حمله |
| B8 | `JwtStrategy` هر request به DB می‌زند | قطع فوری دسترسی |
| B9 | `reorder` خطا نمی‌دهد، summary می‌دهد | تجربهٔ کاربری |
| B10 | فقط `CASH_ON_DELIVERY` | زیرساخت پرداخت آنلاین نیست |
