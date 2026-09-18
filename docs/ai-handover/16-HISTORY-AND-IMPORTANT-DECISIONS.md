# 16 — HISTORY AND IMPORTANT DECISIONS

> **منبع:** `git log` روی ریپازیتوری داخلی پروژه (`/home/user/project/src/.git`)
> — **۵۹ کامیت**، از `4b8a847` تا `b861e71`.
>
> این فایل «چرا»ی تصمیم‌ها را نگه می‌دارد تا AI بعدی آن‌ها را تصادفی خراب نکند.

---

## 1. خط زمانی فازها

`CONFIRMED` از ترتیب کامیت‌ها:

```
Phase 4  ← 4b8a847 «Baseline: workspace state after Phase 4»
             683 خطای ESLint، 0 خطای TS

Phase 5-1 ← b039a4a … db31e37   (۹ کامیت)
             تایپ‌کردن کل بک‌اند: 683 → 0 خطای ESLint
             + رفع باگ‌های نهفته

Phase 5-2 ← dc90862, 4d48c1e
             بهینه‌سازی کارایی: Prisma select باریک + FlatList windowing

Phase 5-3 ← 8933347 … 5676121   (۵ کامیت)
             OpenAPI/Swagger + محدودکردن /docs به localhost

Phase 6-1 ← f11b7f8
             بهداشت وابستگی‌ها: ۸ آسیب‌پذیری API → ۰

Phase 6-2 ← 7b72446
             تست مسیر پول (۱۴ case) + رفع P2025 در لغو سفارش

Phase 6-3 ← 020d603
             اسکریپت db:deploy + runbook دیپلوی Ubuntu/Nginx

Phase 6-4 ← 5fee68a, 6f306fc, b861e71
             EAS Update OTA — «Phase 6 COMPLETE»
```

⚠️ `CONFIRMED` **بین Phase 5-3 و Phase 6-1 یک «bug epic» بزرگ هست**
(کامیت‌های `0361984` تا `619a78b`) که در پیام‌های کامیت با عنوان «Bug5» و
«ALL-FIXES-final» آمده.

---

## 2. تصمیم‌های مهم — به تفکیک موضوع

### ۲-۱. 🔴 حذف آرگومان `lock` از Prisma (مهم‌ترین تصمیم فنی)

`CONFIRMED` کامیت `2ec4761`:
> «Bug5 final: remove invalid Prisma 'lock' arg from order creation (customer+admin),
> P2025->business-error mapping, fix misleading comment; **verified on real PostgreSQL17**»

**تصمیم:** به‌جای `SELECT ... FOR UPDATE`، از **update شرطی** استفاده شود:
```ts
await tx.product.update({
  where: { id, stock: { gte: quantity } },
  data:  { stock: { decrement: quantity } },
});
```

**چرا:** Prisma از `lock` / `pessimistic_write` در `findMany` پشتیبانی نمی‌کند.
کامنت گمراه‌کنندهٔ قبلی هم اصلاح شد.

✅ **روی PostgreSQL 17 واقعی verify شده.**

> 🔒 **این تصمیم را «بهبود» ندهید.** کامنت صریح در `orders.service.ts:34-40` هست.

⚠️ `CONFIRMED` **دو الگوی متفاوت در کد وجود دارد:**
| متد | الگو | تشخیص |
|---|---|---|
| `orders.service.createFromCart:355` | `tx.product.update(...)` + catch `P2025` | استثنا |
| `visitor-sales.service.createVisitorOrder:196` | `tx.product.updateMany(...)` + `res.count === 0` | شمارش |

`INFERRED` الگوی دوم تمیزتر است (بدون try/catch). ولی هر دو درست کار می‌کنند.

### ۲-۲. 🔴 رفع IDOR در visitor-sales

`CONFIRMED` کامیت `a707702`:
> «phase5-1: admin.service + visitor-sales typed; **FIX latent req.user.id IDOR bug
> (visitor orders leak)**»

`CONFIRMED` کامیت `9a47173`: «automated visitor IDOR verification script (dev-mode OTP)»
`CONFIRMED` کامیت `21ab245`: «visitor IDOR runtime verification **PASS**»

🔴 **اما:** `CONFIRMED` در کد **فعلی**، `visitor-sales.controller.ts` هنوز
**هیچ `RolesGuard` ندارد** و `createVisitorOrder` نقش فراخوان را چک نمی‌کند.

> **تفسیر:** باگ IDOR اصلی استفاده از `req.user.id` (که `undefined` است چون
> `RequestUser` فیلد `userId` دارد نه `id`) بود — آن رفع شده.
> ولی **نبود `RolesGuard` یک مسئلهٔ جداست که باز مانده.**
> → `15-SECURITY.md` §S3

### ۲-۳. ✅ مرور مهمان (Guest browsing) — عمدی

`CONFIRMED` کامیت `0979443`:
> «fix(api): guest browsing - **optional JWT** on public product read endpoints
> (list/detail); **verified guest 200 vs favorites 401 on real server**»

`CONFIRMED` کامیت `ebc4450`:
> «feat(mobile): guest experience - **hide cart/orders tabs for guests**,
> guest-design CTA on grid ProductCard (login instead of wrong pending label)»

**تصمیم:** مهمان می‌تواند محصولات را ببیند (بدون قیمت) ولی نه سبد خرید/سفارش‌ها.

✅ `OptionalJwtAuthGuard` **عمدی است**. حذفش نکنید.

🔴 **ولی** این تصمیم شامل «حذف فیلد `price` از پاسخ» **نبوده** → `15-SECURITY.md` §S7.

✅ **تصمیم نهایی (P1):** مالک پروژه گزینهٔ «پنهان‌سازی قیمت سمت API» را انتخاب کرد.
`OptionalJwtAuthGuard` **سر جایش ماند** (مهمان همچنان محصولات را می‌بیند)، ولی
فیلدهای قیمت برای مهمان و مشتری تاییدنشده `null` ارسال می‌شوند.
قاعده: `ADMIN || customer.status === 'APPROVED'`.

### ۲-۴. ✅ تست‌های مسیر پول

`CONFIRMED` کامیت `7b72446`:
> «Phase 6-2: **money-path tests (14 cases w/ faithful in-memory Prisma:
> atomic stock, race, idempotency)** + proven cancel-order P2025->400 fix
> (was raw 500 on non-PENDING cancel; **verified end-to-end vs real PG**:
> pending cancel restores stock, re-cancel & confirmed-cancel clean 400, stocks exact);
> eslint 0/0, **jest 18/18**»

**نتیجه‌های مهم:**
- ✅ لغو سفارش از وضعیت غیر-`PENDING` قبلاً **500 خام** می‌داد → الان **400** می‌دهد
- ✅ لغو سفارش `PENDING` موجودی را برمی‌گرداند
- ✅ لغو مجدد → 400 تمیز

⚠️ `CONFIRMED` **`jest 18/18`** — این تأیید می‌کند که ادعای «Jest 3/3» در
مستندات قدیمی **منسوخ** است (درست در زمان کامیت `b9797ae` بود، نه الان).

### ۲-۵. ✅ Migrationها روی DB واقعی verify شده‌اند

`CONFIRMED` کامیت `020d603`:
> «Phase 6-3: deploy companion - db:deploy script (**verified on fresh DB: all 16
> migrations**), full step-by-step Ubuntu/Nginx runbook in RELEASE-CHECKLIST»

`CONFIRMED` کامیت `f11b7f8`: «verified **real PG** upload regression (resize+convert)
& **full web bundle export**»

> ✅ **پس ۱۶ migration روی یک DB تازه کار می‌کنند** — توسعه‌دهنده verify کرده.
> ⚠️ **ولی من در این محیط نتوانستم verify کنم** (نه docker، نه root).
> → `10-DATABASE.md` §6

`CONFIRMED` این همچنین تأیید می‌کند که **`wholesale-mobile/assets/` روی ماشین
توسعه‌دهنده وجود داشته** (چون `expo export` با موفقیت اجرا شده) ولی هرگز commit نشده.

### ۲-۶. ✅ `/docs` پشت reverse proxy — مسئلهٔ شناخته‌شده

`CONFIRMED` کامیت `020d603`:
> «**/docs-behind-reverse-proxy security gap solved via nginx 404 blocks**
> (localhost guard by design fails behind proxy)»

✅ **این مسئله از قبل شناخته و حل شده** — با block در nginx، نه در کد.

> ⚠️ `CONFIRMED` راه‌حل در `RELEASE-CHECKLIST.md` بوده که **در این snapshot نیست**.
> اگر دیپلوی می‌کنید، آن فایل را با `git show HEAD:RELEASE-CHECKLIST.md` بازیابی کنید.

### ۲-۷. ✅ `notify` — یکپارچه‌سازی Alert

`CONFIRMED` کامیت `e65c2be`:
> «feat(mobile): shared notify util - **revive 5 web-dead features**
> (cart delete/clear, logout, order cancel, ticket nav); scoped per user decision»

`CONFIRMED` کامیت `a1c7dea`:
> «feat(mobile): global alert sweep - **all 43 Alert.alert sites** now route through
> cross-platform notify; **web fully live, native behavior byte-identical**»

**تصمیم:** `Alert.alert` در وب کار نمی‌کند → همه به `src/utils/notify.ts` منتقل شدند.

> 🔒 **اگر `Alert.alert` جدیدی اضافه می‌کنید، از `notify` استفاده کنید.**

### ۲-۸. ✅ اصلاح ESM در Jest

`CONFIRMED` کامیت `56e3df5`:
> «test(jest): **fix ESM infra via manual mock for expo-server-sdk**
> (step 4 part 1; spec DI mocks pending user decision)»

**نتیجه:** `test/mocks/expo-server-sdk.mock.ts` + `moduleNameMapper` در `package.json`.

> 🔒 **آن فایل mock و `moduleNameMapper` را حذف نکنید** — تست‌ها می‌شکنند.

`CONFIRMED` کامیت `b9797ae`: «test(auth): add DI provider mocks to scaffold specs
(step 4 part 2, **approved**) — **jest 3/3 green**»

⚠️ این منشأ ادعای «Jest 3/3» در مستندات قدیمی است — **در آن زمان درست بود.**

### ۲-۹. ⚠️ جایگزینی کورکورانهٔ ۱۴ فایل

`CONFIRMED` کامیت `9b293fb`:
> «chore(admin): **blind 1:1 replacement of 14 files per explicit one-time user
> request** (schema=+1 comment only; **lint regression expected, fix scheduled next**)»

`CONFIRMED` کامیت بعدی `0f76be9`:
> «fix(admin): lawful eslint fix - remove any casts & dead code in
> invoice-print/customerSearch + prettier visitor-sales»

> **درس:** کاربر گاهی صریحاً جایگزینی کورکورانه می‌خواهد. در آن حالت
> **رگرسیون lint انتظار می‌رود** و در کامیت بعدی رفع می‌شود.

### ۲-۱۰. ✅ بهداشت وابستگی‌ها

`CONFIRMED` کامیت `f11b7f8`:
> «Phase 6-1: dependency hygiene - **API vulns 8->0** (sharp 0.35.4 planned major
> + safe audit fixes), mobile SDK-56 alignment (image-picker 57->56, updates 56.0.26,
> sentry 7.11 SDK-expected); ... **released-absurd major downgrades rejected**,
> metro-chain pinned by RN documented»

**تصمیم‌ها:**
- `sharp` به `0.35.4` (major) ارتقا یافت
- `expo-image-picker` از ۵۷ به **۵۶ downgrade** شد (هم‌ترازی با SDK 56)
- downgradeهای غیرمنطقی `npm audit` **رد شدند**
- زنجیرهٔ metro با RN pin شده

⚠️ `CONFIRMED` **استثنا:** `expo-build-properties@^57.0.17` در تغییرات
commit‌نشده اضافه شده — **هم‌تراز نیست.** `UNVERIFIED` آیا کار می‌کند.

### ۲-۱۱. ✅ تجربهٔ کاربری محصول

`CONFIRMED` مجموعهٔ کامیت‌های UI (تصمیم‌های بازاریابی):
| کامیت | تغییر |
|---|---|
| `f3ee855` | حذف دکمهٔ share؛ افزودن برچسب «favorites» زیر قلب؛ **نگه‌داشتن متن صرفه‌جویی** (بازاریابی) |
| `a425293` | دکمهٔ خالی‌کردن سبد + دکمهٔ بازگشت نمایان در product-detail |
| `36e149d` | فاصلهٔ ۱۲px در سبد + ردیف تخفیف در خلاصهٔ سفارش |
| `a67d1ff` | badge تخفیف + قیمت قدیم/جدید برای هر آیتم سبد |
| `5f316eb` | استفاده از `buildUrl` برای تصویر `ProductCard` (یکپارچه با banner/rowcard) |

> 🔒 **«متن صرفه‌جویی» عمدی است** — یک تصمیم بازاریابی، نه کد اضافه.

### ۲-۱۲. ✅ صفحهٔ جزئیات تیکت

`CONFIRMED` کامیت `664c478`:
> «fix(mobile): **implement real ticket detail chat screen** (step 3) —
> **was order-screen copy**»

> ⚠️ یعنی `tickets/[id].tsx` قبلاً یک کپی از صفحهٔ سفارش بود. الان درست است.

### ۲-۱۳. ⚠️ عقب‌اندازی‌های آگاهانه

`CONFIRMED` کامیت `3f12639`:
> «docs(perf): finalize **step-5 deferred-item decisions with reopen triggers** (approved)»

`CONFIRMED` کامیت `1f368f9`: «docs: add 6-4 EAS Update (OTA) to **deferred** Phase 6»

> یعنی لیستی از کارهای **آگاهانه عقب‌افتاده** وجود داشته، با «شرط بازگشایی».
> آن سند (`PERFORMANCE.md`) در این snapshot نیست.

### ۲-۱۴. ⚠️ بسته‌های apply (زیپ)

`CONFIRMED` الگوی تکرارشونده در تاریخچه:
```
93aeae1  deliverable: phase5-1-changes.zip (43 files + README-APPLY)
c94024c  deliverable: phase5-1-env-sync.zip
a3d4b67  deliverable: workspace-full-sync.zip
df558a2  deliverable: sync-audit kit (read-only audit first, per Minimal&Scoped rules);
                      withdraw blanket full-sync zip
f242714  deliverable: sync-minimal.zip (4 justified files from audit)
32a1c48  pack: consolidated ALL-FIXES-final.zip (21 files) to remove multi-zip confusion
3e5a7cb  chore(phase5-3): add apply-package (zip) + README-APPLY
```

**تکامل مهم:**
1. اول زیپ‌های بزرگ «همه‌چیز» ساخته می‌شد
2. `df558a2` → **زیپ blanket پس گرفته شد** و جای آن «sync-audit kit فقط‌خواندنی» آمد
3. `f242714` → فقط ۴ فایل توجیه‌شده
4. `32a1c48` → یکپارچه‌سازی برای رفع سردرگمی

> 🔒 **این یک قانون کار با این کاربر است:** تغییرات باید **Minimal & Scoped** باشند.
> بستهٔ بزرگ «همه‌چیز» نسازید.

---

## 3. ⚠️ اشتباهات ثبت‌شده در تاریخچه (درس‌ها)

| کامیت | اشتباه |
|---|---|
| `6e24e4d` | «strip trailing backslash/quote from Root path (**cmd %~dp0 quoting bug**)» |
| `f06d045` | «fix(sync-audit v1.1): -LiteralPath for bracket paths; docs on **phase5-2 search.tsx path mistake**» |
| `6f306fc` | «fix eas CLI invocation: **npx eas fails** - package name is `eas-cli`, npm resolves unrelated `eas` pkg» |
| `b861e71` | «benign 403 icon note» |

> 📌 **`npx eas` کار نمی‌کند.** باید `npm i -g eas-cli` و بعد `eas`.

---

## 4. 📋 «قوانین Minimal & Scoped»

`CONFIRMED` در پیام کامیت `df558a2` صریحاً به «**Minimal&Scoped rules**» ارجاع شده.

`INFERRED` این قوانین در `CLAUDE.md` بوده که **در این snapshot نیست**.
بازیابی:
```bash
cd /home/user/project/src && git show HEAD:CLAUDE.md
```

از شواهد تاریخچه، این قوانین شامل:
1. **اول audit فقط‌خواندنی**، بعد تغییر
2. **کمترین فایل ممکن** — هر تغییر باید توجیه شود
3. **بدون بازنویسی کامل فایل**
4. **بستن رگرسیون lint در کامیت بعدی** اگر اجتناب‌ناپذیر بود
5. **verify روی ماشین کاربر** قبل از اعلام اتمام

---

## 5. تغییرات commit‌نشده (کار نیمه‌تمام)

`CONFIRMED` از `git status` در `src/`:

| فایل | تغییر |
|---|---|
| `app/_layout.tsx` | `SafeAreaProvider`/`SafeAreaView` + `<StatusBar style="dark" />` + `initialRouteName="(tabs)"` |
| `app/(tabs)/home.tsx` | `SafeAreaView` → `View` (رفع double-inset)؛ دسته‌بندی‌ها از scroll افقی به گرید `3×2` |
| `app/(tabs)/browse.tsx` | `SafeAreaView` از `react-native` → `react-native-safe-area-context` |
| `app/(tabs)/orders.tsx` | همان |
| `app.json` | EAS projectId، `androidStatusBar`، پلاگین `expo-build-properties` |
| `package.json` | افزودن `expo-build-properties@^57.0.17` |
| `tsconfig.json` | افزودن `"jsx": "react-native"` |
| `.env` | تغییر IP |
| `package-lock.json` | همگام با `package.json` |

⚠️ **این‌ها را revert نکنید.**

---

## 6. فایل‌های حذف‌شده از snapshot

`CONFIRMED` ۶۴ فایل در HEAD هستند ولی روی دیسک نیستند. مهم‌ترین‌ها:

```
README.md · ARCHITECTURE.md · CLAUDE.md · CONTRIBUTING.md
RELEASE-PROGRESS.md · RELEASE-CHECKLIST.md · OTA-GUIDE.md
PERFORMANCE.md · WSL2-LOCAL-BUILD.md · PHASE5-1-SUMMARY.md
run-*.cmd · test-*.ps1 · test-*.sh   ⚠️ eas.json در این فهرست نیست — هرگز گم نشده بود
apply-package*.zip · ALL-FIXES-final.zip · verified-manifest.txt
```

### بازیابی
```bash
cd /home/user/project/src
git show HEAD:RELEASE-CHECKLIST.md     # runbook دیپلوی
git show HEAD:CLAUDE.md                # قوانین Minimal&Scoped
git show HEAD:eas.json                 # کانال‌های OTA
git show HEAD:PERFORMANCE.md           # تصمیم‌های عقب‌افتاده
```

---

## 7. جدول «چرا» برای تصمیم‌های غیربدیهی

| تصمیم | چرا | کامیت |
|---|---|---|
| update شرطی به‌جای قفل DB | Prisma پشتیبانی نمی‌کند | `2ec4761` |
| `OptionalJwtAuthGuard` روی `/products` | مرور مهمان | `0979443` |
| پنهان‌کردن تب سبد/سفارش برای مهمان | تجربهٔ کاربری | `ebc4450` |
| `notify` به‌جای `Alert.alert` | در وب کار نمی‌کند | `e65c2be`, `a1c7dea` |
| mock دستی `expo-server-sdk` | مشکل ESM در Jest | `56e3df5` |
| `/docs` فقط localhost + 404 | پنهان‌سازی سطح حمله | `48c04d4` |
| block در nginx برای `/docs` | localhost guard پشت proxy شکست می‌خورد | `020d603` |
| `sharp 0.35.4` | رفع آسیب‌پذیری | `f11b7f8` |
| `image-picker` 57→56 | هم‌ترازی با SDK 56 | `f11b7f8` |
| رد downgradeهای `npm audit` | غیرمنطقی بودند | `f11b7f8` |
| متن «صرفه‌جویی» در product-detail | بازاریابی | `f3ee855` |
| `buildUrl` برای تصویر محصول | یکپارچگی URL | `5f316eb` |
| گرید `3×2` برای دسته‌بندی‌ها | تغییر commit‌نشده | — |
