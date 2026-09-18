# 00 — START HERE

> **اگر یک AI جدید وارد این پروژه شده‌اید، از همین فایل شروع کنید.**
>
> قبل از آن یک نگاه به `AI-PROJECT-HANDOVER.md` بیندازید (نقشهٔ فشردهٔ کل پروژه)،
> سپس این فایل را بخوانید تا بدانید **با چه ترتیبی** جلو بروید.
>
> 🔎 **دنبال چیز خاصی می‌گردید؟** → `INDEX.md` (پاسخ‌های آماده + جست‌وجوی موضوعی
> + نگاشت «فایل سورس → مستندات» + مرجع کامل IDهای `S*`/`B*`)

---

## 1. این پروژه در یک پاراگراف

`CONFIRMED` **Bonko Market** — پلتفرم عمده‌فروشی B2B فارسی‌زبان (RTL) برای بازار ایران.
فروشگاه‌داران ثبت‌نام می‌کنند، مدارک KYC می‌فرستند، **ادمین دستی تایید می‌کند**،
و بعد می‌توانند قیمت عمده ببینند و سفارش بدهند. پرداخت فقط **درب محل (COD)**.

سه بخش: بک‌اند NestJS (`wholesale-api/`)، اپ Expo (`wholesale-mobile/`)،
و پنل ادمین Vanilla JS (`wholesale-api/public/admin/`) که از همان API تغذیه می‌شود.

---

## 2. ترتیب مطالعه — دقیقاً به همین ترتیب

```
مرحله ۱ — نقشهٔ کلی (۱۰ دقیقه)
  ▸ AI-PROJECT-HANDOVER.md          ← همه‌چیز در یک فایل فشرده
  ▸ 00-START-HERE.md                ← همین فایل

مرحله ۲ — قوانین (⚠️ قبل از هر تغییری اجباری است)
  ▸ 21-AI-AGENT-RULES.md            ← قوانین اجباری + تله‌های رایج
  ▸ 19-CHANGE-IMPACT-MAP.md         ← چه تغییری چه چیزی را می‌شکند

مرحله ۲-ب — 📜 مستندات اصلی توسعه‌دهنده (بازیابی‌شده از git)
  ▸ 22-ORIGINAL-DOCS.md             ← شرح + درجهٔ اعتبار هر سند
  ▸ original-docs/                  ← ۳۰ فایل واقعی:
       README · ARCHITECTURE · CONTRIBUTING · CLAUDE · Project_Context
       RELEASE-PROGRESS (۶۶۹ خط) · RELEASE-CHECKLIST (دیپلوی) · OTA-GUIDE

مرحله ۳ — وضعیت فعلی (تا بدانید چه چیزی از قبل خراب است)
  ▸ 17-KNOWN-ISSUES.md              ← ۳۱ باگ ثبت‌شده (B1–B31)
  ▸ 15-SECURITY.md                  ← ۱۵ یافتهٔ امنیتی (S1–S15)

مرحله ۴ — بر اساس کاری که می‌خواهید انجام دهید
```

### مسیرهای پیشنهادی بر اساس نوع کار

| اگر می‌خواهید... | این‌ها را بخوانید |
|---|---|
| **روی سفارش/مالی کار کنید** | `08-DATA-FLOW.md` → `11-BUSINESS-LOGIC.md` → `10-DATABASE.md` → `wholesale-api/src/orders/orders.service.ts` |
| **روی ورود/KYC کار کنید** | `07-AUTHENTICATION.md` → `wholesale-api/src/auth/auth.service.ts` → `wholesale-mobile/app/onboarding.tsx` |
| **روی UI موبایل کار کنید** | `12-UI-COMPONENTS.md` → `06-NAVIGATION.md` → `13-STATE-MANAGEMENT.md` |
| **روی API کار کنید** | `09-API-BACKEND.md` → `04-ARCHITECTURE.md` |
| **روی پنل ادمین کار کنید** | `12-UI-COMPONENTS.md` §پنل ادمین → `wholesale-api/public/admin/core.js` |
| **دیپلوی/بیلد کنید** | `20-DEVELOPMENT-WORKFLOW.md` → `02-TECH-STACK.md` |
| **dependency اضافه/کم کنید** | `18-DEPENDENCY-MAP.md` |
| **سابقهٔ تصمیم‌ها را بفهمید** | `16-HISTORY-AND-IMPORTANT-DECISIONS.md` |
| **ساختار پوشه‌ها را بفهمید** | `03-PROJECT-STRUCTURE.md` |

---

## 3. ⚠️ چرا این مستندات بازنویسی شد (مهم)

`CONFIRMED` این پوشه (`docs/ai-handover/`) قبلاً هم وجود داشت، ولی **محتوایش با کد واقعی
تناقض داشت** و هرگز verify نشده بود. نمونه‌های تأییدشده:

| ادعای نسخهٔ قبلی | واقعیت (تأییدشده با اجرای دستور) |
|---|---|
| «Jest 3/3» (۸ بار تکرار شده بود) | ❌ **۴ suite / ۱۸ تست** — `orders.service.spec` + `auth.service.spec` + `auth.controller.spec` + `prisma.service.spec` |
| ارجاع به `RELEASE-PROGRESS.md` به‌عنوان «Most Critical File» | ❌ فایل وجود ندارد |
| ارجاع به `CLAUDE.md` به‌عنوان منبع قوانین | ❌ فایل وجود ندارد |
| ارجاع به `CONTINUATION-PROMPT.md`, `ARCHITECTURE.md`, `PERFORMANCE.md`, `README.md`, `RELEASE-CHECKLIST.md`, `OTA-GUIDE.md`, `WSL2-LOCAL-BUILD.md` | ❌ هیچ‌کدام وجود ندارند (۹ فایل) |
| «`137` warnings» | ⚠️ موبایل **۱۴۰** warning دارد |
| «Phase 6 Complete / Release Readiness» | ⚠️ با ۵ یافتهٔ امنیتی بحرانی سازگار نیست |

`INFERRED` آن نسخه احتمالاً توسط یک جلسهٔ AI قبلی بدون verify تولید شده بود.

> **نتیجهٔ عملی برای شما:** اگر در لاگ گیت، کامنت کد، یا حافظهٔ مکالمهٔ قبلی
> ادعایی دیدید که با این مستندات یا با سورس نمی‌خواند، **سورس برنده است.**
> هر ادعایی را قبل از تکرار کردن، خودتان verify کنید.

---

## 4. ⚠️ وضعیت خاص این snapshot از کد

`CONFIRMED` چند نکتهٔ غیرعادی که باید بدانید:

### ۴-۱. ریپازیتوری گیت‌هاب کد ندارد
`CONFIRMED` ریپازیتوری `cuntinue_whosale01` فقط **یک کامیت** دارد و محتوایش یک
زیپ ۲۴ مگابایتی (`workspace-01a078c1-...zip`) است. کد واقعی و تاریخچهٔ گیت اصلی
(۵۹ کامیت) **داخل آن زیپ** قرار داشت.

### ۴-۲. تغییرات commit‌نشده در موبایل (کار نیمه‌تمام)
`CONFIRMED` این فایل‌ها نسبت به HEAD تغییر کرده‌اند و **commit نشده‌اند** —
این‌ها بخشی از کد فعلی هستند، نه باگ تاریخی:

| فایل | تغییر |
|---|---|
| `app/_layout.tsx` | افزودن `SafeAreaProvider`/`SafeAreaView` + `<StatusBar style="dark" />` + `initialRouteName="(tabs)"` |
| `app/(tabs)/home.tsx` | `SafeAreaView` → `View` (رفع double-inset)؛ دسته‌بندی‌ها از scroll افقی به گرید `3×2` |
| `app/(tabs)/browse.tsx`, `orders.tsx` | `SafeAreaView` از `react-native` → `react-native-safe-area-context` |
| `app.json` | EAS projectId، `androidStatusBar`، پلاگین `expo-build-properties` (`usesCleartextTraffic`) |
| `package.json` | افزودن `expo-build-properties@^57.0.17` ⚠️ (روی SDK 56) |
| `tsconfig.json` | افزودن `"jsx": "react-native"` |
| `.env` | تغییر IP |

⚠️ **این تغییرات را revert نکنید.** کار نیمه‌تمام کاربر است.

### ۴-۳. فایل‌هایی که در HEAD هستند ولی در snapshot نیستند
`CONFIRMED` ۶۴ فایل در HEAD گیت هستند ولی در این snapshot وجود ندارند —
شامل همهٔ `*.md`های ریشه (`README.md`, `ARCHITECTURE.md`, `CLAUDE.md`,
`RELEASE-PROGRESS.md`, `OTA-GUIDE.md`, `PERFORMANCE.md`, ...) و همهٔ
`*.zip`های apply-package و اسکریپت‌های `.ps1`/`.cmd`/`.sh`.

> **اگر جایی ارجاعی به این فایل‌ها دیدید، بدانید که در دسترس نیستند.**

### ۴-۴. 🔴 `wholesale-mobile/assets/` در ریپازیتوری نیست
`CONFIRMED` مسیر `wholesale-mobile/assets/` **نه وجود دارد، نه gitignore شده**
(تأیید با `git check-ignore -v assets` → «NOT ignored»).

ولی کد به آن ارجاع می‌دهد:
```ts
// app/_layout.tsx:110-115
require("../assets/fonts/Vazirmatn-Regular.ttf")     // ← wholesale-mobile/assets/fonts/
// app/welcome.tsx:47
require("../assets/images/expo-logo.png")
// src/components/* → alias @/assets → ./assets
require('@/assets/images/logo-glow.png')
```
و `app.json` به `./assets/images/icon.png`, `splash-icon.png`, `android-icon-*.png`, `favicon.png`.

`CONFIRMED` فونت‌ها **واقعاً** در `wholesale-mobile/src/assets/fonts/` هستند
(۶ فایل، در گیت track شده‌اند) — یعنی **مسیر require با محل واقعی فایل نمی‌خواند.**

`INFERRED` چون لاگ گیت (`f11b7f8`) می‌گوید `expo export` با ۱۴۶۴ ماژول روی ماشین
توسعه‌دهنده موفق بوده، پوشهٔ `assets/` روی ماشین او وجود دارد ولی **هرگز commit نشده**.

> **پیامد:** یک clone تمیز نمی‌تواند اپ موبایل را build کند.
> `npx tsc --noEmit` و `npx expo lint` این را **نمی‌گیرند** (چون `require()` برای `.ttf`/`.png`
> با wildcard type اعلام شده). فقط Metro bundling خطا می‌دهد.
> **قبل از هر کار روی موبایل، این را با کاربر چک کنید.**

---

## 5. وضعیت تأییدشدهٔ سلامت پروژه

`CONFIRMED` این دستورها در زمان نوشتن این مستندات اجرا شدند:

| بررسی | دستور | نتیجه |
|---|---|---|
| نصب بک‌اند | `npm ci` | ✅ 815 packages |
| نصب موبایل | `npm ci` | ✅ 945 packages |
| Prisma Client | `npx prisma generate` | ✅ v5.22.0 |
| اعتبار schema | `npx prisma validate` | ✅ «The schema is valid» |
| Build بک‌اند | `npm run build` | ✅ exit 0 |
| **تست بک‌اند** | `npm test` | ✅ **4 suites / 18 tests — همه pass** |
| **Lint بک‌اند** | `npx eslint "{src,apps,libs,test}/**/*.ts"` | ✅ **0 خطا، 0 هشدار** |
| **Typecheck موبایل** | `npx tsc --noEmit` | ✅ **exit 0، 0 خطا** |
| **Lint موبایل** | `npx expo lint` | ✅ **0 خطا، 140 هشدار** |
| اجرای migrations روی DB واقعی | — | ❌ **`UNVERIFIED`** (دسترسی به PostgreSQL نبود) |
| اجرای اپ موبایل | — | ❌ **`UNVERIFIED`** (`assets/` موجود نیست) |

> ⚠️ **۱۴۰ هشدار eslint موبایل عمدی‌اند** — عمدتاً `react-hooks/set-state-in-effect`
> و `react-hooks/exhaustive-deps`. تاریخچهٔ گیت (`dc90862`, `3f12639`) نشان می‌دهد
> این الگوها **آگاهانه حفظ شده‌اند**. آن‌ها را «تمیز» نکنید مگر اینکه کاربر بخواهد.

---

## 6. پنج چیزی که اگر فقط همین‌ها را بدانید کافی است

### ۱. قیمت‌ها عمداً پنهان‌اند — ولی فقط در UI
`CONFIRMED` `PriceBox.tsx` سه حالت دارد (guest/pending/approved) و قیمت را
فقط به مشتری `APPROVED` نشان می‌دهد. **ولی API قیمت را به همه می‌دهد.**
اگر روی قیمت کار می‌کنید، `15-SECURITY.md` §S3 را بخوانید.

### ۲. کسر موجودی با «آپدیت شرطی» اتمیک می‌شود، نه با قفل
```ts
// orders.service.ts:355
await tx.product.update({
  where: { id: p.id, stock: { gte: item.quantity } },
  data:  { stock: { decrement: item.quantity } },
});
```
`CONFIRMED` کامنت صریح در `orders.service.ts:34-40`: Prisma از `lock`/`pessimistic_write`
در `findMany` پشتیبانی نمی‌کند. **این تصمیم عمدی است — «بهبودش» ندهید.**

### ۳. مسیر واقعی ثبت سفارش `cart.tsx` است (و تنها مسیر است)
✅ **به‌روزرسانی (P2):** `app/checkout.tsx` (۳۳۳ خط route یتیم) **حذف شد**.
ثبت سفارش واقعی در `app/(tabs)/cart.tsx` → `handlePlaceOrder` (خط ~۱۴۶) انجام می‌شود
و تولید `idempotencyKey` هم همان‌جاست. جزئیات: `17` §B19 و §B21.

### ۴. `CartContext` از `ref` استفاده می‌کند، نه `state`
`CONFIRMED` کامنت صریح در `CartContext.tsx:65-67`:
«کلید حل مشکل: از ref استفاده کن، نه state — `itemsRef.current` همیشه آخرین مقدار را دارد»
این برای حل stale closure در optimistic update است.

### ۵. `.env` را دست نزنید
`CONFIRMED` کاربر صراحتاً گفته «به خودم بسپار». حتی برای اصلاح IP.

---

## 7. اگر سوالی داشتید که پاسخ آن در این مستندات نیست

1. **اول در سورس بگردید.** `grep -rn "..." wholesale-api/src wholesale-mobile`
2. **اگر پیدا نشد، صریحاً بنویسید `NOT FOUND`** — حدس نزنید.
3. **اگر از کد استنباط کردید، بنویسید `INFERRED`.**
4. **اگر نتوانستید verify کنید، بنویسید `UNVERIFIED`.**
5. **اگر بین دو فایل تناقض دیدید، پنهانش نکنید** — ثبتش کنید (به `17-KNOWN-ISSUES.md` §تناقض‌ها).

---

## 8. بررسی سریع قبل از هر تغییر (Checklist)

```
☐ 21-AI-AGENT-RULES.md را خواندم
☐ 19-CHANGE-IMPACT-MAP.md را برای فایلی که می‌خواهم تغییر دهم چک کردم
☐ فایل‌های مرتبط (upstream/downstream) را خواندم
☐ می‌دانم این تغییر روی بک‌اند، API contract، موبایل و دیتابیس چه اثری دارد
☐ رفتار فعلی را فهمیدم و دلیلش را می‌دانم (یا پرسیدم)
☐ .env را دست نمی‌زنم
☐ Secretها را در خروجی/کامیت/مستندات نمی‌نویسم
☐ بعد از تغییر، verify می‌کنم:
     بک‌اند: npm test && npm run build && npx eslint "{src,apps,libs,test}/**/*.ts"
     موبایل: npx tsc --noEmit && npx expo lint
☐ تغییر Minimal & Scoped است (بازنویسی کامل فایل نکردم)
☐ متن‌های user-facing فارسی‌اند
☐ به GitHub push نمی‌کنم
```
