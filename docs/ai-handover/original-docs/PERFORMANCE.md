# PERFORMANCE.md — فاز ۵-۲: بهینه‌سازی سطح کد

تاریخ: 2026-08-24 — وضعیت: ✅ پیاده‌سازی و تأیید شد (بدون تغییر در دیتابیس)

## روش و قواعد
تحلیل read-only → تأیید دامنه با کاربر → فقط بهینه‌سازی سطح کد (بدون migration/ایندکس/کش/تعویض کتابخانه).
هر تغییر با تأیید کامپایلر (tsc)، ESLint و build همراه بود. قرارداد API رعایت شد (با grep مصرف‌کننده‌های موبایل).

---

## تغییرات اعمال‌شده

### بک‌اند (۲ فایل)

**۱. `src/orders/orders.service.ts` — باریک‌سازی select مشتری**
- **قبل:** در هر کوئری سفارش، کل ردیف `customer` (با تمام ستون‌ها: KYC، تماس، آدرس‌ها و…) از دیتابیس خوانده می‌شد، درحالی‌که `mapOrderToResponse` فقط ۳ فیلد `province/city/address` را برای ساخت رشته آدرس مصرف می‌کرد.
- **بعد:** `customer: { select: { province, city, address } }` — تایپ `OrderForResponse` نیز متناسب به‌روز شد و کامنت راهنما اضافه شد.
- **اثر:** کاهش حجم داده خوانده‌شده از DB و payload هر آبجکت سفارش در لیست‌ها. در لیست ۱۰تایی سفارش، ۱۰ ردیف کامل مشتری حذف شد. **قرارداد خروجی API بدون تغییر** (همان فیلدهای ریسپانس).

**۲. `src/products/products.service.ts` — select فقطِ فیلدهای مصرفی (۴ نقطه)**
- `findAll` و `findOne` و `getSimilar`: ساخت نقشه سبد/علاقه‌مندی کاربر به‌جای خواندن کل ردیف‌های `CartItem`/`Favorite`، فقط `productId/quantity` خوانده می‌شود.
- `findAll` (شاخه favorited) و `toggleFavorite` و `getMyFavorites`: به‌جای کل ردیف مشتری فقط `customer.id`.
- **اثر:** کاهش حجم انتقال DB در داغ‌ترین مسیرهای محصول (لیست، جزئیات، مشابه‌ها، علاقه‌مندی‌ها). بدون تغییر در خروجی.

### موبایل (۷ فایل)

**FlatList windowing props** به لیست‌های عمودی داده‌محور اضافه شد — بدون هیچ تغییری در منطق رندر:
`initialNumToRender` / `maxToRenderPerBatch` / `windowSize={7}` / `removeClippedSubviews`

| فایل | چرا مهم است |
|---|---|
| `app/(tabs)/browse.tsx` | اصلی‌ترین لیست (شبکه محصولات ۲ ستونه + infinite scroll) — بیشترین بهره |
| `app/(tabs)/cart.tsx` | آیتم‌های سبد خرید |
| `app/(tabs)/orders.tsx` | لیست سفارش‌ها |
| `app/notifications/index.tsx` | اعلان‌ها |
| `app/tickets/index.tsx` | تیکت‌ها |
| `app/search.tsx` و `src/components/search/search.tsx` | نتایج جستجو |

- **اثر:** در لیست‌های بزرگ، فقط سلول‌های داخل/نزدیک دید رندر در حافظه نگه داشته می‌شوند → کاهش معنادار مصرف RAM و جلوگیری از افت فریم هنگام اسکرول سریع در دستگاه‌های ضعیف‌تر.
- **آنچه عمداً انجام نشد:**
  - لیست افقی `chips` در browse (چند آیتم ثابت — سودی ندارد)
  - `getItemLayout`: نیازمند ارتفاع ثابت قطعی است؛ کارت‌های فعلی ارتفاع متغیر دارند و مقدار اشتباه رندر را خراب می‌کند → عمداً کنار گذاشته شد.

---

## تأیید (Verification) — سنندباکس، npx ci از لاک‌فایل

| چک | بک‌اند | موبایل |
|---|---|---|
| `tsc --noEmit` | ✅ 0 errors | ✅ 0 errors |
| ESLint | ✅ 0 problems | ✅ 0 errors (۱۴۸ warning عمدی، بدون warning جدید) |
| `npm run build` | ✅ nest build OK | — |

## موارد آگاهانه موکول‌شده (برای فازهای آینده)

| مورد | چرا فعلاً نه | چه موقع پیشنهاد می‌شود |
|---|---|---|
| ایندکس‌های Prisma (`@@index([stock])`, `@@index([nameNormalized, categoryId])` و…) | به درخواست کاربر: فعلاً بدون تغییر دیتابیس. همچنین ابتدا باید با `EXPLAIN` روی دیتای واقعی نیاز ثابت شود | وقتی لیست محصولات/سفارش‌ها به هزاران ردیف رسید یا کندی گزارش شد |
| کش درون‌حافظه‌ای بنر/دسته‌بندی/تنظیمات | ترافیک اپلیکیشن B2B مخصوص افراد خاص است و بار DB ناچیز؛ سودکم در برابر پیچیدگی invalidation (بعد از ویرایش ادمین) | رشد ترافیک یا کندی مشهود |
| تعویض `Image` → `expo-image` (۲۰ فایل) | به درخواست کاربر: فعلاً نه | فاز refactor UI |
| سقف `take: 500` در `admin.controller.products` | با pagination واقعی جایگزین شود؛ نیازمند هماهنگی با پنل ادمین | فاز پنل ادمین |

## روش سنجش قبل/بعد روی سیستم کاربر (برای ثبت baseline)

درخواست‌های تکراری به endpointهای داغ را با زمان‌گیری اندازه بگیر (۵ بار، میانگین):

```powershell
# سپس در PowerShell (با توکن واقعی):
Measure-Command { Invoke-RestMethod -Uri "http://localhost:3000/products?page=1&pageSize=24" -Headers @{Authorization="Bearer <TOKEN>"} }
Measure-Command { Invoke-RestMethod -Uri "http://localhost:3000/orders?page=1&pageSize=10" -Headers @{Authorization="Bearer <TOKEN>"} }
```

نکته: سود اصلی تغییرات بک‌اند کاهش **حجم داده خوانده‌شده از DB و حجم payload** است؛ روی latency شبکه محلی اثرش کم دیده می‌شود ولی با رشد دیتا (هزاران محصول/سفارش) و DB راه‌دور اثرش محسوس می‌شود. سود موبایل کاهش مصرف RAM و روان‌تر شدن اسکرول در لیست‌های بزرگ است — با دستگاه واقعی و یک دسته‌بندی پرمحصول قابل لمس است.

## فایل‌های تغییرکرده (۹ فایل)
```
wholesale-api/src/orders/orders.service.ts
wholesale-api/src/products/products.service.ts
wholesale-mobile/app/(tabs)/browse.tsx
wholesale-mobile/app/(tabs)/cart.tsx
wholesale-mobile/app/(tabs)/orders.tsx
wholesale-mobile/app/notifications/index.tsx
wholesale-mobile/app/tickets/index.tsx
wholesale-mobile/app/search.tsx
wholesale-mobile/src/components/search/search.tsx
```

---

## ✅ تصمیم‌های نهایی (قدم ۵ — تأیید کاربر 2026-08-31)

تابع جدول بالا، این تصمیم‌ها **نهایی و بسته** شدند تا زمانی که «تریگر» هر ردیف فعال شود:

| مورد | تصمیم نهایی | تریگر بازگشایی |
|---|---|---|
| `take: 500` در `admin.controller.products` | **حفظ فعلی** — با تعداد کالای فعلی B2B بی‌خطر است. اعتبارسنجی: وقتی نزدیک به سقف شد (مثلاً >۴۰۰ کالا)، فیکس کامل صفحه‌بندی (API + پنل) انجام می‌شود | تعداد محصولات > ۴۰۰ یا درخواست توسعه پنل |
| ایندکس‌های Prisma (`@@index`) | **موکول** — بدون داده حجیم و خروجی `EXPLAIN`، ایندکس‌گذاری حدسی ممنوع | هزاران ردیف در products/orders یا کندی گزارش‌شده با `EXPLAIN ANALYZE` |
| کش درون‌حافظه‌ای | **کنار گذاشته شد** — اپ B2B بسته با ترافیک کم؛ ریسک invalidation بی‌موجه است | رشد ترافیک یا کندی مشهود |
| مهاجرت `Image` → `expo-image` (۲۰ فایل) | **فاز مجزای UI** — با تست روی دستگاه واقعی، نه به‌عنوان تغییر پراکنده | فاز refactor UI |

یادآوری سنجش: قبل از هر بازگشایی، با اسکریپت PowerShellِ بخش «روش سنجش»، baseline ثبت شود تا ادعای بهبود با عدد اثبات شود، نه حس.
