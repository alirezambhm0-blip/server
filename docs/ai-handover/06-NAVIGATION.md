# 06 — NAVIGATION

---

## 1. موبایل — Expo Router (file-based)

`CONFIRMED` **۳۴ فایل** در `wholesale-mobile/app/`.

### ۱-۱. نقشهٔ کامل routeها

```
app/
├── _layout.tsx                 ← 🔒 root layout (Stack، providers، guard)
├── index.tsx                   ← redirect خالص (بدون UI)
├── welcome.tsx                 ← ورودی مهمان / لاگین
├── onboarding.tsx              ← فرم KYC چندمرحله‌ای
├── product-detail.tsx          ← جزئیات محصول
├── search.tsx                  ← جستجو
├── edit-profile.tsx            ← ویرایش پروفایل
│
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── otp.tsx
│
├── (tabs)/
│   ├── _layout.tsx             ← Tabs با ۵ صفحه
│   ├── home.tsx
│   ├── browse.tsx
│   ├── cart.tsx                ← ⭐ ثبت سفارش واقعی اینجا
│   ├── orders.tsx
│   └── profile.tsx
│
├── (profile)/
│   ├── store-info.tsx
│   ├── edit-address.tsx
│   ├── favorites.tsx           ← ⚠️ STUB
│   ├── notification-settings.tsx ← ⚠️ STUB
│   ├── info-about.tsx          ← محتوای ثابت
│   ├── info-faq.tsx            ← محتوای ثابت
│   ├── info-guide.tsx          ← محتوای ثابت
│   ├── info-privacy.tsx        ← محتوای ثابت
│   └── info-terms.tsx          ← محتوای ثابت
│
├── orders/
│   ├── [id].tsx                ← جزئیات سفارش
│   └── success.tsx             ← صفحهٔ موفقیت بعد از ثبت
│
├── notifications/
│   ├── _layout.tsx
│   └── index.tsx
│
└── tickets/
    ├── _layout.tsx
    ├── index.tsx               ← لیست تیکت‌ها
    ├── new.tsx                 ← تیکت جدید
    └── [id].tsx                ← جزئیات تیکت
```

### ۱-۲. نکتهٔ مهم دربارهٔ `app/` ریشه
`CONFIRMED` **`app/_layout.tsx` یک `Stack` است** و فقط **۵ `Stack.Screen`** اعلام کرده:
```tsx
<Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
  <Stack.Screen name="index" />
  <Stack.Screen name="welcome" />
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="onboarding" />
  <Stack.Screen name="(tabs)" />
</Stack>
```

⚠️ **`CONFIRMED` routeهای زیر در Stack اعلام نشده‌اند:**
`product-detail`, `search`, `edit-profile`, `(profile)`, `orders`,
`notifications`, `tickets`

`INFERRED` expo-router همچنان آن‌ها را ثبت می‌کند (routeهای فایل‌محور به‌صورت خودکار
اضافه می‌شوند) ولی **`screenOptions` ریشه روی آن‌ها اعمال نمی‌شود**.
یعنی ممکن است header داشته باشند یا انیمیشن متفاوت.
`UNVERIFIED` — نتوانستم اپ را اجرا کنم.

> **اگر می‌خواهید header را برای یک صفحه کنترل کنید، آن را صریحاً در Stack اضافه کنید.**

---

## 2. تب‌ها

`CONFIRMED` از `app/(tabs)/_layout.tsx`:

| ترتیب | name | عنوان | آیکون | برای مهمان |
|---|---|---|---|---|
| ۱ | `home` | خانه | `home-outline` | ✅ نمایش |
| ۲ | `browse` | دسته‌بندی | `grid-outline` | ✅ نمایش |
| ۳ | `cart` | سبد خرید | `cart-outline` | ❌ `href: null` |
| ۴ | `orders` | سفارش‌ها | `receipt-outline` | ❌ `href: null` |
| ۵ | `profile` | پروفایل | `person-outline` | ✅ نمایش |

### ۲-۱. پنهان‌سازی تب برای مهمان
```tsx
href: isGuest ? null : undefined
```
`CONFIRMED` کامنت صریح در فایل (خط ۴۵-۴۸):
```
مهمان فقط ۳ تب می‌بیند (خانه/دسته‌بندی/پروفایل)؛
با ورود به حساب، سبد خرید و سفارش‌ها ظاهر می‌شوند (href: null = پنهان‌سازی تب).
```

⚠️ `CONFIRMED` **`href: null` فقط تب را پنهان می‌کند — route را نمی‌بندد.**
یک مهمان می‌تواند با `router.push('/(tabs)/cart')` مستقیم به آن برود.
محدودیت واقعی در `CartContext.addToCart` است، نه در navigation.

### ۲-۲. badge سبد خرید
```tsx
tabBarBadge: totalItems > 0 ? totalItems : undefined
tabBarBadgeStyle: { backgroundColor: "#EF4444", color: "white", fontSize: 10 }
```
⚠️ `CONFIRMED` رنگ `#EF4444` **hardcode** است و از هیچ پالتی نمی‌آید.

### ۲-۳. استایل tab bar
```tsx
headerShown: false
tabBarActiveTintColor: "#2563EB"
tabBarInactiveTintColor: "#94A3B8"
tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 8 }
```
⚠️ `CONFIRMED` باز هم **hardcode**، نه از `theme.ts`.

---

## 3. نمودار جریان navigation

```
                    ┌─────────────┐
       cold start → │ index.tsx   │  (بدون UI — فقط Redirect)
                    └──────┬──────┘
        ┌──────────────────┼───────────────────┐
        │                  │                   │
  unauthenticated   guest / authenticated   needsOnboarding
        │                  │                 یا REJECTED
        ▼                  ▼                   ▼
  ┌──────────┐      ┌─────────────┐      ┌────────────┐
  │ welcome  │      │ (tabs)/home │      │ onboarding │
  └────┬─────┘      └──────┬──────┘      └─────┬──────┘
       │                   │                   │
   ┌───┴───┐               │              POST /auth/onboarding
   │       │               │                   │
guest   login              │                   └──► (tabs)/home
   │       │               │
   │       ▼               │
   │  ┌─────────┐          │
   │  │(auth)/  │          │
   │  │ login   │          │
   │  └────┬────┘          │
   │       ▼               │
   │  ┌─────────┐          │
   │  │(auth)/  │          │
   │  │  otp    │          │
   │  └────┬────┘          │
   │       └───────────────┴───────────────┐
   │                                       │
   └───────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │      (tabs)          │
        │  home · browse ·     │
        │  cart · orders ·     │
        │  profile             │
        └───────┬──────────────┘
                │
   ┌────────────┼────────────────────────────┐
   │            │                            │
   ▼            ▼                            ▼
product-detail  (profile)/*            orders/[id]
search          notifications          orders/success
edit-profile    tickets/{index,new,[id]}
```

---

## 4. ✅ `app/checkout.tsx` — route یتیم — **حذف شد (P2)**

این فایل ۳۳۳ خط کد مرده بود و با دستور صریح مالک پروژه حذف شد.
پیش از حذف تأیید شد: صفر ارجاع ورودی، هیچ `Stack.Screen name="checkout"` در
`_layout.tsx`، و هیچ functionality منحصربه‌فردی که لازم باشد منتقل شود.
جزئیات کامل: `17` §B21.

⚠️ `.expo/types/router.d.ts` یک فایل **generated** است (در `.gitignore`) که تا
بازسازی، `/checkout` را در تایپ‌های `typedRoutes` نگه می‌دارد. با `expo start`
از نو ساخته می‌شود.

### مسیر واقعی (و اکنون یکتای) ثبت سفارش
```
app/(tabs)/cart.tsx
   ├─ دکمهٔ «ثبت سفارش» → ساخت idempotencyKey → باز شدن شیت تأیید
   └─ شیت تأیید → handlePlaceOrder()        ← خط ~۱۴۶
        ├─ if (placing) return               ← محافظ Double Tap
        └─ placeOrderApi({ ..., idempotency_key })   ← src/api/ordersApi.ts
             └─ POST /orders
                  └─ router.push({ pathname: '/orders/success', params: {...} })
```
ℹ️ تصحیح: پیش از این در همین سند `router.replace(...)` نوشته شده بود؛
کد واقعی `router.push(...)` است (`cart.tsx:165`).

---

## 5. ⚠️ routeهای stub

### ۵-۱. `app/(profile)/favorites.tsx`
`CONFIRMED` شمارش استفاده:
```
Api.       → 0
useAuth    → 0
useCart    → 0
useFavorites → 0
```
فقط متن ثابت نمایش می‌دهد. با اینکه `FavoritesContext.tsx` وجود دارد
و `favorites.controller.ts` در بک‌اند هست.

### ۵-۲. `app/(profile)/notification-settings.tsx`
`CONFIRMED` همان شمارش → همه صفر. تنظیمات جایی ذخیره نمی‌شود.

### ۵-۳. صفحات `info-*`
`CONFIRMED` این‌ها هم صفر API call دارند — ولی **عمدی** است (محتوای حقوقی/راهنما ثابت است).
اشتباه نگیرید: این‌ها stub نیستند.

---

## 6. پنل ادمین — navigation

`CONFIRMED` hash-based، بدون library.

### ۶-۱. ۱۱ view
```
#dashboard       داشبورد
#customers       مشتریان (تایید/رد KYC)
#orders          سفارش‌ها (تغییر وضعیت، فاکتور)
#visitor-sales   فروش حضوری
#products        محصولات
#categories      دسته‌بندی‌ها
#banners         بنرها
#tickets         تیکت‌ها
#notifications   اعلان‌ها (ارسال broadcast)
#security        امنیت
#settings        تنظیمات
```

### ۶-۲. مکانیزم
```
location.hash تغییر می‌کند
    ↓
app.js → router()
    ↓
renderLayout()  ← sidebar + header
    ↓
تابع global مربوطه (renderOrders / renderProducts / ...)
    ↓
innerHTML روی container
```

### ۶-۳. ⚠️ قاعدهٔ حیاتی
هر فایل JS باید **قبل از `app.js`** در `index.html` بیاید،
چون `app.js` توابع global بقیه را صدا می‌زند.
اگر فایل جدیدی اضافه می‌کنید و آن را در `index.html` نگذارید،
`app.js` خطای `ReferenceError` می‌دهد.

---

## 7. Deep link و نوتیفیکیشن

### ۷-۱. سمت بک‌اند
`CONFIRMED` `notifications/constants/notification-templates.ts` هشت الگو دارد
و هر کدام `data.route` تعریف می‌کند (رشته یا تابع):

| الگو | route | آیا واقعاً فرستاده می‌شود؟ |
|---|---|---|
| `ORDER_CREATED` | `/orders/${orderId}` | ✅ بله |
| `ORDER_PREPARING` | `/orders/${orderId}` | ✅ بله (از `PROCESSING`) |
| `ORDER_SHIPPED` | `/orders/${orderId}` | ✅ بله |
| `ORDER_DELIVERED` | `/orders/${orderId}` | ✅ بله |
| `ORDER_CANCELLED` | `/orders/${orderId}` | ✅ بله |
| `KYC_SUBMITTED` | `/onboarding` | ✅ بله |
| `KYC_APPROVED` | `/(tabs)/browse` | 🔴 **خیر** — الگوی مرده |
| `KYC_REJECTED` | `/onboarding` | 🔴 **خیر** — الگوی مرده |

✅ `CONFIRMED` همهٔ مسیرهای بالا **در `app/` وجود دارند** (`orders/[id].tsx`, `onboarding.tsx`, `(tabs)/browse.tsx`).

⚠️ `CONFIRMED` `ORDER_STATUS_TEMPLATE` برای `PENDING` و `CONFIRMED` **نگاشتی ندارد**:
```ts
{ PROCESSING: 'ORDER_PREPARING', SHIPPED: ..., DELIVERED: ..., CANCELLED: ... }
```
→ تغییر وضعیت به `CONFIRMED` هیچ نوتیفیکیشنی نمی‌فرستد.

🔴 `CONFIRMED` الگوهای `KYC_APPROVED` / `KYC_REJECTED` مرده‌اند چون
رویداد `kyc.approved` / `kyc.rejected` شنوندهٔ ثبت‌شده ندارد → `04-ARCHITECTURE.md` §6.
(نوتیفیکیشن in-app مستقیماً در `admin.service.ts` ساخته می‌شود؛ فقط **push** نمی‌رود.)

🔴 `CONFIRMED` **دو فرمت متفاوت `deepLink` در DB وجود دارد:**
- از `admin.service.ts:141,155` → `{ screen: 'products_list', params: {} }` (آبجکت)
- از `notification-templates.ts` → `"/orders/123"` (رشتهٔ مسیر)

هر دو در ستون `Notification.deepLink` (نوع `Json`) نوشته می‌شوند و ناسازگارند.

⚠️ `CONFIRMED` فایل مردهٔ `notification.listener.ts` مسیر **`/profile/kyc`** را استفاده می‌کند
که **در `app/` وجود ندارد**. اگر روزی آن فایل را ثبت کنید، deep link خراب می‌شود.

### ۷-۲. سمت موبایل
`CONFIRMED` `src/utils/notificationRouting.ts` وجود دارد ولی:
```bash
grep -rn "notificationRouting" wholesale-mobile/app wholesale-mobile/src
# → فقط تعریف خودش
```
🔴 **هرگز import نشده** → کلیک روی نوتیفیکیشن هیچ routing نمی‌کند.

---

## 8. قواعد navigation که باید رعایت شوند

`CONFIRMED` / `INFERRED` از الگوهای موجود در کد

1. **از `router.replace` برای جریان احراز هویت استفاده کنید، نه `push`**
   (`index.tsx` از `<Redirect>` استفاده می‌کند، `_layout.tsx` از `router.replace`)
   تا کاربر با back به login برنگردد.

2. **`lastRedirectRef` در `_layout.tsx` عمداً است** — از حلقهٔ redirect بی‌پایان جلوگیری می‌کند.
   حذفش نکنید.

3. **`useRootNavigationState()` باید چک شود** قبل از `router.replace` —
   وگرنه در mount اولیه خطا می‌دهد (`_layout.tsx:71`).

4. **routeهای dynamic با `[id]`** — `orders/[id].tsx` و `tickets/[id].tsx`.
   پارامتر با `useLocalSearchParams()` خوانده می‌شود.

5. **groupها فقط سازمان‌دهی‌اند** — `(auth)` و `(tabs)` و `(profile)` در URL ظاهر نمی‌شوند.
   `/(tabs)/home` یعنی `app/(tabs)/home.tsx`.
