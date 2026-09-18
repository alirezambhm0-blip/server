# BONKO MARKET — PHASE 1
# XSS REMEDIATION + COMPLETE ADMIN ESCAPE AUDIT

**تاریخ:** ۲۰۲۶-۰۹-۰۸ · **نقش:** Senior Application Security Engineer · **پرامپت:** `Bonko Phase 1 XSS Remediation & Escape Audit.pdf` (۲۱ صفحه)

---

## 1. Executive Result

# ✅ P0 XSS REMEDIATED

هر دو آسیب‌پذیری `CONFIRMED` رفع شدند و با **آزمون DOM واقعی (jsdom)** اثبات شد که payload مهاجم دیگر هیچ المان یا event handler نمی‌سازد و صرفاً به‌صورت **متن** رندر می‌شود.

ممیزی سیستماتیک escape روی **کل** دایرکتوری `public/admin/` (۳٬۸۲۷ خط، ۱۲۷ سینک) در **دو پاس مستقل** انجام شد. پاس دوم — که با الگوریتمی متفاوت و با فرض «من این اصلاحات را ننوشته‌ام» اجرا شد — **هیچ XSS تأییدشدهٔ جدیدی نیافت**.

| سنجه | مقدار |
|---|---|
| payload مهاجم آزموده‌شده | **۲۱ / ۲۱ PASS** |
| رگرسیون مقادیر مشروع | **۹ / ۹ PASS** |
| `npm run build` | **PASS** (exit 0) |
| `npm test` | **PASS** (7 suites / 57 tests) |
| `npx prisma validate` | **PASS** |
| فایل تغییر یافته | **۳ + ۱ جدید** |

---

## 2. P0-1 — Stored XSS از طریق `POST /app/log-error`

### Root cause
تابع `esc()` در `core.js:5` موجود و **کاملاً صحیح** است (`&` `<` `>` `"` `'` را پوشش می‌دهد، `String(s==null?'':s)` برای null/undefined امن است، و چون `core.js` در `index.html:12` **پیش از** همهٔ اسکریپت‌ها لود می‌شود به‌صورت global در دسترس است). مشکل این بود که در `app.js:1085` به‌کار نرفته بود — در حالی که دو فیلد مجاورش در خطوط ۱۰۸۶ و ۱۰۸۷ (`esc(e.message)` و `esc(e.deviceInfo)`) escape شده بودند. این **سهو** بود، نه طراحی.

### Files changed
| فایل | تغییر |
|---|---|
| `wholesale-api/public/admin/app.js` | خط ۱۰۸۵ — افزودن `esc()` |
| `wholesale-api/src/app-version/app-version.controller.ts` | افزودن import + تغییر نوع `@Body()` |
| `wholesale-api/src/app-version/dto/log-error.dto.ts` | **فایل جدید** — قرارداد اعتبارسنجی |

### Exact fix
```diff
- '<td><small class="muted">' + (e.userId || 'مهمان') + '</small></td>' +
+ '<td><small class="muted">' + esc(e.userId || 'مهمان') + '</small></td>' +
```
```diff
- async logError(@Body() body: { message: string; stack?: string; deviceInfo?: string; userId?: string }) {
+ async logError(@Body() body: LogErrorDto) {
```

`esc()` در بیرونِ `|| 'مهمان'` قرار گرفت تا fallback فارسی preserved بماند (و آزمون هم این را تأیید کرد).

### Validation status
`CONFIRMED FIXED` — مکانیزم حفاظتی **output encoding** در نقطهٔ ورود داده به کانتکست HTML است، مطابق STEP 12. هیچ blacklist sanitization استفاده نشد.

اعتبارسنجی سمت سرور (لایهٔ دفاعی دوم، نه مکانیزم اصلی):
- `message` `@MaxLength(500)` · `stack` `@MaxLength(10000)` · `deviceInfo` `@MaxLength(300)` · `userId` `@MaxLength(100)`
- سقف `stack` عمداً سخاوتمندانه است تا اطلاعات تشخیصی مشروع رد نشوند (مطابق صریح STEP 13)
- سقف‌ها با الگوی غالب پروژه سازگارند (`@MaxLength` در `update-profile.dto.ts`، `create-category.dto.ts`، `create-product.dto.ts`)
- `message` عمداً `@IsOptional()` ماند تا رفتار فعلی `body.message || 'Unknown Error'` **دقیقاً** حفظ شود

**اثبات اینکه اعتبارسنجی واقعاً اعمال می‌شود (نه بی‌صدا inert):**
`ValidationPipe` تنها وقتی فعال است که `design:paramtypes` به یک **کلاس واقعی** کامپایل شود. بررسی خروجی build:
```
tsconfig.json:22   "emitDecoratorMetadata": true
tsconfig.json:23   "experimentalDecorators": true

dist/.../app-version.controller.js →  design:paramtypes", [log_error_dto_1.LogErrorDto]   ✅ کلاس واقعی
dist/.../orders.controller.js      →  design:paramtypes", [Object, Object]                ⚠️ Object (همان B32)
```
یعنی DTO جدید **قطعاً** در زمان اجرا اثر می‌کند. (مقایسه با `orders` همان B32 را دوباره تأیید می‌کند — که مطابق STEP 21 عمداً دست نخورد.)

### Test result
```
PASS  P0-1  userId = <img src=x onerror=alert(1)>
PASS  P0-1  userId = "><script>alert(1)</script>
PASS  P0-1  userId = ';alert(1);//
PASS  P0-1  userId = <svg/onload=alert(1)>
PASS  P0-1  userId = <iframe src="javascript:alert(1)">
PASS  P0-1  fallback «مهمان» برای userId خالی حفظ شد
```
خروجی نمونه: `<td><small class="muted">&lt;img src=x onerror=alert(1)&gt;</small></td>` → jsdom تأیید کرد **هیچ** المان `img`/`script`/`svg`/`iframe` ساخته نمی‌شود و **هیچ** attribute با `on*` وجود ندارد.

---

## 3. P0-2 — Stored XSS از طریق نام‌های onboarding مشتری

### Root cause
در `orders.js:81-83` یک عبارت ternary وجود دارد که **شاخهٔ مهمان** آن (خط ۸۳) از `esc()` استفاده می‌کرد ولی **شاخهٔ مشتری** (خط ۸۲) نه. این ناهمگونی در یک عبارت واحد، سهو بودن را غیرقابل‌انکار می‌کرد. سمت سرور هم `complete-onboarding.dto.ts:191-199` برای `firstName`/`lastName` فقط `@IsString() @IsNotEmpty() @Length(2,50)` دارد — `@Matches` تنها روی کد ملی (۲۰۳)، تلفن (۲۲۲) و کد پستی (۲۴۸) است. هیچ sanitize سمت سرور روی این فیلدها وجود ندارد.

### Files changed
| فایل | تغییر |
|---|---|
| `wholesale-api/public/admin/orders.js` | خط ۸۲ — افزودن ۳ `esc()` · خط ۱۷۱ — تقویت دفاعی |

### Exact fix
```diff
- ((o.customer?.storeName || '—') + '<br><small class="muted">' + (o.customer?.firstName || '') + ' ' + (o.customer?.lastName || '') + '</small>') :
+ (esc(o.customer?.storeName || '—') + '<br><small class="muted">' + esc(o.customer?.firstName || '') + ' ' + esc(o.customer?.lastName || '') + '</small>') :
```
تعداد `esc()` در خط ۸۲ اکنون **۳** است، در برابر **۲** در شاخهٔ مهمان (خط ۸۳) ⇒ تقارن برقرار شد.

### Validation status
`CONFIRMED FIXED`

### Test result
```
PASS  P0-2  storeName / firstName / lastName = <img src=x onerror=alert(1)>      (۳ آزمون)
PASS  P0-2  storeName / firstName / lastName = "><script>alert(1)</script>       (۳ آزمون)
PASS  P0-2  storeName / firstName / lastName = ';alert(1);//                     (۳ آزمون)
PASS  P0-2  storeName / firstName / lastName = <svg/onload=alert(1)>             (۳ آزمون)
PASS  P0-2  storeName / firstName / lastName = <iframe src="javascript:...">     (۳ آزمون)
PASS  P0-2  customer = {} (بدون فیلد)
```

**رگرسیون (STEP 15) — ۹/۹ PASS:**
```
PASS  نام فارسی                     → «فروشگاه برادران احمدیعلی رضایی»
PASS  نام انگلیسی                   → «Bonko Market StoreJohn Smith»
PASS  فاصله‌های متعدد               → «سوپر مارکت  شهرمریم کریمی»
PASS  علائم نگارشی                  → «فروشگاه آ.ب.پسید م.-رضایی»
PASS  اعداد فارسی                   → «فروشگاه ۱۲۳۴۵۶ ۷۸۹»
PASS  یونیکد/ایموجی                 → «🏪 فروشگاه مرکزی👤 ⭐»
PASS  کاراکترهای HTML-مانندِ مشروع  → «فروشگاه <بزرگ>a&b o'neill»
PASS  رشتهٔ خالی                    → «—»
PASS  null/undefined                → «—»
```
> مورد `فروشگاه <بزرگ>` و `a&b o'neill` حیاتی است: نشان می‌دهد escape **نمایش مشروع را تخریب نمی‌کند**. (چسبیدگی «احمدیعلی» در خروجی به‌دلیل `<br>` است که در `textContent` فاصله نمی‌سازد — رفتار پیشین، بدون تغییر.)

---

## 4. P1-5 — Escape Audit

### شمارش
| سنجه | مقدار |
|---|---|
| **فایل Admin بررسی‌شده** | **۷** — `app.js` (1342) · `core.js` (97) · `orders.js` (473) · `products.js` (448) · `visitor-sales.js` (469) · `index.html` (17) · `styles.css` (981) = **۳٬۸۲۷ خط** |
| **کل سینک‌های HTML کشف‌شده** | **۱۲۷** خط سینک = ۱۲۵ `innerHTML` + ۲ `document.write` → **۱۲۳ جملهٔ سینک** متمایز |
| `outerHTML` / `insertAdjacentHTML` / `createContextualFragment` / `jQuery.html` | **۰** (وجود ندارند) |
| تفکیک `innerHTML` | app.js: 74 · visitor-sales.js: 31 · orders.js: 12 · products.js: 7 · core.js: 1 |
| **سینک‌های امن (دادهٔ ایستا/عدد/سرور)** | بخش عمده — جزئیات پایین |
| **سینک‌های از قبل escape‌شده** | ۱۵۲ فراخوانی escape موجود (۱۰۹ `esc()` + ۴۳ `vsEsc()`) |
| **سینک‌های تازه اصلاح‌شده** | **۳** |
| **سینک‌های مشکوک باقی‌مانده** | **۰ تأییدشده** · ۱ مشاهدهٔ غیرامنیتی |

### روش (مطابق STEP 6 — چند جست‌وجو + بازبینی دستی)
1. **پاس ۱** — استخراج زنجیره‌های الحاقی با پیمایش کاراکتر‌به‌کاراکتر و ردیابی عمق پرانتز → ۲۰۷ عملوند → بازبینی دستی تک‌تک.
2. **بازبینی دستی ناحیه‌ای** روی همهٔ صفحات: داشبورد (۱۹۸-۲۳۴)، مشتریان (۳۳۵-۳۵۶)، دسته‌بندی، بنرها، تیکت‌ها (۷۵۸-۷۸۰)، اعلان‌ها (۸۵۸-۸۷۰)، لاگ امنیتی (۱۱۴۰-۱۲۰۵)، تنظیمات (۱۲۲۵-۱۲۵۰)، ردیف سفارش (۸۸-۱۱۵)، فاکتور کلاینتی (۱۹۵-۲۹۰)، محصولات (۶۵-۱۳۱)، ویزیتور (۱۷۵-۳۴۷).
3. **پاس ۲ مستقل (STEP 19)** — الگوریتم متفاوت: ماسک‌کردن نواحی escape‌شده سپس شکار شناسه‌های مجاور `+` → از ۲۰۷ به **۹** نامزد کاهش، همه دستی طبقه‌بندی شدند.

### تحلیل کانتکست (STEP 10 / 11)
`esc()` برای **کانتکست متن HTML** و **attribute نقل‌قول‌دار** صحیح است. برای **کانتکست URL scheme** و **رشتهٔ JS داخل handler** کافی نیست. سینک‌های این دو کانتکست جداگانه بررسی شدند:

| کانتکست | موارد | نتیجه |
|---|---|---|
| `<img src="...">` | `app.js:505` (`url` از `URL.createObjectURL`) · `products.js:69` (`esc(p.imageUrl)`) · `orders.js:171` (`paymentReceipt`) | امن / امن / **شاخهٔ مرده — تقویت شد** |
| `onclick="fn('ID')"` | `app.js:349,351,353,556,664,768,1084,1155` · `orders.js:103,104,112,113` · `products.js:126,127` · `visitor-sales.js:175,187` | همه `id` هستند و `@id @default(uuid())` ⇒ **تولید سرور، غیرقابل کنترل مهاجم** |
| `<a href>` / `javascript:` / `data:` | جست‌وجوی `href="` و `src="` داینامیک | **مورد کاربردی یافت نشد** |

### سینک‌های مشکوک باقی‌مانده — طبقه‌بندی نهایی

| فایل:خط | منبع داده | سینک/کانتکست | Severity | وضعیت | دلیل |
|---|---|---|---|---|---|
| `orders.js:171` | `o.paymentReceipt` | `<img src="…">` (attribute/URL) | — | **NOT APPLICABLE** | `paymentReceipt` در **کل ریپو فقط همین یک خط** است: در `schema.prisma` نیست، در هیچ فایلی از `src/` نیست، در موبایل نیست ⇒ همیشه `undefined` ⇒ شاخه هرگز اجرا نمی‌شود. **غیرقابل بهره‌برداری.** با این حال `esc()` افزوده شد تا اگر روزی فیلد اضافه شد، تله باقی نماند. |
| `visitor-sales.js:347` | `order.id` | `onclick="vsOpenInvoice(…)"` | — | **LIKELY (غیرامنیتی)** | از نظر امنیتی **امن** (`order.id` یک UUID سمت سرور است). اما برخلاف سایر handlerها که `\\'` دارند، اینجا **quote ندارد** ⇒ به‌احتمال زیاد یک **باگ عملکردی** (JS error) است، نه امنیتی. خارج از scope این فاز ⇒ فقط گزارش شد. |
| `app.js:212` · `app.js:859` | `o.status` · `n.targetStatus` | متن HTML (بدون escape) | — | **SAFE** | enumهای Prisma با مقادیر ثابت سروری؛ در `app.js:212` fallback هم `esc(o.status)` است. |
| `app.js:1236,1241` | `s.MIN_ORDER_AMOUNT` · `s.FREE_SHIPPING_MIN_AMOUNT` | `value="…"` (attribute) | — | **SAFE** | فقط از `POST /admin/settings` با احراز هویت ADMIN قابل نوشتن ⇒ در بدترین حالت self-XSS. |
| `products.js:304` | `e.target.result` | `<img src="…">` | — | **SAFE** | `data:` URL حاصل از `FileReader` روی فایلی که **خودِ ادمین** از file picker انتخاب کرده؛ هرگز ذخیره یا به کاربر دیگری ارسال نمی‌شود. |
| `orders.js:452` | `it.quantity` | متن HTML (بدون escape) | — | **SAFE** | `quantity Int` در `schema.prisma:133,187` ⇒ عدد. |
| `app.js:192,237,262,264` · `orders.js:325,452` | — | — | — | **FALSE POSITIVE** | خودِ target سینک (`progressSection.innerHTML`) یا تابع (`selected.map`) یا عدد (`items.length`) — داده نیستند. |

### یافتهٔ جانبی — نیازمند تأیید مالک
`index.html:17` یک اسکریپت **Cloudflare challenge-platform** (`window.__CF$cv$params={r:'a2b174fa782ae51b',…}` + بارگذاری `/cdn-cgi/challenge-platform/scripts/jsd/main.js`) را **درون سورس commit‌شده** دارد. این beacon مشروع Cloudflare است و مهاجم‌کنترل نیست، ولی حضورش در سورس نشان می‌دهد فایل احتمالاً **پس از تزریق edge** ذخیره شده. **اقدامی انجام نشد** (حذفش می‌تواند یکپارچگی Cloudflare را بشکند) ⇒ `UNVERIFIED` / مالک: **DevOps**.

---

## 5. Security Verification

- [x] **P0-1 fixed** — `app.js:1085` اکنون `esc(e.userId || 'مهمان')`؛ ۶/۶ آزمون PASS
- [x] **P0-2 fixed** — `orders.js:82` اکنون ۳ `esc()`؛ ۱۶/۱۶ آزمون PASS
- [x] **all Admin HTML sinks reviewed** — ۱۲۷ سینک در ۷ فایل، دو پاس مستقل
- [x] **second-pass audit completed** — الگوریتم متفاوت، ۹ نامزد، همه دستی طبقه‌بندی، **۰ XSS جدید**
- [x] **no confirmed XSS remains** — در محدودهٔ `public/admin/`
- [x] **Repeat Order preserved** — `/cart/reorder` (`cart.controller.ts:59-61` → `cart.service.ts:196`) دست‌نخورده؛ `reorderApi` (`ordersApi.ts:103`) و `cart.tsx:28,103,176,179` سالم؛ `checkout.tsx` **بازسازی نشد**
- [x] **B19 preserved** — `generateIdempotencyKey()` :80 · `idempotencyKeyRef` :105 · `if (placing) return` :148 · تولید فقط اگر null :151 · ارسال :159 · پاک‌سازی در موفقیت :162 · تأمین هنگام باز شدن شیت :505 · `disabled={placing}` :602
- [x] **unrelated business logic unchanged** — اثبات md5 پایین

**اثبات عدم تغییر موبایل:** `md5sum -c AUDIT_BASELINE.md5` → **۲۰۱/۲۰۲ OK** و تنها فایل FAILED همان `app-version.controller.ts` است که عمداً تغییر کرد. تعداد فایل‌های موبایلِ تغییریافته: **۰** ⇒ Repeat Order و B19 **بایت‌به‌بایت** دست‌نخورده‌اند.

---

## 6. Verification Commands

| دستور | نتیجه | خروجی |
|---|---|---|
| `npm run build` | ✅ **PASS** | `nest build` — exit 0 |
| `npm test` | ✅ **PASS** | `Test Suites: 7 passed, 7 total` · `Tests: 57 passed, 57 total` |
| `npx prisma validate` | ✅ **PASS** | `The schema at prisma/schema.prisma is valid 🚀` |
| `node xss_test_dom.js` (آزمون XSS با jsdom) | ✅ **PASS** | `payload مهاجم: 21 PASS / 0 FAIL` · `رگرسیون مشروع: 9/9` · exit 0 |
| Mobile build (Metro / EAS) | ⚪ **NOT RUN** | عمداً — مطابق STEP 18 هیچ فایل موبایلی تغییر نکرد (اثبات md5: ۰ فایل)، بنابراین build موبایل برای این تغییر Admin-only لازم نیست. |
| تست HTTP/E2E روی PostgreSQL واقعی | ⚪ **NOT RUN** | دیتابیس در دسترس نبود؛ آزمون XSS در سطح DOM انجام شد که برای این کلاس آسیب‌پذیری معتبر است. |

> ⚠️ **صراحتاً:** سبز بودن ۵۷ تست واحد، **اثبات** نبود XSS در پنل ادمین نیست — پنل ادمین JavaScript خام است و هیچ تستی در Jest ندارد. ادعای «رفع شد» بر پایهٔ آزمون مستقل jsdom روی **کد واقعیِ خوانده‌شده از دیسک** استوار است، نه بر پایهٔ `npm test`.

---

## 7. Files Changed

| # | فایل | چرا تغییر کرد |
|---|---|---|
| 1 | `wholesale-api/public/admin/app.js` | **P0-1** — sink تأییدشده. ۱ خط: افزودن `esc()` |
| 2 | `wholesale-api/public/admin/orders.js` | **P0-2** — sink تأییدشده (خط ۸۲، ۳ `esc()`) + تقویت دفاعی شاخهٔ مردهٔ URL-context (خط ۱۷۱) |
| 3 | `wholesale-api/src/app-version/app-version.controller.ts` | **P0-1 source (STEP 13)** — اتصال DTO برای اعتبارسنجی نوع و سقف طول |
| 4 | `wholesale-api/src/app-version/dto/log-error.dto.ts` | **فایل جدید** — باریک‌ترین قرارداد ممکن؛ برای اعمال DTO لازم بود |

**اثبات مرز تغییرات** (`md5sum -c XSS_BASELINE.md5`، baseline ابتدای همین تسک):
```
app.js                        FAILED  ← تغییر یافته (P0-1)
core.js                       OK      ← دست‌نخورده (esc() صحیح بود، جایگزین نشد)
index.html                    OK      ← دست‌نخورده
orders.js                     FAILED  ← تغییر یافته (P0-2)
products.js                   OK      ← دست‌نخورده
styles.css                    OK      ← دست‌نخورده
visitor-sales.js              OK      ← دست‌نخورده (vsEsc() بازبینی شد، refactor نشد)
app-version.controller.ts     FAILED  ← تغییر یافته (DTO)
```
مجموع diff: **۵ افزودن / ۴ حذف** در ۳ فایل موجود + ۱ فایل جدید. **هیچ تغییر نامرتبطی وجود ندارد** و **هیچ تغییری از کاربر revert نشد**.

---

## 8. Remaining Release Issues

موارد زیر **عمداً در این فاز دست نخوردند** (مطابق STEP 21) و از نتیجهٔ رفع P0 جدا نگه داشته شده‌اند:

| مورد | وضعیت | مالک |
|---|---|---|
| **P1-1** بی‌اثر شدن گارد `/docs` پشت پروکسی | باز — تأیید در deploy | DevOps |
| **P1-2** نگهداری plaintext کد OTP | باز | Developer |
| **P1-3** WSDL ملی‌پیامک روی `http://` | باز — نیازمند تأیید provider | External Provider + Developer |
| **P1-4** JWT ادمین در `localStorage` | باز — **ضریب تشدید هر XSS باقی‌مانده** | Developer |
| **P1-5** ممیزی escape | ✅ **تکمیل شد** — دو پاس، ۱۲۷ سینک، ۰ XSS باقی‌مانده | — |
| `UNVERIFIED` — تحویل واقعی OTP (S5-B) | باز | DevOps |
| `UNVERIFIED` — پیکربندی واقعی nginx + ufw | باز | DevOps |
| `UNVERIFIED` — اسکریپت Cloudflare در `index.html:17` | باز | DevOps |

**تصمیمات پذیرفته‌شده — باز نشدند:** B18 (Shipping = 0) · نبود پرداخت آنلاین · نبود Redis · B20 · B12/B14 · تکرار سفارش.

---

## ⚠️ SECURITY DECISION REQUIRED

**موضوع:** آیا `POST /app/log-error` باید احراز هویت داشته باشد؟

**یافته‌ها (بدون تصمیم‌سازی):**
- تنها فراخوان‌کننده: `wholesale-mobile/src/components/ui/ErrorBoundary.tsx:20`
- این ErrorBoundary خطاهای **رندر** را می‌گیرد — از جمله خطاهایی که **پیش از ورود کاربر** رخ می‌دهند و کاربر در آن لحظه `userId` واقعی ندارد (کلاینت فعلاً `'Anonymous'` می‌فرستد، خط ۲۴)
- افزودن `JwtAuthGuard` ⇒ **گزارش خطای مشروعِ کاربران لاگین‌نکرده از بین می‌رود**
- ThrottlerGuard سراسری (`app.module.ts:73`) همین حالا سقف ۶۰ درخواست/دقیقه/IP روی آن دارد

**چرا تصمیم‌گیری نشد:** این یک **تصمیم محصولی** است (موازنهٔ «پوشش گزارش خطا» در برابر «endpoint عمومی»)، نه یک تصمیم فنی. مطابق STEP 23 و G2 از تصمیم‌سازی پرهیز شد.

**توصیهٔ فنی برای تصمیم‌گیر:** لایهٔ اصلی حفاظت یعنی **output encoding** اکنون برقرار است، بنابراین endpoint عمومی دیگر منجر به XSS نمی‌شود. ریسک باقی‌مانده صرفاً **رشد جدول `error_logs`** است که با `@MaxLength`های افزوده‌شده محدود شده، و در صورت نیاز می‌توان با rate limit سخت‌گیرانه‌تر یا یک توکن امضاشدهٔ سبک (نه احراز هویت کامل کاربر) آن را پوشش داد — بدون از دست دادن گزارش خطای کاربران لاگین‌نکرده.

---

*پایان گزارش فاز ۱.*
