# Release Progress & Audit Reports

## Section 1: Client - Audit Report

### 1. EAS Configuration
- **Status**: `eas.json` is missing.
- **Current `app.json` config**:
  - `package`: `com.company.wholesalemobile`
  - `bundleIdentifier`: `com.company.wholesalemobile`
- **Action**: Need to create `eas.json` with `development`, `preview`, and `production` profiles and update `app.json`.

### 2. Expo Updates
- **Status**: Not installed.
- **Action**: Install `expo-updates` and configure in `app.json` for OTA.

### 3. Force Update Mechanism
- **Status**: No mechanism found in either backend or mobile app.
- **Action**: 
  - Backend: Create an endpoint to return the minimum required version.
  - Mobile: Add a check on app start to compare current version with the minimum required.

---

## Section 1: Client - Implementation Status
- [x] EAS Configuration
- [x] Package ID Update (`com.testcompany.wholesaleapp`)
- [x] Force Update Mechanism
- [x] OTA Configuration (`expo-updates`)

### Implementation Details:
1. **EAS Config**: Created `eas.json` with `development`, `preview`, and `production` profiles.
2. **Package ID**: Updated `app.json` for Android and iOS.
3. **Force Update**:
   - Backend: Created `SystemModule` with `GET /system/version` endpoint.
   - Mobile: Created `useForceUpdate` hook in `src/hooks` and integrated into `_layout.tsx`.
4. **OTA Updates**:
   - Installed `expo-updates` in mobile project.
   - Configured `updates.url` and `runtimeVersion` in `app.json`.
   - Added `expo-updates` to plugins in `app.json`.

---

## Section 2: Backend - Audit Report

### 1. Pagination Audit
| Endpoint | Service Method | Pagination Status |
|---|---|---|
| GET /products | ProductsService.findAll | OK (Default 1, 100) |
| GET /orders | OrdersService.listCustomerOrders | **Missing** |
| GET /orders/admin/all | OrdersService.listAll | OK |
| GET /categories | CategoriesService.findAll | **Missing** |
| GET /notifications | NotificationsService.getMyNotifications | **Partial** (Hardcoded 50) |
| GET /tickets | TicketsService.getMyTickets | **Missing** |
| GET /admin/customers | AdminService.listCustomers | OK |
| GET /admin/otp-attempts | AdminService.listOtpAttempts | OK |
| GET /admin/tickets | AdminService.getAllTickets | OK |
| GET /admin/notifications | AdminService.getAllNotifications | OK |

### 2. IDOR Check
- **Status**: Generally secure. 
- Controllers use `@GetUser()` decorator to extract `userId` and `customer.id` from JWT.
- Services use these IDs in Prisma `where` clauses (e.g., `where: { id: orderId, customerId: customer.id }`).

### 3. Environment & Secrets Audit
- **Environment Variables**: Listed in `.env` and `.env.example`.
- **Hardcoded Secrets**: Found real credentials in `.env` for `MELIPAYAMAK` and `ADMIN_PHONE`.
- **Action**: Clean up `.env` with placeholders.

---

## Section 2: Backend - Implementation Status
- [x] Add Pagination to missing endpoints
- [x] Clean up `.env` secrets
- [x] Implement Scheduled Rotating Backups
- [x] Create RELEASE-CHECKLIST.md

### Implementation Details:
1. **Pagination**:
   - Added `page` and `pageSize` support to `OrdersService.listCustomerOrders`, `CategoriesService.findAll`, `NotificationsService.getMyNotifications`, and `TicketsService.getMyTickets`.
   - Updated respective controllers to accept query parameters.
2. **Security**:
   - Replaced real secrets in `.env` with `<REPLACE_ME_XXX>` placeholders.
   - Verified IDOR protection (all checked endpoints correctly filter by user/customer ID from JWT).
3. **Backup Service**:
   - Installed `@nestjs/schedule`.
   - Created `BackupService` with hourly `pg_dump` and rotation (max 10 files).
   - Configured `BACKUP_DIR` in `.env`.
4. **Documentation**:
   - Created `RELEASE-CHECKLIST.md` for final production steps.

---

## Section 4: QA Audit & Risk Ranking

### Critical Flows Ranking
| Rank | Flow | Risk Level | Description |
| :--- | :--- | :--- | :--- |
| 1 | Authorization & IDOR | **CRITICAL** | User A accessing User B's private data (Orders, KYC, Profile). |
| 2 | Orders & Payments | **CRITICAL** | Price manipulation, stock overselling, server-side calculations. |
| 3 | Authentication & OTP | **HIGH** | OTP bypass, brute-force, rate-limiting, JWT security. |
| 4 | File Upload Security | **HIGH** | Path traversal, unauthorized file access, non-image uploads. |
| 5 | KYC & Atomic State | **HIGH** | Race conditions in status transitions, unauthorized state changes. |
| 6 | Mass Assignment | **MEDIUM** | Injecting unauthorized fields (roles, status) via DTOs. |
| 7 | Profile Change Flow | **MEDIUM** | Bypassing approval logic for sensitive fields. |
| 8 | Pagination & Inputs | **LOW** | Handling of extreme or invalid input values. |

### QA Implementation Table
| Flow | Tests Written | Pass/Fail | Bugs Found |
| :--- | :--- | :--- | :--- |
| Authentication & OTP | | | |
| Authorization & IDOR | | | |
| Mass Assignment | | | |
| KYC Flow | | | |
| Cart & Orders | | | |
| Profile Change Flow | | | |
| File Upload Security | | | |
| Pagination | | | |

---

## Section (Phase) 5-1: Type Safety - Audit Report

### Baseline (before)
- `npx eslint src` (backend): **683 errors + 106 warnings** (all type-safety class)
- `npx tsc --noEmit` (backend): 0 errors
- Rule breakdown: `no-unsafe-member-access` 397, `no-unsafe-assignment` 189, `no-unsafe-argument` 105, `no-unused-vars` 33, `no-unsafe-call` 28, سایر 37
- Root cause: ۴۳ نقطه `@GetUser() user: any` و سرویس‌ها/کنترلرها با پارامترهای `any` که `any` را به‌صورت آبشاری پخش می‌کردند

### Result (after)
- Backend `npx eslint src`: **0 errors, 0 warnings** (exit 0)
- Backend `npx tsc --noEmit`: **0 errors**
- Backend `npm run build` (nest build): **OK**
- Mobile `npx tsc --noEmit`: **0 errors**
- Mobile `npx eslint .`: **0 errors** (148 warnings عمدی — قوانین React Compiler که الگوهای مستند کدبیس را flag می‌کنند؛ به warn تنزل یافتند با مستندات در `eslint.config.js`)

### Latent bugs found & fixed during typing (مهم)
1. **[CRITICAL/IDOR] `visitor-sales.controller.ts`**: کنترلر از `req.user.id` استفاده می‌کرد درحالی‌که JwtStrategy فقط `userId` برمی‌گرداند → در runtime `undefined` بود و فیلتر `placedByUserId` بی‌اثر می‌شد؛ یعنی ویزیتورِ غیرادمین به‌جای سفارش‌های خودش، **همه سفارش‌ها** را می‌دید. رفع شد (`req.user.userId` در ۳ نقطه: dashboard/orders/create).
2. **[MEDIUM] `admin.controller.ts` `replyToTicket`**: پاس از `user.id` (undefined در runtime) به سرویس → رفع به `user.userId`.
3. **[DEV-ONLY] OTP `devCode` auto-fill با setState در effect** — الگوی تعمدی، در mobile eslint به warn تنزل یافت.

### Intentional downgrades (mobile `eslint.config.js`)
قوانین `react-hooks/{set-state-in-effect, refs, immutability, purity, preserve-manual-memoization}` (جدید در eslint-config-expo 56 / React Compiler) با مستندسازی در فایل کانفیگ به `warn` تنزل یافتند؛ چون الگوهای flag‌شده (useRef ضد stale-closure در ProductCard، auto-fill کد dev، idempotency key) تعمدی و مستند هستند و بازسازی‌شان باید در فاز refactor جداگانه انجام شود.

### Known pre-existing issue (خارج از اسکوپ ۵-۱)
- `npx jest`: دو سوئیت (`auth.service.spec`, `auth.controller.spec`) قبل از این فاز هم fail بودند؛ علت: `expo-server-sdk` (ESM-only) در node_modules توسط Jest(CJS) parse نمی‌شود. در baseline کامیت‌گیری و تأیید شد که مربوط به تغییرات این فاز نیست. رفع: `transformIgnorePatterns` در jest config (تصمیم فاز بعد).

### Commit trail
```
45f3278 type GetUser decorator (RequestUser) + admin.controller.ts (194->0)
e660e80 orders.service.ts fully typed (135->0) + fix latent user.id bug
d9be4e8 admin.service + visitor-sales typed; FIX latent req.user.id IDOR bug
8cc3350 products module fully typed (41+11->0)
4e5e5f6 search + notifications modules typed
ee7baed notifications + sentry.filter + admin bodies typed; ~80 remaining
819ef6b COMPLETE (backend): 683 -> 0 errors
```
جزئیات کامل در `PHASE5-1-SUMMARY.md`.

### Verification on user's machine (2026-08-24) — Windows 10/11, Node v24.16.0
پس از رفع ناهمگامی محیط (`package.json`/`package-lock.json` قدیمی روی سیستم کاربر → درخت ۸۴۴ پکیج خراب در برابر ۸۱۳/۸۰۸ سالم) با بسته `phase5-1-env-sync.zip`:
- Backend: `npm ci` (808 pkgs) + `prisma generate` → ESLint **0 problems**, tsc **0 errors**, `nest build` **OK** ✅
- Mobile: `npm ci` (921 pkgs) → `expo lint` → **0 errors, 148 intentional documented warnings** ✅
- درس ثبت‌شده: هر تغییر وابستگی‌ها باید همراه انتقال `package.json`+`package-lock.json` به سیستم کاربر (و ریپو) انجام شود؛ `npm ci` همیشه از لاک‌فایل تأییدشده.
- باقی‌مانده تأیید نهایی: تست دستی دید سفارش‌ها با کاربر visitor (فیکس IDOR `req.user.id`) و push فایل‌های همگام‌شده به GitHub.

---

## Section (Phase) 5-2: Performance — Code-level Only

تاریخ: 2026-08-24 — با تأیید دامنه توسط کاربر: فقط سطح کد (بدون migration/ایندکس/کش/expo-image).

### تحلیل read-only (یافته‌ها)
- ایندکس‌های schema: ۷ `@@index` در ۲۲ مدل (ایندکس‌گذاری موکول به فاز آینده با EXPLAIN روی داده واقعی)
- N+1 در حلقه‌ها: پاک ✅ / داشبورد ادمین: `Promise.all` موازی ✅ / کوئری‌های لیست داخل `$transaction` ✅
- بدون زیرساخت کش — با توضیح کاربر (ترافیک B2B مخصوص افراد خاص) آگاهانه موکول شد
- بک‌اند: selectهای بزرگ‌تر از نیاز در مسیرهای داغ محصول/سفارش | موبایل: هیچ windowing prop در هیچ FlatList

### تغییرات (۹ فایل — همه compiler/lint/build verified)
- Backend `orders.service.ts`: select مشتری به ۳ فیلد مصرفی آدرس محدود شد (کاهش payload هر سفارش؛ قرارداد API بدون تغییر — تأیید با grep مصرف‌کننده موبایل)
- Backend `products.service.ts` (۴ نقطه): نقشه سبد/علاقه‌مندی فقط با `productId/quantity`؛ مسیرهای favorited/favorite فقط با `customer.id`
- Mobile (۷ فایل): افزودن `initialNumToRender`/`maxToRenderPerBatch`/`windowSize={7}`/`removeClippedSubviews` به لیست‌های عمودی داده‌محور (browse grid, cart, orders, notifications, tickets, search×2) — بدون تغییر منطق؛ `getItemLayout` و لیست افقی chips عمداً کنار گذاشته شدند

### نتایج
| چک | نتیجه |
|---|---|
| Backend: eslint / tsc / build | ✅ 0 / 0 / OK |
| Mobile: tsc / lint | ✅ 0 / 0 errors (۱۴۸ warning عمدی، بدون warning جدید) |

جزئیات، موارد موکول‌شده و روش سنجش قبل/بعد در `PERFORMANCE.md`.

### Verification on user's machine (2026-08-24)
- Backend: `npm ci` (808) + prisma generate → eslint **0**، tsc **0**، build **OK** ✅
- Mobile: `npm ci` + `expo lint` → **0 errors / 137 warnings** ✅
- ملاحظه: تعداد warning روی سیستم کاربر ۱۳۷ است درحالی‌که سنندباکس ۱۴۸ گزارش می‌دهد — اختلاف ۱۱ تایی از انحراف جزئی فایل‌های قدیمی محلی (همان drift که در package.json هم دیده شد) است؛ همه warn-level و عمدی، اثر کاربردی ندارد. توصیه: sync کامل سورس یا push به GitHub برای پایان این کلاس مشکلات.

### Sync Audit & Minimal Sync (2026-08-24)
ممیزی فقط‌خواندنی روی سیستم کاربر (ابزار sync-audit — ۲۳۳ فایل، هش SHA-256 نرمال‌شده CRLF/BOM):
MATCH=228, DIFFER=2 (.prettierrc, auth.service.spec.ts), MISSING=3 (app/orders/[id].tsx, app/search.tsx, app/tickets/[id].tsx), EXTRA=0.
- بسته sync-minimal.zip فقط ۴ فایل: ۳ صفحه مفقود موبایل (رفع مسیرهای مرده ناوبری: جزئیات سفارش، جستجو، جزئیات تیکت) + .prettierrc (همگامی رفتار prettier/prettier در ESLint).
- auth.service.spec.ts عمداً کنار گذاشته شد (تغییر محلی احتمالی کاربر؛ طبق اصل حفاظت از کد بدون اثبات نیاز).
- کشف نهفته: app/tickets/[id].tsx در سرِشاخه کپی صفحه جزئیات سفارش است (باگ قدیمیِ محتوای اشتباه) — فیکس واقعی صفحه جزئیات تیکت به فاز بعد موکول شد (endpoint GET /tickets/:id موجود است).


#### دنباله ممیزی — دو اصلاحیه شفافیت
- audit v1.1: رفع false-positive گزارش MISSING برای مسیرهای دارای کروشه (مثل orders/[id].tsx)؛ علت: Test-Path بدون -LiteralPath الگوی wildcard اعمال می‌کرد. نتیجه: ادعای «مسیر مرده ناوبری» برای آن صفحات باطل اعلام شد.
- کشف و اصلاح خطای مسیریابی در زیپ phase5-2: فایل app/search.tsx اشتباهاً در wholesale-mobile\ قرار گرفته بود (به‌جای wholesale-mobile\app\)؛ با sync-minimal اصلاح شد (138→148 = parity کامل). فایل سرگردان wholesale-mobile\search.tsx باید روی سیستم کاربر حذف شود.

### بستن نهایی فاز ممیزی و همگام‌سازی (2026-08-24)
- نتیجه rerun ممیزی v1.1 روی سیستم کاربر: **MATCH=232 / DIFFER=1 / MISSING=0 / EXTRA=0** (۲۳۲ + ۱ = ۲۳۳ فایل مانیفست) ✅
- فایل سرگردان `wholesale-mobile\search.tsx` (باقی‌مانده خطای بسته‌بندی phase5-2) توسط کاربر حذف شد؛ تأیید نهایی: lint موبایل 0 خطا / ۱۴۸ warning = parity کامل با سندباکس.
- تنها DIFFER باقی‌مانده: `wholesale-api/src/auth/auth.service.spec.ts` — **به دستور صریح کاربر فایل‌های تست دست‌نخورده می‌مانند و این انحراف، «مستند و عمدی» تلقی می‌شود نه نقص.**
- نتیجه: سورس محلی کاربر اکنون بایت‌به‌بایت با وضعیت verified (فازهای ۱ تا ۵-۲) یکسان است. فاز sync رسماً بسته شد.

## فاز ۵-۳ — مستندسازی و تجربه توسعه (Documentation & DX)

تحلیلِ قبل از کد (طبق قوانین): swagger با پلاگین `nest-cli.json` انتخاب شد تا **هیچ DTO دست‌نخورده بماند** (تولید خودکار اسکیما)؛ کامنت JSDoc فقط روی دو کنترلر پرترافیک و دو متد حیاتی سرویس.

### تغییرات (۷ فایل ویرایش + ۳ فایل جدید — توجیه هر فایل)
| فایل | چرا لازم بود |
|---|---|
| `wholesale-api/package.json` | dep جدید `@nestjs/swagger@^11.4.7` (سازگار با NestJS 11؛ peer deps تایید شد) + ۴ اسکریپت `db:generate/db:migrate/db:studio/db:seed` |
| `wholesale-api/package-lock.json` | درس رخداد env-sync: package و lock همیشه با هم تحویل می‌شوند |
| `wholesale-api/nest-cli.json` | فعال‌سازی پلاگین `@nestjs/swagger` با `introspectComments` → اسکیمای خودکار DTO بدون تغییر هیچ DTO |
| `wholesale-api/src/main.ts` | تنها نقطه ورود اپ؛ بلاک Swagger UI روی `/docs` (خروجی JSON روی `/docs-json`) + BearerAuth |
| `src/auth/auth.controller.ts` | فقط ۹ کامنت JSDoc (در Swagger UI دیده می‌شود) |
| `src/orders/orders.controller.ts` | فقط ۹ کامنت JSDoc |
| `src/orders/orders.service.ts` | فقط ۲ کامنت JSDoc روی `createFromCart` (تراکنش+قفل موجودی) و `updateStatus` (اثر DELIVERED→PAID و رویداد) |
| `README.md` / `ARCHITECTURE.md` / `CONTRIBUTING.md` | **فایل جدید** — ریسک صفر |

### نتایج راستی‌آزمایی (سندباکس)
| چک | نتیجه |
|---|---|
| eslint / tsc / nest build | ✅ 0 / 0 / OK |
| اجرای پلاگین swagger در build | ✅ `_OPENAPI_METADATA_FACTORY` در خروجی dist تزریق شد |
| موبایل | بدون هیچ تغییری |

### ریسک‌های باقی‌مانده
- `/docs` در production هم قابل‌مشاهده است؛ اگر محرمانگی اسکیما مهم است، با یک شرط `if (process.env.SWAGGER_ENABLED !== 'false')` قابل غیرفعال‌سازی است (تصمیم با کاربر؛ اعمال نشد — اصل حداقلِ تغییر).
- تست عملیاتی `/docs` با بوت واقعی (نیازمند DATABASE_URL) روی سیستم کاربر قابل انجام است.

### سخت‌سازی امنیتی /docs (2026-08-24 — به درخواست کاربر)
- گارد IP اختصاصی در `main.ts` قبل از `SwaggerModule.setup`: دسترسی به `/docs` و `/docs-json` فقط برای اتصال‌های localhost (`127.0.0.1`/`::1`) — بر اساس آدرس TCP واقعی (غیرقابل جعل با هدر Host). پاسخ مسدودها **404** تا وجود صفحه لو نرود.
- اثر: روی سرور هم /docs فقط از داخل خود سرور (یا SSH tunnel: `ssh -L 3000:localhost:3000 user@server`) قابل مشاهده است.
- راستی‌آزمایی سندباکس: npm ci تمیز + prisma generate → eslint 0 / tsc 0 / build OK ✅
- اسناد: ARCHITECTURE.md به‌روز شد. توجه: اگر run-audit.cmd دوباره اجرا شود، فایل‌های فاز ۵-۳ به‌طور طبیعی DIFFER گزارش می‌شوند (مانیفست مربوط به قبل از این فاز است).

### راستی‌آزمایی عملیاتی IDOR ویزیتور (2026-08-30 — روی سیستم کاربر) ✅ PASS
تست کاملاً خودکار (`test-visitor-idor.ps1` — OTP حالت توسعه):
- seed با متغیرهای env جدید `VISITOR1_PHONE/VISITOR2_PHONE` (الگوی ADMIN_PHONE؛ upsert امن) دو ویزیتور ساخت.
- سناریوی ۱ (نقش CUSTOMER): سفارش تستی کاربر۱ در لیست خودش دیده شد، در لیست کاربر۲ **نه** → PASS
- سناریوی ۲ (نقش VISITOR — تغییر نقش در Studio): همان نتیجه → PASS
- **نتیجه نهایی: فیکس IDOR فاز ۵-۱ در عمل تأیید شد؛ جداسازی بین‌کاربری سالم است.**
- ابزار: `test-visitor-idor.ps1` v1.1 (تشخیص خودکار نقش از /auth/me) + `run-visitor-idor-test.cmd` + `README-TEST.md`

## قدم ۳ — پیاده‌سازی صفحه واقعی «جزئیات تیکت» (رفع باگ محتوای اشتباه)
مشکل: `wholesale-mobile/app/tickets/[id].tsx` کپی کامل صفحه جزئیات سفارش بود (تابع OrderDetailScreen، APIهای ordersApi) — تپ روی تیکت در لیست، صفحه‌ای نامرتبط باز می‌کرد. چون ۱۰۰٪ محتوا باگ بود، جایگزینی کامل محتوا = کوچک‌ترین تغییر صحیح (فقط همین ۱ فایل؛ هیچ فایل دیگری دست‌نخورده).
### پیاده‌سازی (هماهنگ با دیزاین‌سیستم موجود)
- چت حبابی: مشتری = حباب آبی راست («شما») / پشتیبانی = حباب سفید چپ — رشته messages مرتب asc از GET /tickets/:id
- بج وضعیت با برچسب/رنگ عیناً مطابق لیست (در انتظار پاسخ/پاسخ داده شده/بسته شده)؛ تاریخ fa-IR
- جعبه پاسخ + ارسال از طریق ticketsApi.replyToTicket موجود (قبلاً بدون مصرف‌کننده بود) — بعد از ارسال ریلود (وضعیت OPEN می‌شود طبق منطق سرور)
- تیکت CLOSED: نوار اطلاع «بسته شده» به‌جای ورودی (جلوگیری از بازشدن ناخواسته)
- GuestGuard/LoadingState/EmptyState، pull-to-refresh، KeyboardAvoidingView (iOS)، اسکرول خودکار به آخرین پیام
### راستی‌آزمایی (سندباکس)
tsc = 0 ✅ | lint = 0 خطا ✅ | warnings: 148 → **142** (۷ warning فایل اشتباه حذف، ۱ warning همکلاس عمدیِ set-state-in-effect — همان الگوی fetch-in-effect همه صفحات — جایگزین شد)

## قدم ۴ — تست‌های Jest: بخش ۱ (زیرساخت ESM) اعمال شد؛ بخش ۲ (specها) در انتظار تصمیم کاربر
### بخش ۱ — زیرساخت (بدون دست‌زدن به هیچ فایل spec) ✅
- ریشه: `expo-server-sdk@6` کاملاً ESM است ("type":"module" + import.meta.url) و تحت Jest-CJS لود نمی‌شد؛ اثبات شد transform (=اولین تلاش، با transformIgnorePatterns) هم به‌خاطر import.meta شکست می‌خورد → آن خط revert شد (قانون: تغییر غیرموثر برمی‌گردد).
- راه‌حل نهایی: **+۱ خط moduleNameMapper در بلاک jest پکیج‌جیسون** → نگاشت به **`test/mocks/expo-server-sdk.mock.ts` (فایل جدید، no-op)** — توجیه انحراف از scope اعلام‌شده: پکیج ESM-only است و هیچ راه صرفاً-کانفیگی وجود ندارد؛ هیچ فایل موجودی تغییر نکرد.
- اثر: کرش ESM برطرف؛ هر ۳ سوئیت «لود و اجرا» می‌شوند؛ prisma.service.spec = PASS؛ eslint(src+test)=0، tsc=0.
### بخش ۲ — نقص از-pیش-موجودِ خود specها (NEEDS USER DECISION)
- کشف: دو spec مربوط به auth از همان شaffold اولیه Nest وابستگی‌های constructor را mock نکرده‌اند (Nest can't resolve... Prisma/Sms/Jwt/Notifications/EventEmitter و AuthService). کرش ESM این نقص را همیشه مخفی نگه داشته بود.
- diff دقیق و اثبات‌شده (در سندباکس اجرا و 3/3 PASS شد و بلافاصله revert گردید): در هر spec چند خط `providers:[{ provide: X, useValue: {} }]` اضافه می‌شود (service=5 mock، controller=1 mock).
- چون کاربر دستور «دست‌نزدن به فایل‌های تستی» را دارد، این بخش تا تایید صریح ایشان **اعمال نشده** و specها دست‌نخورده‌اند.

### بخش ۲ — mockهای DI اسکلت‌های auth (به تأیید صریح کاربر 2026-08-31) ✅
- فقط **افزودنی** (هیچ خطی حذف نشد): در `auth.service.spec.ts` پنج mock provider (PrismaService, SmsService, JwtService, NotificationsService, EventEmitter2) و در `auth.controller.spec.ts` یک mock provider (AuthService) به همراه importهای لازم اضافه شد.
- نتیجه راستی‌آزمایی سندباکس: **Test Suites: 3 passed / Tests: 3 passed** ✅ + eslint(src,test)=0، tsc=0، build OK
- جمع قدم ۴ (دو بخش): moduleNameMapper+mock پکیج ESM (بخش ۱) + mockهای DI (بخش ۲) → Jest از «کرش ESM دائمی» به «سبز کامل» رسید.

## قدم ۵ — بستن موارد موکول‌شده فاز ۵-۲ (تأیید کاربر 2026-08-31) ✅
بر اساس رأی کاربر (گزینه ۱): هر ۴ مورد با همان منطق تحلیل‌شده **بسته** شدند و در `PERFORMANCE.md` بخش «تصمیم‌های نهایی» ثبت گردید: take:500 حفظ با آستانه‌ی بازگشایی >۴۰۰ کالا · ایندکس‌ها موکول به شواهد EXPLAIN · کش کنار گذاشته شد · expo-image فاز مجزای UI. هر مورد «تریگر بازگشایی» مشخص دارد.

## 🗓 فاز زمان‌بندی‌شده — فاز ۶: آماده‌سازی انتشار (Release Readiness)
به درخواست کاربر (2026-08-31): این فاز به تأخیر می‌افتد تا ابتدا موارد/باگ‌های اپلیکیشن برطرف شود؛ **بعداً حتماً برگردیم.**
- ۶-۱ بهداشت وابستگی‌ها: undici → `npm audit fix` (بدون breaking) · sharp → ارتقا محتاطانه به 0.35.x + تست رگرسیون آپلود تصویر (4+4 CVE مؤسس)
- ۶-۲ تست‌های معنادار مسیرهای پولی (ساخت/لغو سفارش — کسر و برگشت اتمیک موجودی)
- ۶-۳ همراهی انتشار: اسکریپت `db:deploy` (prisma migrate deploy) + راهنمای گام‌به‌گام RELEASE-CHECKLIST + ⚠️ **نکته امنیتی باز:** گارد localhost برای /docs پشت reverse proxy (Nginx) بی‌اثر می‌شود — راه‌حل location-block باید در مستندات دیپلوی بیاید.
- ۶-۴ **EAS Update (آپدیت هوایی لایه جاوااسکریپت)** — تاییدشده توسط کاربر ۲۰۲۶-۰۸-۳۱: راه‌اندازی OTA تا تغییرات نمایشی (کارت محصول، متن‌ها، چیدمان، رفع باگ UI) **بدون انتشار مارکت و بدون آپدیت دستی کاربر** برسد. دامنه کار: فعال‌سازی `expo-updates` + ثبت projectId/channel در app.json + اسکریپت‌های update + تست آپدیت آزمایشی. آموزش گام‌به‌گام نحوه انتشار آپدیت هوایی به کاربر **در موعد خودش (فاز ۶)** داده می‌شود. پلن رایگان Expo (۱۰۰۰ MAU/ماه) برای حجم B2B کافی است. محدودیت‌ها: فقط لایه JS (نه نیتیو/SDK/دسترسی‌های جدید).

## ادغام بسته ادمین کاربر (admin.zip از گیت‌هاب) — با تطبیق استاندارد پروژه 2026-08-31
### تحلیل قبل از جایگزینی (طبق قوانین)
- ۱۳ فایل در بسته: ۷ فایل **یکسان** (بدون نیاز به کپی) و ۶ فایل متفاوت — فقط همان ۶ فایل جایگزین شدند.
- ✅ فیکس IDOR فاز ۵-۱ (visitor-sales) در نسخه جدید **حاضر** است · ✅ فیکس replyToTicket(userId) حاضر · ✅ مدل Setting در schema موجود · ✅ همه مسیرهای API مورد استفاده پنل جدید (settings, security/*, otp-attempts, customers/search جدید) در بک‌اند موجودند (رعایت ترتیب تعریف route قبل از customers/:id)
- نسخه جدید = توسعه ادامه‌یافته کاربر روی همان پایه تأییدشده: فاکتور A5 حرفه‌ای (داده از invData + رندر سمت کلاینت با صفحه‌بندی)، جست‌وجوی سریع مشتری برای فروش حضوری (endpoint جدید GET admin/customers/search)، بهبود updateMany شرطی موجودی در visitor-sales + پیام خطای دقیق‌تر.
### تطبیق با استاندارد پروژه (صفر تغییر رفتار/خروجی)
نسخه رسیده با پروفایل lint فاز ۵-۱ سازگار نبود (۵۰ مشکل نوع‌محور پس از فرمت خودکار):
- ۸۳ خطای prettier → `eslint --fix`
- حذف کست‌های `: any` و `as any` (تایپ واقعی Prisma خودش کافی بود؛ از جمله it.itemsPerPackageLabel که در schema هست)
- `String((o as any).note || ... )` → `String(o.note ?? '')` (معادل دقیق: فیلدهای notes/description در Order وجود ندارد)
- حذف ۲ بلوک **مرده** (fld و itemsHtml — باقی‌مانده نسخه SSR قدیمی؛ خروجی فاکتور از invData+کلاینت می‌آید) و به‌تبعِ آن helper بی‌استفاده fmt
### راستی‌آزمایی نهایی
eslint = **0/0** ✅ · tsc = **0** ✅ · build = **OK** ✅ · jest = **3/3** ✅

## جایگزینی کورکورانه بسته ادمین v2 (به دستور صریح کاربر — استثنای یک‌باره) 2026-08-31
- دستور کاربر: «فقط در این پرامپت، بدون قوانین، جایگزینی کامل و بدون تغییر» → اجرا شد: هر ۱۴ فایل زیپ (شامل schema.prisma) **بایت-به-بایت ۱:۱** جایگزین و تأیید شد (14/14).
- **schema.prisma: تنها +۱ خط کامنت** → بدون نیاز به مهاجرت دیتابیس ✅ (و راهنما: کلاینت Prisma بی‌تغییر)
- توجه: تطبیق‌های lint/taping نوبت قبل روی دو فایل (admin.controller.ts، visitor-sales.service.ts) با نسخه خام کاربر رونویسی شد — **به درخواست خود کاربر**.
- وضعیت بعد از جایگذاری (فقط سنجش، بدون هیچ اصلاحی): prisma generate ✅ · tsc=0 ✅ · build=OK ✅ · jest=3/3 ✅ · **eslint قرمز (~۱۳۰ مشکل: ۸۳ فرمتِ قابل-autofix + ~۴۷ نوع‌محور + ۳ هشدار)** — طبق توافق، فیکس آن در نوبت‌های بعدی با قوانین انجام می‌شود.

---

## ✅ فیکس قانون‌مند ESLint بک‌اند (پس از جایگزینی کورکورانه ادمین) — ۱۴۰۴/۰۶/۱۰

**وضعیت قبل:** `npx eslint src` ⇒ ۵۰ مشکل (۴۷ خطا + ۳ هشدار)، همه در `admin.controller.ts`؛ علاوه بر آن ۶۹ مشکل قالب‌بندی prettier در `visitor-sales.service.ts` (قابل auto-fix).

**علت ریشه‌ای:** ۳ عدد cast به `any` که چک تایپ TypeScript را خاموش می‌کرد + ۲ تکه کد مرده (`fld` و `itemsHtml` سراسری — خروجی فاکتور A5 از `invData` و JS سمت کلاینت ساخته می‌شود).

**تغییرات (کوچک‌ترین تغییر امن، منطبق بر دستور کاربر):**

| فایل | تغییر | توجیه |
|---|---|---|
| `src/admin/admin.controller.ts` | ۱) حذف `: any` از مپ جست‌وجوی مشتری (تایپ از `listCustomers` استنباط می‌شود) | رفع ۱۲ مشکل خوشه ۱ |
| | ۲) `o.customer as any` → `o.customer` (کوئری `findUnique` همان فیلدها را include کرده) | رفع خوشه ۲ |
| | ۳) `String((o as any).note \|\| notes \|\| description \|\| '')` → `String(o.note ?? '')` — فیلدهای `notes`/`description` در مدل Order وجود ندارند و `''` هم falsy است ⇒ رفتار زمان اجرا دقیقاً یکسان | رفع ۳ خطای متصل |
| | ۴) حذف کد مرده: `fld` (سراسری) و `itemsHtml` (هیچ‌جا استفاده نمی‌شد — رندر فاکتور با `invData` + `orders.js` است) و در پی آن `fmt` (فقط در `itemsHtml` مصرف داشت) | رفع ۲ خطای `no-unused-vars` + ۵ خطا و ۳ هشدار خوشه ۴ |
| | ۵) حذف `: any` از مپ `invData.items` | رفع ۱۳ مشکل خوشه ۵ |
| | قالب‌بندی prettier (auto-fix) | بدون تغییر رفتار |
| `src/visitor-sales/visitor-sales.service.ts` | **فقط** قالب‌بندی prettier — تأیید شد با `git diff -w`: تنها شکستن ۲ خط بلند، صفر تغییر منطقی | رفع ۶۹ مشکل prettier |

**چیزی که عمداً دست نخورده:** `fld` سمت کلاینت داخل رشته HTML (خط ~۶۰۲)، تابع `fa`، منطق فاکتور/تنظیمات، visitor-sales (منطق)، و هر فایل دیگر.

**Verify (کارگاه):** `eslint src`=۰/۰ ✅ · `tsc --noEmit`=۰ ✅ · `build`=OK ✅ · `jest`=3/3 ✅

**بسته تحویلی:** `eslint-fix-backend.zip`

---

## ✅ باگ ۱: عدم لود تصاویر کارت محصول (home/browse) — ۱۴۰۴/۰۶/۱۰

**علامت (گزارش کاربر):** تصاویر بنر در اپ نمایش داده می‌شدند ولی تصاویر کارت‌های محصول نه؛ تصاویر در پنل ادمین و پوشه uploads سالم بودند؛ Inspect آدرس `http://10.75.109.83:3000/files/...` را نشان داد.

**ریشه:** ناهماهنگی ساخت URL تصویر در اپ — بنرها/دسته‌ها/RowCard از `buildUrl()` (با منطق تشخیص درست: وب→localhost، گوشی→IP/hostUri) استفاده می‌کردند، اما `ProductCard` مستقیم `EXPO_PUBLIC_API_URL` را الصاق می‌کرد (بدون هیچ فال‌بکی؛ اگر env نبود می‌شد `undefined/files/...` ← در بیلد نهایی هم می‌شکست). با تغییر/عدمِ‌دسترس‌بودن آن IP، فقط کارت‌ها می‌شکستند — دقیقاً همان علامت.

**فیکس (کوچک‌ترین تغییر امن):** فقط `wholesale-mobile/src/components/product/ProductCard.tsx` — ۲ خط: ایمپورت `buildUrl` + جایگزینی source تصویر با `buildUrl(product.imageUrl || '')`. صفر تغییر در سایر منطق/استایل کارت.

**Verify (کارگاه):** tsc=0 ✅ · eslint فایل = 0 خطا ✅ (۸ وارنینگ قدیمی خود فایل، دست‌نخورده)

**بسته تحویلی:** `fix-product-card-image.zip`

---

## ✅ باگ ۲: نبود مسیر خروج/هدایت به سبد در صفحه توضیحات محصول — ۱۴۰۴/۰۶/۱۰

**علامت (گزارش کاربر):** در product-detail، بعد از افزودن به سبد، راه واضحی برای خروج یا رفتن به سبد نبود.
**ریشه:** دکمه‌ی برگشت (arrow-forward) وجود داشت ولی «غیرواضح» بود و هیچ ورودی به سبد در هدر نبود؛ در حالی که الگوی استاندارد (browse.tsx) آیکون سبد + بج تعداد دارد.
**تأیید کاربر:** دکمه‌ی واضح خروج در هدر + دکمه‌ی واضح سبد (ترجیحاً با نوشته) در هدر.

**فیکس (فقط ۱ فایل: wholesale-mobile/app/product-detail.tsx):**
1. `totalItems` از useCart خوانده شد (از قبل موجود بود — صفر تغییر منطق سبد)
2. دکمه‌ی سبد در appBarActions: آیکون cart + بج قرمز تعداد (الگوی browse) + **نوشته‌ی «سبد خرید» زیر آیکون** → `router.push('/(tabs)/cart')`
3. backBtn واضح شد: پس‌زمینه دایره‌ای (C.background, radius 22) — در هر ۳ حالت render اعمال می‌شود
4. فقط ۴ استایل کوچک افزوده شد؛ هیچ استایل/منطق دیگری دست نخورده (هیچ فایل دیگری تغییر نکرد؛ هیچ API ایجاد نشد — مسیر cart از قبل در expo-router تعریف‌شده بود)

**Verify (کارگاه):** tsc=0 ✅ · eslint فایل = 0 خطا (۵ وارنینگ قدیمی دست‌نخورده) ✅
**بسته تحویلی:** `fix-product-detail-cart.zip`

---

## ✅ باگ ۳: پاک‌سازی هدر صفحه توضیحات + تصمیم مارکتینگ «صرفه‌جویی» — ۱۴۰۴/۰۶/۱۰

**به درخواست کاربر، در همان فایل wholesale-mobile/app/product-detail.tsx:**
1. **حذف دکمه‌ی اشتراک‌گذاری** → همراه با `handleShare` (کد مرده) و ایمپورت `Share` (از react-native) — جمع‌وجور و قانون‌مند.
2. **نوشته‌ی «علاقه‌مندی» زیر قلب** → با همان الگوی «سبد خرید» (استایل cartBtnText مشترک؛ صفر استایل جدید).

**🟢 تصمیم مارکتینگ: نوشته‌ی «شما N تومان صرفه‌جویی می‌کنید» باقی ماند (حذف نشد).**
علت (به‌عنوان اصول مارکتینگ):
- **عدد ملموس (Price Anchoring):** مغز خریدار عدد را به‌عنوان «سود» می‌پندارد نه فقط قیمت کمتر — اثبات‌شده مبدل خرید.
- **B2B مخصوصاً:** خریدار عمده حسابگرِ حاشیه سود است؛ «صرفه‌جویی» دقیقاً زبان حاشیه سود اوست.
- **مکان صحیح:** بلافاصله زیر قیمت اصلی — در نقطه‌ی تصمیم‌گیری.
- **درگاه اعتماد:** فاکت و غیرفریبنده است (برخلاف شمارش معکوس جعلی/کمیابی دروغین) — برند B2B به اعتبار زنده است.
- ⚠️ توصیه‌ی دلخواه آینده (اجرا نشد — خارج از دامنه): می‌توان بعداً «صرفه‌جویی در این سفارش» = N × تعداد سبد را هم نشان داد؛ ولی نسخه‌ی فعلی از نظر اصول مارکتینگ سالم است.

**Verify (کارگاه):** tsc=0 ✅ · eslint فایل = 0 خطا (۵ وارنینگ قدیمی) ✅
**بسته تحویلی:** `fix-product-detail-cleanup.zip`

---

## ✅ باگ ۴: سبد خرید — فاصله‌گذاری، محاسبه/نمایش تخفیف، متن توضیحات — ۱۴۰۴/۰۶/۱۰

**به درخواست کاربر (+ چک کلی)، فقط ۱ فایل: wholesale-mobile/app/(tabs)/cart.tsx**
1. **گپ تصویر↔متن کالا (۱۲px):** کارت `row-reverse` بود و `marginLeft` به‌اشتباه روی سمتِ بیرونی متن خورده بود — بین عکس و متن عملاً صفر بود. راه‌حل: `gap: 12` روی کارت + حذف margin خاطی. (بدون تغییر هیچ استایل دیگر)
2. **گپ آیکون↔متن روش پرداخت (عیناً ۱۲px):** همان باگ در کارت پرداخت — `gap: 12` روی paymentCard + حذف marginLeft خاطی. **هر دو فاصله دقیقاً برابر شدند.**
3. **تخفیف در «خلاصه سفارش» — ریشه واقعی:** «جمع کالاها» و «مبلغ نهایی» **یک فرمول داشتند** و ردیف تخفیفی وجود نداشت؛ در نتیجه ذهن کاربر «تخفیف محاسبه نشده!» را می‌خواند (رقم نهایی در سرور از قبل درست محاسبه می‌شد — ریسک مالی صفر بود). حالا: جمع کالاها = با قیمت اصلی + **ردیف سبز «تخفیف کالاها»** (فقط وقتی تخفیف هست) + مبلغ نهایی = شِناور قبلی.
4. **متن «توضیحات سفارش (اختیاری)»:** کوچک‌تر (۱۳) + به سمت راست — علت «چپ بودن» این بود که برخلاف کارت آدرس، آیکون+تیتر داخل گروه cardHeaderRight نبودند → همان الگوی کارت آدرس بدون هیچ استایل جدید استفاده شد.
5. **تخفیف در نوار پایین صفحه (نظر مارکتینگ: بله):** خط کوچک سبز «شامل N تومان تخفیف» زیر مبلغ نهایی — خریدار B2B لحظه‌ی پرداخت سودش را می‌بیند. +۱ استایل کوچک.
- وارنینگ `totalItems` (line 82): **قبل از تغییرات موجود بود** — طبق قانون «حفظ بقیه» دست نخورده.

**چک کلی صفحه سبد (گزارش):** مسیر ثبت سفارش، اعتبار آدرس، هشدار موجودی، حالت‌های مهمان/درانتظار/خالی، Performance FlatList فاز ۵-₂ — همگی سالم‌اند. موارد اختیاریِ آینده (فعلاً اجرا نشد): ردیف تخفیف در شیت «تایید نهایی سفارش» نیز قابل افزودن است.

**Verify (کارگاه):** tsc=0 ✅ · eslint فایل = 0 خطا ✅
**بسته تحویلی:** `fix-cart-spacing-discount.zip`

---

## ✅ باگ ۴ (تکمیلی): نمایش تخفیف روی آیتم + شیت تأیید + پاک‌سازی وارنینگ — ۱۴۰۴/۰۶/۱۰

اثر ۴ مرحله‌ای روی همان ۱ فایل (wholesale-mobile/app/(tabs)/cart.tsx):
1. **حذف وارنینگ‌های بلااستفاده (به دستور کاربر):** `totalItems` + `totalPrice` از useCart destructure پاک شدند — هر دو واقعاً هیچ‌جا استفاده نمی‌شدند؛ رفتار صفر تغییر.
2. **قیمت قدیم/جدید آیتم تخفیف‌دار (ریشه‌ی واقعی):** برای آیتم‌های تازه‌اضافه‌شده (قبل از sync سرور)، `p.price` خودِ قیمتِ تخفیف‌خورده بود و شرط `price < originalPrice` یک‌طرفه می‌شد → بدون خط‌خوردگی. ریشه: استفاده‌ی هوشمندانه از `p.oldPrice` (در هر دو مسیر local/server مقدار درست دارد) → حالا آیتم تخفیف‌دار همیشه: **نشان قرمز ٪N + قیمت قدیم خط‌خورده + قیمت جدید** دارد.
3. **تخفیف در شیت «تایید نهایی سفارش» (تصمیم مارکتینگ: افزوده شد).** علت ماندن: شیت تأیید = آخرین لحظه تصمیم‌گیری؛ نمایش «چه قدر پس‌انداز می‌کنید» نیروی Commitment & Consistency را تقویت و احتمال رهاکردن آخرین لحظه را کم می‌کند. فقط دو ردیف شرطی (جمع کالاها + تخفیف) — در نبود تخفیف هیچ به‌هم‌ریختگی اضافه نمی‌شود.
4. استایل‌های جدید: فقط ۲ عدد (itemDiscountBadge/itemDiscountBadgeText) — تعداد تغییرات کوچک.

**Verify (کارگاه):** tsc=0 ✅ · eslint فایل = 0 خطا (۲ وارنینگ بلااستفاده رفع شد؛ ۴ وارنینگ hooks قدیمی دست‌نخورده) ✅
**بسته تحویلی:** `fix-cart-item-discount.zip`

---

## 🟡 باگ ۵: دکمه‌ی «تایید و ثبت نهایی» پاسخ نمی‌دهد — مرحله‌ی ۱ (نمایان‌سازی خطا روی وب) — ۱۴۰۴/۰۶/۱۱

**علامت گزارش‌شده:** کاربر در سبد خرید «ثبت سفارش» را می‌زند، شیت «تایید نهایی سفارش» باز می‌شود، ولی با زدن «تایید و ثبت نهایی» اتفاقی نمی‌افتد و سفارش ثبت نمی‌شود.
**پاسخ‌های کاربر:** شیت بسته می‌شود و به سبد برمی‌گردد بدون خطا/بدون سفارش · پلتفرم = **وب (مرورگر)** · ترمینال سرور هیچ چیزی لاگ نمی‌کند.

**تشخیص (۳ لایه):**
1. **ریشه‌ی قطعی «بی‌صدایی» — اثبات شد از سورس:** در `react-native-web@0.21.0` پیاده‌سازی `Alert` برابر است با `static alert() {}` (تابع خالی!). پس هر `Alert.alert` روی وب **هیچ‌چیز نشان نمی‌دهد** و پیام خطای واقعی سرور/شبکه در catch مربوط به ثبت سفارش برای همیشه بی‌صدا می‌ماند → «دکمه کار نمی‌کند».
2. **ترمینال سرور اثبات‌گر هیچ‌چیز نیست:** NestJS به‌صورت پیش‌فرض هیچ درخواستی (نه موفق، نه 4xx) را لاگ نمی‌کند؛ «سکوت ترمینال» یعنی هیچ.
3. **هدف مرحله‌ی ۱:** نمایان‌سازی همان پیام خطای موجود (بدون حدس‌زدن درباره‌ی ریشه‌ی نهایی) تا در تست بعدی کاربر، **متن واقعی خطا** دیده و گزارش شود؛ ریشه‌ی دقیق (401/400/422/CORS/شبکه) با آن متن مشخص و نسخه‌ی بعدی کامل خواهد شد.

**فیکس (فقط ۱ فایل: wholesale-mobile/app/(tabs)/cart.tsx — حداقلی):**
1. هلپر کوچک `notify(title, message)`: روی وب `(globalThis as any).alert(...)` (پاپ‌آپ مرورگر) و روی موبایل همان `Alert.alert` قدیمی — رفتار موبایل عیناً حفظ شد.
2. فقط **۳ نقطه از آلرت‌های زنجیره‌ی «ثبت سفارش»** به notify تبدیل شدند: خطای catch مربوط به `handlePlaceOrder` + دو پیش‌بازبینی دکمه‌ی «ثبت سفارش» (ناموجود/آدرس).
3. **دامنه محفوظ:** آلرت‌های دیگر فایل (تکرار سفارش، محدودیت موجودی، تأیید حذف/خالی‌کردن سبد) طبق قانون حداقلی‌بودن دست‌نخورده ماندند (نقص «نامرئی روی وب» بر آن‌ها هم صادق است؛ در گزارش به کاربر اعلام شد — تصمیم با خودش).
4. بررسی شد: `clearCart()` در CartContext از قبل catch داخلی دارد و هرگز throw نمی‌کند → ریسک «سفارش ساخته شد ولی خطا گزارش شد» از این مسیر صفر است (تغییری لازم نبود).

**Verify (کارگاه):** tsc=0 ✅ · eslint فایل = 0 خطا (همان ۴ وارنینگ قدیمی، بدون افزایش) ✅
**بسته تحویلی:** `fix-place-order-web-alert.zip`
**وضعیت:** منتظر متن واقعی خطا از تست کاربر → تعیین ریشه‌ی نهایی در مرحله‌ی ۲.

---

## ✅ باگ ۵ — مرحله‌ی ۲ (نهایی): ریشه واقعی = آرگومان نامعتبر Prisma در ثبت سفارش — ۱۴۰۴/۰۶/۱۱

**معطوف به مرحلهٔ ۱:** با نمایان‌سازی خطا روی وب، کاربر دقیقاً چیزی را فرستاد که لازم بود: «خطا در ثبت سفارش» + **متن ERROR ترمینال سرور** که محل و علت دقیق را می‌گفت.

**ریشه (اثبات‌شده):** در `createFromCart` (و هم‌مسیرِ ادمین) روی `tx.product.findMany` آرگومان‌ی به نام `lock: { mode: 'pessimistic_write' }` پاس می‌شد — چنین آرگومانی **در Prisma 5.22 وجود ندارد** و کلاینت آن را با `PrismaClientValidationError: Unknown argument 'lock'` رد می‌کند ⇒ هر «ثبت سفارش» = HTTP 500. کامنت اشتباه بالای کلاس («در runtime معتبر است») + cast به `Prisma.ProductFindManyArgs` باعث شده بود tsc هم ساکت بماند.
**چرا دیر گرفته شد (گزارش صادقانه):** سه دیده‌بان هر سه ناتوان بودند: ① tsc با cast خاموش شد ② eslint به اعتبار معنایی کوئری کاری ندارد ③ **هیچ تستی مسیر createFromCart را نداشت** (۳/۳ سبز مربوط به specهای auth/prisma بود) — دقیقاً همان چیزی که فاز ۶-۲ «تست مسیرهای پولی» برایش در نقشه راه است. و ④ لایهٔ «نامرئی بودن خطا روی وب» (باگ react-native-web) چشم کاربر را هم کور کرده بود.

**فیکس (فقط ۱ فایل: wholesale-api/src/orders/orders.service.ts — حداقلی):**
1. حذف `lock` + cast از **هر دو** محل — دوم (ثبت سفارش ادمین) همان سرنوشت مرگ را داشت (توجیه فایل اضافه: همان فایل، همان الگو).
2. امنیت رقابتی بدون قفل: همان آپدیت شرطیِ ازپیش‌موجود `where: { id, stock: { gte: qty } }` (الگوی اتمیکِ موردِ قانونِ CLAUDE.md) کافی است — SQLِ حاصل `UPDATE ... WHERE stock >= qty` ذاتاً اتمیک است.
3. سخت‌سازی توجیه‌شده: catch باریکِ `P2025` دور همان آپدیت → تبدیل به خطای کسب‌وکاری طراحی‌شده (مشتری: 422 STOCK_UNAVAILABLE / ادمین: «موجودی ... کافی نیست») تا در رقابت خرید همزمان به‌جای ۵۰۰ اسرارآمیز، پاسخ درست برگردد. (ایمپورت جدید صفر — Prisma از قبل ایمپورت بود.)
4. کامنت گمراه‌کننده به شرح واقعیت بازنویسی شد (علت باگ همین ادعای غلط بود).

**Verify (کارگاه — این‌بار با دیتابیس واقعی):** PostgreSQL 17 محلی بالا آمد، ۱۶ مایگریشن اعمال و سناریوی کامل با `PrismaClient` واقعی اجرا شد:
- خطای قدیمی دقیقاً بازتولید شد: `PrismaClientValidationError: Unknown argument 'lock'` ✔
- `createFromCart` واقعی: سفارش ساخته شد، قیمت‌گذاری درست (۲×۱۰٬۰۰۰)، موجودی اتمیک ۵→۳، سبد سرور پاک ✔
- کمبود موجودی → HTTP **422** (نه ۵۰۰) ✔ · مسیر ادمین: سفارش CONFIRMED + موجودی ۳→۲ ✔ · داده‌های تست پاک شد ✔
- tsc=0 ✔ · eslint فایل=۰ خطا ✔ · jest=۳/۳ ✔ (اسکریپت‌های verify موقت حذف شدند — فقط نتیجه‌اش در این گزارش ماند)
**بسته تحویلی:** `fix-order-place-backend.zip`
**وضعیت:** حل‌شده — در انتظار تأیید نهایی کاربر روی وب (و سفارش از پنل ادمین).

---

## ✅ بهبود مکمل (به انتخاب کاربر): زنده‌شدن ۵ قابلیتِ مُرده روی وب — ۱۴۰۴/۰۶/۱۱

**زمینه:** ممیزی کامل `Alert.alert` در موبایل (~۵۵ نقطه در ~۱۹ فایل) نشان داد دو دسته: پیام‌های ساده (روی وب بی‌صدا ولی غیرکشنده) و **تأییدهای دارای دکمه** که قابلیت واقعی را روی وب نابود می‌کردند: ① حذف کالا از سبد ② خالی‌کردن سبد ③ خروج از حساب ④ لغو سفارش ⑤ برگشت بعد از ثبت تیکت.
ممیزی مکمل بک‌اند: الگوی ساکت‌کنندهٔ کامپایلر (`as Prisma.*` و `@ts-ignore/@ts-expect-error`) = **صفر مورد**؛ دو `as unknown` موجود بی‌خطر است (تایپ SOAP پیامک + guard احراز هویت) ⇒ باگ ۵ آخرین لانهٔ آن الگو بود.
**تصمیم کاربر:** اسکوپ محدود — فقط زنده‌کردن همان ۵ قابلیت (فیکس سراسری برای بعد می‌ماند).

**پیاده‌سازی (۵ فایل: ۱ جدید + ۴ ویرایش):**
1. **جدید: `src/utils/notify.ts`** — جایگزین سازگار با همه پلتفرم‌ها برای Alert.alert.
   روی موبایل: دقیقاً همان Alert.alert (تغییر رفتار نیتیو = صفر). روی وب: پیام ساده ← alert مرورگر؛ «انصراف+عمل» ← confirm مرورگر (OK = همان عمل)؛ «تک‌دکمه» ← نمایش پیام + اجرای همان کال‌بک (ناوبری تیکت حفظ شد)؛ «بیش از یک عمل» ← فقط نمایش پیام (fallback امن، اجرای تصادفی هرگز).
2. `app/(tabs)/cart.tsx` — حذف آیتم در qty=1 و خالی‌کردن سبد به notify وصل شدند (+ تک‌خطیِ بقیهٔ آلرت‌های همان فایل برای یکدستی: محدودیت موجودی و خطای تکرار سفارش؛ توجیه: تبدیلِ عیناً یک‌خطی، ریسک صفر؛ هلپر محلیِ مرحلهٔ ۱ باگ ۵ حذف و به نسخهٔ مشترک ارجاع شد — تک‌منبع‌بودن حفظ شد).
3. `app/(tabs)/profile.tsx` — تأیید خروج از حساب + ۳ پیام تکرار سفارش.
4. `app/orders/[id].tsx` — تأیید لغو سفارش + ۲ پیام خطای همان مسیر.
5. `app/tickets/new.tsx` — پیام خطای فرم + موفقیتِ دارای ناوبری + خطای ارسال.
   در هر ۴ فایل: ایمپورت Alert حذف شد (بدون کاربرد باقی نماند — وارنینگ جدیدی نیامد). وابستگی/پکیج جدید: صفر.

**دامنهٔ محفوظ:** سایر فایل‌ها (login، otp، edit-address، checkout، onboarding، home، product-detail، ProductCard، ImageUploadField و…) که فقط «پیام ساده» دارند و قابلیتی نمی‌کشند، طبق انتخاب کاربر دست‌نخورده ماندند؛ هر وقت خواست، پاس سراسری با همین notify در یک نوبت قابل انجام است.

**Verify (کارگاه):** tsc=0 ✅ · eslint: ۰ خطا — وارنینگ‌ها دقیقاً همان‌های قبلی‌اند (cart=۴، profile=۸، orders/[id]=۳، tickets=۰، notify=۰؛ هیچ وارنینگ جدیدی اضافه نشد) ✅
**بسته تحویلی:** `fix-web-dead-features.zip`

---

## ✅ یکپارچه‌سازی سراسری پیام‌ها (به درخواست کاربر): سازگار با وب/اندروید/iOS — ۱۴۰۴/۰۶/۱۱

**زمینه:** کاربر تأیید کرد تست‌های وبِ فیکس‌های قبلی سبز است و درخواست کرد: ① اطمینان از بی‌ضرربودن تغییرات برای اندروید ② فیکس سراسری بقیه پیام‌های ساده ③ بررسی/اصلاح موارد اشاره‌نشده.

**پاسخ سازگاری نیتیو (تحلیل کد، نه حدس):** ۱) فیکس بک‌اند باگ ۵ کاملاً سرورمحور است (orders.service) — کلاً به پلتفرم کلاینت کاری ندارد. ۲) `notify` روی نیتیو دقیقاً همان `Alert.alert` را با همان آرگومان‌ها صدا می‌زند (شعبه `Platform.OS !== 'web'`؛ حتی آرگومان چهارم options هم پاس‌thرو می‌شود) → رفتار اندروید/iOS بایت‌به‌بایت حفظ است. ۳) پکیج/فایل نیتیو/مجوز جدید: صفر. ۴) شکار APIهای پلتفرم‌خاص (ToastAndroid/ActionSheetIOS/DatePickerAndroid/…): صفر مورد در کل پروژه.

**تغییرات (۱۵ فایل — ۱ آپدیت + ۱۴ تبدیل مکانیکی):**
- `src/utils/notify.ts` — افزوده شدن پارامتر چهارم `options?: AlertOptions` (پاس‌thرو به نیتیو؛ وب نادیده می‌گیرد) تا جایگزینی ۱:۱ با امضای Alert.alert کامل شود.
- تبدیل **هر ۴۳ نقطهٔ `Alert.alert` باقی‌مانده** به `notify` در ۱۴ فایل: login، otp، edit-address، home، checkout، edit-profile، notifications، onboarding، product-detail، tickets/[id]، ImageUploadField، ProductCard، SearchEmpty، useForceUpdate. روش: تعویض نام تابع (هرجا در پروژه Alert فقط برای alert به‌کار رفته — اثبات با grep) + حذف Alert از ایمپورت‌ها + افزودن ایمپورت notify. کد دست‌ساز قبلیِ چند فایل (شعب Platform + window.confirm/alert در ProductCard و edit-profile) از نظر رفتار معادل حفظ شد و حالا مسیر نیتیو نیز از همان notify می‌گذرد.
- **ملاک پایان:** پس از تغییر، `Alert.alert` در کل app+src فقط در «یک» فایل است: `src/utils/notify.ts` (تک‌منبع حقیقت).

**یافته‌های اشاره‌نشده (بررسی شد — گزارش‌فقط، بدون تغییر بی‌اجازه):**
- دکمهٔ «درخواست این محصول از پشتیبانی» (SearchEmpty) فقط پیام «درخواست شما ثبت شد» نشان می‌دهد و هیچ APIای صدا نمی‌زند — رفتار به‌عنوان نوشتهٔ وعدهٔ بیراست است؛ تغییرش به API واقعی تصمیمِ محصول/دامنه خواست (فعلاً فقط به notify تبدیل شد).
- نگرانیِ payload تکراری landlinePhone در onboarding: بررسی شد — بک‌اند (auth.service:347) رشتهٔ خالی را null می‌کند ⇒ بی‌خطر است؛ تغییری نداده شد.
- ایمپورت‌های مردهٔ Alert در `app/search.tsx` و `ProductRowCard.tsx` (از قبل موجود؛ بی‌ارتباط به این کار) — طبق قانون «وارنینگ‌های قدیمی دست‌نخورده» باقی ماندند؛ پاک‌سازی‌شان در فرصت کاربر.

**Verify (کارگاه):** tsc=0 ✅ · eslint کل app+src: **۰ خطا** (۱۴۰ وارنینگ — همه از دستهٔ ازپیش‌موجود؛ هیچ وارنینگ جدید از این تغییرات متولد نشد؛ دو وارنینگ Alert×unused مربوط به همان دو فایلِ لمس‌نشدهٔ قدیمی است) ✅ · هر ۱۵ فایل: ایمپورت notify حتماً استفاده‌شده ✅
**بسته تحویلی:** `fix-web-alerts-global.zip`
**وضعیت:** پیام‌های اپ روی هر سه پلتفرم از یک مسیر واحد می‌گذرند؛ نیتیو تغییررفتار صفر، وب کامل زنده.

---

## ✅ ویژگی ۶: تجربه‌ی مهمان — کارت بدون قیمت + سه تب (طراحی به عهده‌ی ما) — ۱۴۰۴/۰۶/۱۱

**درخواست کاربر:** مهمان کارت محصول را ببیند ولی قیمت/جزئیات را نه + پیام دعوت ورود (طراحی/رفتار به تشخیص ما)؛ تب‌ها برای مهمان فقط ۳ عدد (خانه/دسته‌بندی/پروفایل) و برای کاربر واردشده همه‌ی تب‌ها.

**ممیزی پیش از اجرا (یافتهٔ مهم):** بیشترِ گیتِ قیمت از قبل وجود داشت — کارت ردیفی (ProductRowCard) و صفحه‌ی جزئیات (product-detail) قیمت را از مهمان/درانتظار پنهان می‌کنند (باکس قفل + لینک ورود). تنها ناهماهنگی‌ها: ۱) تب‌ها برای همه نمایش داده می‌شدند ۲) کارت گرید (ProductCard) به مهمان دکمه‌ای با متنِ اشتباه «در انتظار تایید» نشان می‌داد (برچسب حالت Pending بود، نه مهمان).

**تغییرات (فقط ۲ فایل — حداقلی):**
1. `app/(tabs)/_layout.tsx` — مخفی‌سازی شرطی تب‌ها با الگوی بومی expo-router: `href: isGuest ? null : undefined` روی cart و orders؛ مهمان → ۳ تب، هر حساب واردشده (تأییدشده/درانتظار) → هر ۵ تب ← تصمیم طراحی: «واردشده اما درانتظار» صاحب حساب است و صفحه‌های سبد/سفارش وضعیتش را خودشان توضیح می‌دهند؛ اگر نظر شما «فقط تأییدشده‌ها ۵ تب» است، یک خط تغییر کافی است). متغیر بی‌استفاده‌ی isLoggedIn هم از همان خط جدا شد (وارنینگ صفرمانی برای خطی که خودمان دست زدیم).
2. `src/components/product/ProductCard.tsx` — جداسازی وضوح سه حالت در بخش اکشن کارت: مهمان ← دکمه‌ی برجسته‌ی آبی «🔒 ورود / ثبت‌نام» (استایل جدید guestLoginBtn، هم‌رنگ CTA اصلی، تپ = همان دیالوگ راهنمای ورودِ موجود؛ صفر منطق جدید) — درانتظار ← «در انتظار تایید حساب» — ردشده ← «احراز هویت مجدد». ناحیه‌ی قیمت برای مهمان همان «ورود برای مشاهده قیمت» می‌ماند (هماهنگ با کارت ردیفی). ۲ استایل کوچک جدید (+۰ وابستگی).

**تصمیم‌های طراحیِ گرفته‌شده (گزارش شفاف برای تأیید/اصلاح شما):**
- بج «تخفیف» روی کارت مهمان **ماند** (نمایش قیمت نه، ولی چاشنی کنجکاوی: «این کالا معامله دارد — بیا وارد شو» = انگیزهٔ ثبت‌نام؛ اگر خواستید حذفش کنم یک خط است).
- نام کالا، تصویر، واحد بسته‌بندی: **باقی** (دادهٔ غیرحساس که مهمان را به کاتالوگ علاقه‌مند می‌کند). موجودی عددی: از قبل فقط برای خریدار تأییدشده بود — دست نخورده.
- صداقت امنیتی: پنهان‌سازی روی لایه‌ی نمایش است (سرور قیمت را در پاسخ API می‌فرستد؛ بازرس شبکه می‌تواند ببیند) — این دقیقاً همان چیزی است که درخواست دادید؛ اگر روزی حریم سخت‌گیرانه لازم شد، جداسازی قیمت سمت سرور کار جداگانه‌ای است.

**Verify (کارگاه):** tsc=0 ✅ · eslint: ۰ خطا — _layout پاک شد (۰ وارنینگ)، ProductCard فقط ۸ وارنینگ react-hooks/refs ازپیش‌موجود (بدون افزایش) ✅
**بسته تحویلی:** `fix-guest-experience.zip`

---

## ✅ باگ ۷: «در حالت مهمان اصلاً کارتی نمایش داده نمی‌شود» (خانه + دسته‌بندی) — ۱۴۰۴/۰۶/۱۱

**علامت گزارش‌شده کاربر:** در حالت مهمان هیچ کارت محصولی در هیچ‌کدام از دو صفحه دیده نمی‌شود (برخلاف انتظارِ «کارت بدون قیمت»).
**ریشه (اثبات‌شده روی کد):** گیت قیمتی UI از قبل سالم بود (بسته‌ی قبلی)، ولی **خودِ endpoint محصولات پشت قفل بود:** `GET /products` و `GET /products/:id` در ProductsController زیر `@UseGuards(JwtAuthGuard)` بودند ⇒ مهمان ۴۰۱ ⇒ لیست خالی ⇒ «هیچ کارتی». بنرها/دسته‌بندی‌ها عمومی بودند؛ به همین دلیل فقط کارت‌ها غایب بودند.
نکته‌ی معماری: سرویس از قبل برای `userId?:` طراحی شده بود (همه‌جا `if (userId)` سر favorite‌ها) و الگوی رسمی پروژه `OptionalJwtAuthGuard` موجود و در search.controller استفاده‌شده بود — یعنی قصدِ معماری «مرور عمومی با شخصی‌سازی اختیاری» بود و گارد سخت فقط مانده‌ی ناسازگار بود.

**فیکس (فقط ۱ فایل: wholesale-api/src/products/products.controller.ts — ۵ خط خالص):**
- `JwtAuthGuard` → `OptionalJwtAuthGuard` فقط روی دو endpoint خواندنی (findAll + findOne). هر مسیر دیگر دست‌نخورده: favorites/toggleFavorite همچنان JWT لازم دارند؛ admin همچنان JWT+Roles.
- امنیت حفظ‌شده (اثبات): مهمان فقط محصولات فعال را می‌بیند (onlyActive برای غیرادمین)، محصول غیرفعال برای غیرادمین همچنان ۴۰۴، و برای سرویس userId=undefined یعنی هوFavorite=false.

**Verify (کارگاه با PostgreSQL ۱۷ واقعی + سرور واقعی NestJS):**
- مهمان بدون توکن: `GET /products` ← **HTTP 200** با دقیقاً کالاهای فعال (کالای غیرفعالِ تستی دیده نشد) ✔
- مهمان بدون توکن: `GET /products/:id` ← **HTTP 200** جزئیات کامل ✔
- رگرسیون: `GET /products/favorites` بدون توکن ← **همچنان HTTP 401** ✔
- tsc=0 ✔ · eslint فایل=۰ ✔ · jest=۳/۳ ✔
**بسته تحویلی:** `fix-guest-products-public.zip`
**وضعیت:** مهمان حالا هم تب‌های درست را دارد، هم کارت‌های بدون‌قیمت را — هر دو لایه (UI از زیپ قبلی + API در این زیپ) کامل شد.

---

# 🚀 فاز ۶ — آغاز رسمی (به درخواست کاربر 2026-09-02)

## قدم ۶-۱ — بهداشت وابستگی‌ها (Dependency Hygiene) ✅

### تحلیل upstream/downstream (قبل از هر تغییر)
- **اثر روی کاربر:** هیچ فایل سورسی تغییر نکرد؛ فقط ۴ فایل: هر دو `package.json` و هر دو `package-lock.json`. به‌همین دلیل رعایت گام `npm ci` روی سیستم کاربر الزامی است.
- **اثر روی نقش‌های B2B / ایزولیشن tenant:** هیچ — لایه کسب‌وکار دست‌نخورده.
- **اثر iOS/Android/Web:** نسخه‌های native ماژول‌ها (image-picker, screens, updates...) با SDK 56 تراز شد → ساخت نیتیو بعدی (EAS) قابل‌پیش‌بینی‌تر.
- **اثر تراکنش PostgreSQL:** هیچ.

### بک‌اند (wholesale-api) — آسیب‌پذیری: ۸ high → **۰ (صفر)** 🎯
| بسته | قبل | بعد | نوع |
|---|---|---|---|
| `sharp` (مستقیم) | 0.34.x (۴ CVE مؤسس libvips: CVE-2026-33327/33328/35590/35591) | **0.35.4** | ارتقای major **برنامه‌ریزی‌شده در نقشه راه** |
| `@nestjs/platform-express` + `multer` | آسیب‌پذیر (DoS آپلود) | patched در رنج فعلی | غیر-major خودکار |
| `undici`, `brace-expansion`, `browserslist`, `fast-uri`, `js-yaml` | آسیب‌پذیر | patched | transitive — `npm audit fix` |

توضیح اعتمادبه‌نفس ارتقای major sharp: سازوکار graceful-degradation وجود دارد (اگر sharp شکست بخورد، تصویر با اندازه اصلی ذخیره می‌شود — down کامل محصول ناممکن است). بااینحال تست رگرسیون واقعی هم انجام شد (پایین).

### موبایل (wholesale-mobile) — آسیب‌پذیری: ۲۸ → ۲۰ (همه ۲۰ باقی‌مانده = ابزار بیلدنه‌دهنده و FPهای نسخه، **بدون ریسک روی گوشی کاربر**)
اعمال‌شده:
- `npm audit fix` (۱۲ مورد transitive: nanoid, postcss, shell-quote, brace-expansion, js-yaml, fast-uri, undici...)
- **تراز SDK 56** برای: `expo-dev-client→56.0.26`، `expo-image→56.0.12`، `expo-notifications→56.0.25`، `expo-updates→56.0.26` (زمینه ۶-۴ OTA)، `expo-web-browser→56.0.6`، `react-native-screens→~4.26.0`
- **اصلاح عدم‌تراز واقعی:** `expo-image-picker` از ^57.0.2 (یک major بالاتر از SDK!) → `~56.0.25` (استفاده ما: `launchImageLibraryAsync` + `MediaTypeOptions` — در هر دو نسخه موجود؛ اما نسخه نیتیوِ نامتناسب، ساخت EAS را ریسکی می‌کرد)
- `@sentry/react-native` → `~7.11.0` (نسخه موردانتظار رسمی SDK 56). **چرا داونگرید امن است:** در کد، Sentry با `enabled: !__DEV__` همیشه در محیط توسعه/تست کاربر خاموش بوده و DSN هم ست نشده؛ استفاده = init/wrap/ErrorBoundary/reactNavigationIntegration که همگی در ۷.۱۱ موجودند. گیت بهداشت `expo install --check` حالا **کاملاً سبز** است.

ردشده (با مستندات — قانون «رد ‌breaking تصادفی»):
- پیشنهادهای absurd خود npm: داونگرید `expo→46`، `expo-router→5`، `expo-splash-screen→55` (FP ناشی از نسخه‌های canary) — اعمال آن‌ها کل اپ را می‌شکست.
- زنجیره `metro/metro-config/metro-transform-worker` + `image-size` (4 high): **دقیقاً پین‌شده توسط react-native 0.85.3** — فقط با ارتقای RN/SDK قابل رفع است. اثر: فقط ابزار باندل روی سیستم توسعه، نه باندل خروجی.
- `@expo/ngrok` (فاقد فیکس؛ ابزار tunnel محلی — فقط dev)
- ساید-افکت `expo install --fix`: سه پلاگین به `app.json` اضافه کرد (`@sentry/react-native`, `expo-image`, `expo-web-browser`) → **بازگردانده شد** (app.json بایت‌به‌بایت دست‌نخورده)؛ اگر روزی سورس‌مپ Sentry روی EAS خواستیم، آگاهانه و با مستندات اضافه می‌کنیم.

### تأیید در سندباکس (شواهد)
- بک‌اند: `npm audit` = **found 0 vulnerabilities** ✔ · `nest build` ✔ · eslint کل پروژه = ۰ خطا ✔ · jest = ۳/۳ ✔
- **تست رگرسیون واقعی آپلود (خواست صریح نقشه راه):** PostgreSQL 17 واقعی + migrate deploy + سرور واقعی Nest روی :3001:
  - PNG بزرگ 2000×1200 با توکن ADMIN به `POST /files/product` ← **201**؛ ذخیره‌شده روی دیسک: **jpeg ،600×360 ،9KB** (تبدیل+ریسایز+فشرده‌سازی sharp جدید مؤثر) ✔
  - JPG کوچک 100×100 به `POST /files/kyc` ← **201**، بدون بزرگنمایی، فرمت jpeg ✔
  - بدون توکن ← **401** ✔ (گارد رگرس نشد)
- موبایل: `tsc --noEmit` ✔ · expo lint = ۰ خطا / ۱۳۹ اخطار (قبلاً ۱۴۰ بود — یک کمتر به‌خاطر نوسان ابزار lint؛ سورس دست‌نخورده) ✔
- **تست باندل واقعی:** `npx expo export --platform web` → خروجی کامل همه روت‌ها (۱۴۶۴ ماژول) با پشته وابستگی جدید ✔ (در جریان تست، کمبود از‌قبل‌موجود `assets/fonts` و `assets/images` در کپی گیت سندباکس — که روی سیستم کاربر به‌صورت untracked موجود است — با فایل‌های موقت پُر و بعد پاک شد؛ **ریسک انتشار: ❌ ندارد**، چون فایل‌های روح‌المشترک روی ماشین کاربر هستند. ✅ نکته برای آینده: آن پوشه assets را track کنیم.)

### نحوه اعمال روی سیستم کاربر (الزامی)
جایگزینی ۴ فایل و سپس در هر دو پوشه `npm ci` (نه npm install) تا node_modules دقیقاً با لاک‌فایل جدید ساخته شود. sharp 0.35 باینری ازپیش‌ساخته ویندوز را خودش دانلود می‌کند (نیاز به اینترنت).

**بسته تحویلی:** `phase6-1-dependencies.zip`
**موارد بعدی فاز ۶:** ۶-۲ تست‌های مسیر پولی (ساخت/لغو سفارش) → ۶-۳ همراهی انتشار (db:deploy + چک‌لیست + نکته امنیتی /docs پشت Nginx) → ۶-۴ EAS Update OTA (+ آموزش گام‌به‌گام).

## قدم ۶-۲ — تست‌های معنادار مسیرهای پولی ✅ (+ یک رگرسیون واقعی پیدا و فیکس شد)

### تحلیل upstream/downstream
سه مسیر پولی scope شدند: ① `createFromCart` ② `cancelOrder` (برگشت اتمیک موجودی) ③ `createAdminOrder`. روش: تست واحد با دابل درون‌حافظه‌ای «باوفا» (معناشناسی واقعی Prisma: آپدیت شرطی موفق/ناموفق با P2025 واقعیِ پرتابی، شبیه‌سازی مسابقه خرید همزمان) → `npm test` همیشه بدون دیتابیس اجرا می‌شود (CI-friendly). اثر روی رفتار محصول: **فقط ۱ فیکس** در cancelOrder (پایین)؛ بقیه سورس دست‌نخورده.

### 🐞 یافته جدید حین نوشتن تست (اثبات‌شده روی PostgreSQL واقعی)
لغو سفارش غیر-PENDING: کد با `if (!updated)` خطای «قابل لغو نیست» می‌خواست، اما Prisma روی آپدیت شرطی ناموفق **null نمی‌دهد — P2025 پرتاب می‌کند** (اثبات با اسکریپت مستقیم روی PG: `THROWN PrismaClientKnownRequestError code: P2025` و سفارش دست‌نخورده). نتیجه قبلی: **۵۰۰ خام**؛ چک `!updated` کد مرده بود — خواهرخوانده باگ ۵.
**فیکس (همان الگوی اثبات‌شده):** catch باریک P2025 → همان متن فارسی طراحی‌شده `این سفارش قابل لغو نیست یا قبلاً لغو شده است` (BadRequest). صفر تغییر در متن/قرارداد با کلاینت؛ صفر تغییر در مسیر موفق.

### تست‌ها: ۱۴ سناریوی جدید (مجموع سوییت: ۱۸/۱۸ سبز)
- خرید: جمع مبالغ/تخفیف خطی/برچسب بسته‌بندی · کسر اتمیک · پاک شدن سبد · رکورد وضعیت · رویداد نوتيف · سبد خالی CART_EMPTY · مشتری تاییدنشده · کالای غیرفعال 422 · کمبود موجودی با available_stock · **مسابقه همزمان→422 بدون oversell** (قفل رفتار باگ ۵) · emit خراب non-blocking
- لغو: موفق (برگشت موجودی+رویداد) · مالکیت دیگر · **غیر-PENDING→۴۰۰ تمیز (تست قفل فیکس)** · idempotency لغو مجدد · id ناموجود
- ادمین: مهمان موفق (CONFIRMED/ADMIN/بدون رویداد کاربری) · کمبود موجودی Forbidden · بدون مشتری/مهمان BadRequest

### تأییدها
- jest: **۱۸/۱۸** ✔ · eslint کل پروژه (src+test): **۰ خطا/۰ هشدار** (spec کاملاً تایپ‌شده بدون `any`) ✔ · build ✔
- **اثبات سرتاسری با PrismaService و OrdersService واقعی روی PostgreSQL ۱۷** (بدون موک):
  - لغو PENDING → CANCELLED + موجودی ۷→۹ برگشت + emit رویداد ✔
  - لغو مجدد → **HTTP 400 فارسی** + موجودی ثابت ✔
  - لغو CONFIRMED → **HTTP 400 فارسی** (قبلاً ۵۰۰) + موجودی/سفارش دست‌نخورده ✔
- اسکریپت‌های موقت تست بعد از اثبات حذف شدند.

### نحوه اعمال
۲ فایل: `src/orders/orders.service.ts` (جایگزین) + `src/orders/orders.service.spec.ts` (جدید). بعد از کپی: `npm test` باید **18 passed** بدهد (بدون نیاز به دیتابیس). اجرای عادی: `npm run start:dev` و تست دستی لغو سفارش.

**بسته تحویلی:** `phase6-2-money-tests.zip`
**مرحله بعد:** ۶-۳ همراهی انتشار (اسکریپت db:deploy + تکمیل RELEASE-CHECKLIST + ⚠️ مستند نکته امنیتی گارد localhost برای /docs پشت Nginx) → ۶-۴ EAS Update OTA.

## قدم ۶-۳ — همراهی انتشار (Deploy Companion) ✅

### تحلیل upstream/downstream
scope: ۱) اسکریپت امن مهاجرت پروداکشن ۲) تکمیل راهنمای گام‌به‌گام RELEASE-CHECKLIST ۳) مستندسازی راه‌حل نکته امنیتی باز فاز ۵-۳ (/docs پشت Nginx).
اثر روی رفتار محصول: **صفر خط تغییر در سورس** — فقط +۱ خط اسکریپت در package.json + مستندات. گارد /docs داخلی (فاز ۵-۳) دست‌نخورده و به‌مثابه دفاع در عمق برای دسترسی مستقیم به پورت ۳۰۰۰ می‌ماند.

### انجام‌شده
1. **اسکریپت `db:deploy`** (`prisma migrate deploy`) — راه امن رسمی پروداکشن؛ جایگزین `migrate dev` که ریسک حذف داده دارد.
2. **RELEASE-CHECKLIST.md**: ترتیب بخش‌ها اصلاح (۴/۵/۶) + بخش «۴» با نکته ماندگاری uploads تکمیل + **بخش ۶ کامل: استقرار گام‌به‌گام Ubuntu** (پیش‌نیازها، ساخت DB کاربر اختصاصی، npm ci، env پروداکشن، db:deploy، build، اجرا با systemd/pm2، نمونه کانفیگ Nginx، HTTPS با certbot، تست سلامت ۷گانه، رویه ری‌دیپلوی).
3. **⚠️ نکته امنیتی /docs پشت reverse proxy** حل و مستند شد با مکانیسم دقیق: گارد داخلی آدرس TCP (`req.socket.remoteAddress`) را چک می‌کند و پشت Nginx همیشه 127.0.0.1 را می‌بیند → در کانفیگ Nginx، بلاک‌های `location = /docs`, `location /docs/`, `location = /docs-json` با `return 404` **قبل از** `proxy_pass` آورده شد (+تونل SSH برای دسترسی امن خود ادمین + توصیه UFW برای بستن پورت ۳۰۰۰ به بیرون).

### تأییدها
- **شبیه‌سازی واقعی استقرار:** ساخت دیتابیس تازه `wholesale_deploy_test` → `npm run db:deploy` ← «Applying migration ...×۱۶ → Database schema is up to date!» ✔ (دقیقاً سناریوی روز اول سرور پروداکشن)
- رگرسیون: jest **۱۸/۱۸** ✔ · eslint کل پروژه **۰/۰** ✔ · build ✔ · اعتبار JSON package.json ✔

**بسته تحویلی:** `phase6-3-deploy-companion.zip`
**مرحله بعد (پایانی):** ۶-۴ EAS Update OTA — فعال‌سازی آپدیت هوایی لایه JS + آموزش گام‌به‌گام فارسی انتشار آپدیت.

## قدم ۶-۴ — EAS Update (آپدیت هوایی OTA) ✅ → 🏁 فاز ۶ کامل شد

### تحلیل upstream/downstream
- اثر روی کد اپ: **صفر خط** — تنها پیکربندی. کشف تحلیل: `app.json` از قبل آماده بود (`expo-updates` در plugins + `runtimeVersion: appVersion` + `updates.url` با placeholder شناسه پروژه) → دامنه تغییرات به حداقل رسید.
- امنیت نسخه‌ها: سیاست runtimeVersion=appVersion یعنی آپدیت هوایی فقط روی بیلد سازگار سوار می‌شود؛ بیلدهای قدیمی/جدید با هم تداخل نمی‌گیرند (پیش‌فرض امن).
- iOS/Android: کانال‌ها معماری مستقل از پلتفرم دارند — همان config برای هر دو کار می‌کند.
- اثر روی وب: هیچ — expo-updates مختص بیلدهای نصبی است؛ `npm run web` همان باندل تازه را سرو می‌کند.
- مرز دانش (شفاف): بخش‌های حساب‌محور (eas login/init + نوشتن projectId واقعی + اولین بیلد ابری) اجباراً باید با اکانت کاربر روی سیستم خودش انجام شود — در آموزش، گام‌به‌گام پوشش داده شد.

### انجام‌شده (+ توجیه هر فایل طبق قانون)
1. `wholesale-mobile/eas.json` (+۲ خط): `channel: preview` برای پروفایل preview و `channel: production` برای production — بدون این، بیلدها به هیچ شاخه آپدیتی گوش نمی‌دهند و OTA عمل نمی‌کند.
2. `wholesale-mobile/package.json` (+۲ اسکریپت): `npm run update` (شاخه production) و `update:preview` (تست امن) — با پاس دادن پیام: `npm run update -- "متن"`.
3. `OTA-GUIDE.md` (جدید، فارسی، مربی‌محور EL10): مفهوم با استعاره رستوران/منو · جدول «چه چیزی هوایی می‌رسد/چه چیزی بیلد می‌خواهد» · راه‌اندازی یک‌باره در ۵ قدم دقیق (ثبت‌نام Expo → eas login → eas init → eas update:configure → بیلد preview → تست طلایی با بستن/بازکردن اپ) · چک‌لیست سلامت · روال روزانه تک‌دستوری · عیب‌یابی · نکات پلن رایگان/rollback.
4. `app.json` دست‌نخورده ماند: projectId واقعی توسط دستور مخصوص خود کاربر (`eas init` + `eas update:configure`) نوشته می‌شود — کلید حساب کاربر را به‌جای او حدس نمی‌زنیم.

### تأییدها
- اعتبار JSON هر سه فایل پیکربندی ✔ · اسکریپت‌های npm خوانا و صحیح (`eas update --branch … --message`) ✔
- تراز expo-updates 56.0.26 (در ۶-۱ هم‌تراز شد) آماده سرو OTA ✔
- اجرای واقعی OTA، ذاتاً نیازمند اکانت Expo و بیلد نصبی است → به‌عنوان «تست طلایی قدم ۵» در آموزش برای اجرای کاربر مستند شد.

**بسته تحویلی:** `phase6-4-eas-ota.zip`
### 🏁 پایان فاز ۶ (آماده‌سازی انتشار)
۶-۱ وابستگی‌ها (آسیب‌پذیری بک‌اند صفر) · ۶-۲ تست‌های مسیر پولی (۱۴ تست + فیکس لغو سفارش) · ۶-۳ دفترچه عملیات دیپلوی + نکته امنیتی /docs · ۶-۴ OTA. ✅

### روند اجرای راه‌اندازی OTA توسط کاربر (۲۰۲۶-۰۹-۰۲)
- ✅ نصب سراسری `eas-cli` و ورود `eas login` (حساب ali4344)
- ✅ `eas init` → ساخت پروژه `@ali4344/wholesale-mobile` و لینک projectId=`96505df4-dc51-4773-9607-51e351d23b4c` (app.json به‌روز شد)
- ⚠️ هشدار بی‌اثر: «Failed to set the project icon ... 403» — فقط آیکن نمایشی داشبورد expo.dev است؛ روی بیلد/آپدیت اثری ندارد (ریشه محتمل: محدودیت شبکه؛ قابل تنظیم دستی در داشبورد)
- ⏳ باقی: `eas update:configure` → `eas build --profile preview` → تست طلایی
