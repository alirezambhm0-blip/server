# 08 — DATA FLOW

---

## 1. جریان کلی داده

```
┌──────────┐   axios/fetch    ┌────────────┐   Prisma   ┌──────────┐
│  Client  │ ───────────────► │  NestJS    │ ─────────► │ Postgres │
│          │ ◄─────────────── │  Service   │ ◄───────── │          │
└──────────┘      JSON        └────────────┘            └──────────┘
                                     │
                                     ├─ EventEmitter → NotificationsService
                                     │                    ├─ DB (Notification)
                                     │                    └─ Expo Push
                                     └─ filesystem (uploads/, backups/)
```

`CONFIRMED` **هیچ cache، صف پیام، یا ردیس وجود ندارد.** همه‌چیز مستقیم به Postgres می‌رود.

---

## 2. ⭐ جریان ثبت سفارش (مهم‌ترین جریان پروژه)

`CONFIRMED` از `wholesale-api/src/orders/orders.service.ts:288-405` → `createFromCart()`

### ۲-۱. پیش‌شرط‌ها (خارج از تراکنش)
```
۱. getCustomerAndCheck(userId)
     → user + customer را از DB می‌خواند
     → اگر customer نبود: ForbiddenException

۲. if (customer.status !== 'APPROVED')
     → ForbiddenException('حساب تایید نشده')

۳. cartItem.findMany({ where: { customerId }, include: { product: true } })
     → اگر خالی: BadRequestException('CART_EMPTY')
```

### ۲-۲. داخل `$transaction`
```
۴. product.findMany({ where: { id: { in: productIds } } })
     → یک productMap ساخته می‌شود

۵. حلقهٔ بررسی:
     • محصول نیست یا isActive=false  → warning { type: 'product_inactive' }
     • p.stock < item.quantity       → warning { type: 'stock_unavailable', available_stock }

۶. اگر warnings.length > 0
     → UnprocessableEntityException({ error: 'STOCK_UNAVAILABLE', warnings })
     ⚠️ یعنی اگر حتی یک آیتم مشکل داشته باشد، کل سفارش رد می‌شود (all-or-nothing)

۷. حلقهٔ ساخت آیتم‌ها + کسر موجودی:
     subtotal += unitPrice * item.quantity
     orderItemsData.push({
        productId, productName, productImageUrl, productUnit,
        productPrice: p.price,
        originalPrice: p.oldPrice || p.price,     ← ⭐ snapshot قیمت
        quantity,
        lineTotal: unitPrice * item.quantity,
        itemsPerPackageLabel: `${p.itemsPerPackage} عدد در ${p.packageType}`
     })

     await tx.product.update({
       where: { id: p.id, stock: { gte: item.quantity } },   ← 🔒 شرط اتمیک
       data:  { stock: { decrement: item.quantity } },
     })
     catch P2025 → UnprocessableEntityException('STOCK_UNAVAILABLE')

۸. tx.order.create({
     orderNumber: generateOrderNumber(),
     customerId,
     status: 'PENDING',
     paymentMethod: 'CASH_ON_DELIVERY',
     paymentStatus: 'UNPAID',
     subtotalAmount: subtotal,
     totalAmount: subtotal,               ← ⚠️ بدون هزینهٔ ارسال
     note: customerNote,
     alternativeAddress: isAlternativeAddress ? deliveryAddress : null,
     statusHistory: { create: { status:'PENDING', note:'سفارش ثبت شد' } },
     items: { createMany: { data: orderItemsData } },
   })

۹. tx.cartItem.deleteMany({ where: { customerId } })   ← سبد خالی می‌شود
```

### ۲-۳. بعد از commit (خارج از تراکنش)
```
۱۰. .then(result => {
      this.eventEmitter.emit(EVENT_ORDER_CREATED,
        new OrderCreatedEvent(userId, result.id, result.orderNumber))
      // ⚠️ داخل try/catch — «Notification failure must not break order placement»
    })
```

✅ `CONFIRMED` این ترتیب **عمدی و درست** است: نوتیفیکیشن بعد از commit می‌رود.

### ۲-۴. 🔴 چه چیزی در این جریان **نیست**
| مورد | وضعیت |
|---|---|
| `shippingAmount` | ❌ هرگز ست نمی‌شود (پیش‌فرض DB) |
| `idempotencyKey` | ❌ نه ست می‌شود نه از کلاینت می‌آید |
| `MIN_ORDER_AMOUNT` | ❌ چک نمی‌شود |
| اعتبارسنجی آدرس | 🟡 فقط رشته است، هیچ چکی ندارد |
| `orderSource` | ❌ در این مسیر ست نمی‌شود (فقط در مسیر ویزیتور) |

---

## 3. سه مسیر ساخت سفارش

`CONFIRMED` **سه متد مختلف** در `orders.service.ts` سفارش می‌سازند:

| متد | مسیر API | چه کسی | `orderSource` |
|---|---|---|---|
| `createFromCart` (خط ۲۸۸) | `POST /orders` | مشتری از اپ | ❌ ست نمی‌شود |
| `createAdminOrder` (خط ۶۲۳) | `POST /orders/admin/create` | ادمین از پنل | `ADMIN_MANUAL` |
| `createVisitorOrder` | `POST /visitor/orders` | ویزیتور | `VISITOR_IN_PERSON` |

⚠️ **هر سه منطق جداگانه دارند.** اگر قانونی اضافه می‌کنید
(مثلاً حداقل مبلغ)، باید در **هر سه** اعمال شود.

---

## 4. جریان تغییر وضعیت سفارش

`CONFIRMED` از `orders.service.ts:580-611` → `updateStatus()`

```
۱. order.findUnique({ where: { id: orderId }, include: { customer: true } })
     → اگر نبود: NotFoundException

۲. order.update({ data: { status, paymentStatus } })

۳. اگر status تغییر کرده بود و customerId وجود داشت:
     emit(EVENT_ORDER_STATUS_CHANGED,
          new OrderStatusChangedEvent(customerId, orderId, orderNumber,
                                      exists.status, status))

۴. return updated
```

### ۴-۱. 🔴 قانون ضمنی: `DELIVERED` → `PAID`
`CONFIRMED` در `orders.service.ts` هنگام `DELIVERED` شدن، `paymentStatus` به `PAID` تغییر می‌کند.

⚠️ **هیچ رکورد پرداخت واقعی وجود ندارد.** این فقط یک flag است.
> اگر می‌خواهید حسابداری اضافه کنید، این نقطهٔ شروع است.

### ۴-۲. مسیر لغو سفارش
`CONFIRMED` از `orders.service.ts:483-542` → `cancelOrder()`:
```
۱. بررسی مالکیت (customerId === user.customer.id)
۲. بررسی وضعیت مجاز برای لغو
۳. 🔁 بازگرداندن موجودی: tx.product.update({ data: { stock: { increment } } })
۴. order.update({ status: 'CANCELLED' })
۵. emit(EVENT_ORDER_STATUS_CHANGED, ..., 'PENDING', 'CANCELLED')
```

⚠️ `CONFIRMED` در emit، `previousStatus` به‌صورت **hardcode `'PENDING'`** نوشته شده
نه `exists.status`. اگر سفارش از `CONFIRMED` لغو شود، تاریخچهٔ غلط می‌رود.

---

## 5. جریان سبد خرید

### ۵-۱. 🔴 واقعیت: مهمان **نمی‌تواند** سبد خرید داشته باشد
`CONFIRMED` از `src/context/CartContext.tsx`:

```ts
// خط ۱۶۷ — addToCart
if (!isLoggedIn) return { ok: false, message: 'برای افزودن به سبد باید وارد شوید' };

// خط ۱۲۵-۱۲۷ — بارگذاری اولیه
} else {
  if (!cancelled) { setItems([]); await cartStorage.clearCart(); }
}
```

> **یعنی:** کاربر `guest` / `unauthenticated` نه می‌تواند چیزی اضافه کند،
> و نه سبد ذخیره‌شدهٔ محلی دارد — `cartStorage` در حالت لاگین‌نکرده **پاک می‌شود**.

⚠️ `cartStorage` یک **cache** برای کاربر لاگین‌شده است، نه ذخیره‌ساز سبد مهمان.

### ۵-۲. همگام‌سازی در mount
`CONFIRMED` `CartContext.tsx:107-133`:
```
اگر isLoggedIn && accessToken:
   local = cartStorage.getCart()
   localSlim = local.filter(i => i.productId && i.quantity > 0)
                  .map(i => ({ productId, quantity }))
   remote = await cartApi.merge(localSlim)      ← ⭐ POST /cart/merge
   setItems(serverCartToLocal(remote).items)
   اگر خطا → fallback به local + syncError = 'خطا در همگام‌سازی با سرور'
```

✅ **پس merge پیاده‌سازی شده** — در `CartContext` init، نه در `AuthContext.login`.

### ۵-۳. صف عملیات (`taskQueue`)
`CONFIRMED` `CartContext.tsx:68, 81-104`:
```ts
const taskQueue = useRef<Promise<unknown>>(Promise.resolve());
```
همهٔ عملیات سرور به‌صورت **سریالی** روی یک صف اجرا می‌شوند تا
optimistic updateها با هم تداخل نکنند.

### ۵-۴. endpointهای سبد
`CONFIRMED` `cart.controller.ts` + `cart/dto/`:
| DTO | کاربرد |
|---|---|
| `add-item.dto.ts` | افزودن آیتم |
| `update-item.dto.ts` | تغییر تعداد |
| `merge-cart.dto.ts` | ادغام سبد محلی با سرور |

---

## 6. جریان جستجو

`CONFIRMED` از `search/search.service.ts` (۲۵۲ خط)

```
۱. ورودی خام (query)
۲. normalizePersian(query)  ← از common/utils/normalization.ts
     • ي → ی · ك → ک
     • آ أ إ ٱ → ا · ؤ → و · ئ → ی · ة → ه
     • حذف اعراب (\u064B-\u065F)
     • نیم‌فاصله → فاصله
     • اعداد فارسی/عربی → لاتین
     • toLowerCase()
     • حذف فواصل اضافی
۳. جستجو روی ستون nameNormalized
```

### ۶-۱. 🔴 باگ تأییدشده
`CONFIRMED` در `search.service.ts` متد `findAll` روی ستون **`name`** (خام) جستجو می‌کند،
نه `nameNormalized`. یعنی:

```
جستجوی «ابزار» ✅ می‌گیرد
جستجوی «ابزار» با ي عربی  ❌ نمی‌گیرد
```

⚠️ **اما** `suggest` از `nameNormalized` استفاده می‌کند.
> **نتیجه:** suggest و search نتایج متفاوت می‌دهند.

### ۶-۲. ⚠️ باگ دوم در `normalizePersian`
`CONFIRMED` از `common/utils/normalization.ts`:
```ts
// ۱. یکسان‌سازی «ی» و «ک» (عربی به فارسی)
normalized = normalized.replace(/\u064A/g, '\u06CC'); // ي -> ی
normalized = normalized.replace(/\u064B/g, '\u06CC'); // ئ -> ی (تقریبی برای جست‌وجو)
normalized = normalized.replace(/\u0643/g, '\u06A9'); // ك -> ک
```

🔴 دو مشکل:
1. **کامنت غلط است** — `\u064B` فتحه/تنوین است، نه «ئ». («ئ» = `\u0626` که در خط ۲۲ جداگانه هندل شده)
2. **ترتیب غلط است** — این جایگزینی **قبل از** مرحلهٔ ۳ (`حذف اعراب`) انجام می‌شود.
   پس هر متن دارای تنوین یک «ی» اضافی می‌گیرد به‌جای اینکه حذف شود.

> **اثر عملی:** کم (تنوین در فارسی نادیر است) ولی یک باگ واقعی است.

### ۶-۳. ⚠️ `getAnalytics` یک stub است
`CONFIRMED` `SearchService.getAnalytics` فقط `// TODO` دارد.

---

## 7. جریان نوتیفیکیشن

```
رویداد منتشر می‌شود (orders.service / auth.service / admin.service)
   ↓
EventEmitter (@nestjs/event-emitter)
   ↓
NotificationEventsListener  ← تنها شنوندهٔ ثبت‌شده
   ↓ pushFromTemplate(userId, templateKey, params)
NotificationsService.createAndPush(
   userIds, title, body, targetType, deepLink, channelId, data, sendPush
)
   ↓
   ├─ DB: notification.create(...)
   └─ اگر sendPush !== false:
        Expo Push (expo-server-sdk)
          ├─ chunkedPushMessages
          └─ رسیدگیری از ticketها
```

### ۷-۱. 🔴 رویدادهای بدون شنونده
| رویداد | منتشرشده از | وضعیت |
|---|---|---|
| `kyc.approved` | `admin.service.ts:146` | 🔴 بدون شنونده |
| `kyc.rejected` | `admin.service.ts:159` | 🔴 بدون شنونده |

`CONFIRMED` **نتیجهٔ دقیق:** `admin.service.ts:124-162` (`updateCustomerStatus`)
**خودش مستقیماً** نوتیفیکیشن in-app را در DB می‌سازد، پس کاربر در اپ پیام را می‌بیند.
🔴 ولی چون رویداد شنونده ندارد، **Push notification فرستاده نمی‌شود** —
پیام روی lock screen نمی‌آید و کاربر تا بازکردن اپ خبردار نمی‌شود.

### ۷-۲. ⚠️ `markAllAsRead` ناقص
`CONFIRMED` فقط ردیف‌های `{ userId }` را علامت می‌زند.
نوتیفیکیشن‌های broadcast (که با `targetType` متفاوت ذخیره می‌شوند) خوانده‌شده نمی‌شوند.

### ۷-۳. 🔴 deep link سمت موبایل کار نمی‌کند
`CONFIRMED` `src/utils/notificationRouting.ts` هرگز import نشده.
پس کلیک روی نوتیفیکیشن به `deepLink` ارسال‌شده بی‌اعتناست.

---

## 8. جریان آپلود فایل

```
Client (expo-image-picker در onboarding)
   ↓ multipart/form-data
POST /files/upload (FilesController)
   ↓
multer → حافظه/دیسک موقت
   ↓
sharp → resize/بهینه‌سازی
   ↓
fs.writeFile → uploads/{kyc|products|categories}/<filename>
   ↓
DB: فایل رکورد می‌شود (در صورت نیاز)
```

### ۸-۱. 🔒 دسترسی به فایل‌ها
`CONFIRMED` از کامنت `main.ts:64-66`:
```
// فایل‌های uploads/kyc فقط برای ادمین از طریق FilesController سرو می‌شوند.
// فایل‌های products/categories به‌صورت public از طریق FilesController.servePublic سرو می‌شوند.
// (از استاتیک مستقیم استفاده نمی‌کنیم تا CORS/header کنترل شده باشد.)
```

✅ `useStaticAssets` فقط برای `/admin` است، نه `uploads/`.

> **قاعده:** هرگز `useStaticAssets('uploads')` اضافه نکنید — مدارک ملی لو می‌روند.

---

## 9. جریان پیامک

```
auth.service.requestOtp
   ↓
SmsService.sendOtp(phone, code)
   ↓
soap.createClientAsync('http://api.payamak-panel.com/post/send.asmx?wsdl')
   ↓
client.SendSms({ username, password, to, from, text, ... })
```

`CONFIRMED` از `.env` خوانده می‌شود:
- `MELIPAYAMAK_USERNAME` ✅
- `MELIPAYAMAK_PASSWORD` ✅
- `MELIPAYAMAK_BODY_ID` ✅
- `MELIPAYAMAK_FROM` ❌ **صفر ارجاع**
- `MELIPAYAMAK_OTP_TOKEN` ❌ **صفر ارجاع**

⚠️ `CONFIRMED` WSDL روی **HTTP ساده** است (نه HTTPS).

---

## 10. الگوی `mapOrderToResponse`

`CONFIRMED` از `orders.service.ts:208-272`

بک‌اند **هرگز** موجودیت Prisma را خام برنمی‌گرداند — همه‌جا از
`mapOrderToResponse()` عبور می‌دهد که:
- فیلدهای لازم را انتخاب می‌کند
- برچسب فارسی وضعیت را اضافه می‌کند (`getStatusLabel`)
- رنگ وضعیت را اضافه می‌کند (`getStatusColor`)
- زمان نسبی فارسی می‌سازد (`getRelativeTime`)
- timeline می‌سازد (`buildTimeline`)

✅ **این الگو را حفظ کنید.** اگر endpoint جدیدی برای سفارش اضافه می‌کنید،
از همین متد استفاده کنید.

✅ **استثنا رفع شد (P1):** `GET /products/favorites` قبلاً این الگو را نقض
می‌کرد و ردیف خام Prisma را برمی‌گرداند (شامل `costPrice`).
→ `15-SECURITY.md` §S6.
⚠️ تصحیح: ارجاع قبلی به §S5 غلط بود — `costPrice` مربوط به **S6** است، نه S5.

---

## 11. خلاصهٔ نقاط شکست در جریان داده

| # | نقطه | مشکل | منبع |
|---|---|---|---|
| D1 | `search.findAll` | روی `name` خام، نه `nameNormalized` | `search.service.ts` |
| D2 | `normalizePersian` | `\u064B` → ی (قبل از حذف اعراب) | `normalization.ts:12` |
| D3 | `cancelOrder` emit | `previousStatus` hardcode `'PENDING'` | `orders.service.ts:536` |
| D4 | `shippingAmount` | هرگز ست نمی‌شود | `orders.service.ts` |
| D5 | `idempotencyKey` | هرگز ست نمی‌شود | `schema.prisma` |
| D6 | `kyc.approved/rejected` | بدون شنونده | `notifications.module.ts` |
| D7 | `markAllAsRead` | فقط `{userId}` | `notifications.service.ts` |
| D8 | `GET /products/favorites` | ردیف خام با `costPrice` | `favorites.controller.ts` |
| D9 | `lastSeenAt` | هرگز نوشته نمی‌شود | `schema.prisma` |
| D10 | `SearchService.getAnalytics` | stub با `// TODO` | `search.service.ts` |
