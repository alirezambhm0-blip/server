# 20 — DEVELOPMENT WORKFLOW

---

## 1. پیش‌نیازها

`CONFIRMED` از `package.json`ها و `docker-compose.yml`:

| ابزار | نسخه | چرا |
|---|---|---|
| Node.js | 20+ | بک‌اند و موبایل |
| npm | همراه Node | `package-lock.json` موجود است |
| Docker + docker-compose | هر نسخهٔ اخیر | PostgreSQL 16 |
| Git | هر نسخه | ریپازیتوری داخلی |
| `eas-cli` | **سراسری** | OTA — ⚠️ `npx eas` کار نمی‌کند |

⚠️ `CONFIRMED` کامیت `6f306fc`:
> «fix eas CLI invocation (**npm i -g eas-cli** then plain 'eas');
> **npx eas fails** - package name is `eas-cli`, npm resolves unrelated 'eas' pkg»

---

## 2. راه‌اندازی اولیه

### ۲-۱. دیتابیس
```bash
cd /path/to/project
docker-compose up -d          # PostgreSQL 16 + pgAdmin
```
`CONFIRMED` تنظیمات در `docker-compose.yml` ریشهٔ پروژه.

### ۲-۲. بک‌اند
```bash
cd wholesale-api
npm ci                                    # 815 packages
cp .env.example .env                      # ✅ .env.example وجود دارد (در گیت track شده)
# ⚠️ سپس مقادیر واقعی را از کاربر بگیرید — حدس نزنید

npx prisma generate                       # Prisma Client v5.22.0
npx prisma migrate deploy                 # ۱۶ migration
npm run seed                              # ادمین + دسته‌بندی‌ها

npm run start:dev                         # http://localhost:3000
```

✅ `CONFIRMED` **`.env.example` وجود دارد و در گیت track شده.**
کلیدهایی که دارد:
```
DATABASE_URL · JWT_SECRET · JWT_EXPIRES_IN · PORT · NODE_ENV · CORS_ORIGINS
ADMIN_PHONE · MIN_ORDER_AMOUNT · FREE_SHIPPING_MIN_AMOUNT
BACKUP_DIR · BACKUP_MAX_COUNT · BACKUP_INTERVAL
VISITOR1_PHONE · VISITOR2_PHONE   (فقط تست دستی — در production خالی)
```
⚠️ `CONFIRMED` **`.env.example` کامل نیست** — این کلیدها را ندارد:
`MELIPAYAMAK_*` (۵ کلید) · `LATEST_APP_VERSION` · `MIN_APP_VERSION` · `EXPO_PUBLIC_API_URL`

⚠️ `CONFIRMED` `.env.test` هم وجود دارد (برای تست) با ۸ کلید.

### ۲-۳. موبایل
```bash
cd wholesale-mobile
npm ci                                    # 945 packages

# 🔴 اول مشکل assets/ را حل کنید → 17-KNOWN-ISSUES.md §B26

npx expo start                            # Metro
npx expo start --web                      # نسخهٔ وب
npx expo start --android                  # دستگاه/امولاتور
```

### ۲-۴. پنل ادمین
```bash
# هیچ build لازم نیست — مستقیماً سرو می‌شود
# بعد از بالا آمدن بک‌اند:
open http://localhost:3000/admin
```

---

## 3. اسکریپت‌های موجود

### ۳-۱. `wholesale-api/package.json`
`CONFIRMED`

| اسکریپت | دستور | وضعیت |
|---|---|---|
| `build` | `nest build` | ✅ exit 0 |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` | ✅ |
| `start` | `nest start` | ✅ |
| `start:dev` | `nest start --watch` | ✅ |
| `start:debug` | `nest start --debug --watch` | ✅ |
| `start:prod` | `node dist/src/main` | ⚠️ مسیر `dist/src/main` عمدی است |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` | ✅ 0/0 |
| **`test`** | `jest` | ✅ **4 suite / 18 تست** |
| `test:watch` | `jest --watch` | ✅ |
| `test:cov` | `jest --coverage` | ✅ |
| `test:debug` | `node --inspect-brk ...` | ✅ |
| **`test:e2e`** | `jest --config ./test/jest-e2e.json` | 🔴 **فایل config وجود ندارد** |
| `seed` | `ts-node prisma/seed.ts` | ✅ |
| `migrate:kyc` | `ts-node scripts/migrate-kyc.ts` | ⚠️ یک‌بارمصرف |
| `migrate:kyc:dry` | `ts-node scripts/migrate-kyc.ts --dry-run` | ✅ |
| `db:generate` | `prisma generate` | ✅ |
| `db:migrate` | `prisma migrate dev` | ✅ |
| `db:deploy` | `prisma migrate deploy` | ✅ (کامیت `020d603`) |
| `db:studio` | `prisma studio` | ✅ |
| `db:seed` | `prisma db seed` | ✅ |

### ۳-۲. `wholesale-mobile/package.json`
`CONFIRMED`

| اسکریپت | دستور | وضعیت |
|---|---|---|
| `start` | `expo start` | ✅ |
| `android` | `expo start --android` | ✅ |
| `ios` | `expo start --ios` | ✅ |
| `web` | `expo start --web` | ✅ |
| **`lint`** | `expo lint` | ✅ **0 خطا / ۱۴۰ هشدار** |
| `update` | `eas update --branch production --message` | ✅ `eas.json` موجود است |
| `update:preview` | `eas update --branch preview --message` | همان |
| `reset-project` | `node ./scripts/reset-project.js` | 🔴 **اجرا نکنید** — template را برمی‌گرداند |

⚠️ `CONFIRMED` **موبایل هیچ اسکریپت `test` ندارد.**

### ۳-۳. ریشه
`CONFIRMED` `package.json` ریشه:
```json
{ "devDependencies": { "@expo/ngrok": "^4.1.3" } }
```
🔴 **هیچ اسکریپتی ندارد.** این یک monorepo با workspaces نیست —
هر زیرپروژه جدا اجرا می‌شود.

---

## 4. ⭐ دستورهای verify (اجباری بعد از هر تغییر)

### ۴-۱. بک‌اند
```bash
cd wholesale-api

npm test
# انتظار: Test Suites: 4 passed, 4 total
#          Tests:       18 passed, 18 total

npm run build
# انتظار: exit code 0، بدون خروجی

npx eslint "{src,apps,libs,test}/**/*.ts"
# انتظار: بدون هیچ خروجی (0 خطا، 0 هشدار)
# ⚠️ npm run lint از --fix استفاده می‌کند و فایل‌ها را عوض می‌کند!
#    برای verify فقط، بدون --fix اجرا کنید.

npx prisma validate
# انتظار: "The schema at prisma/schema.prisma is valid"
```

### ۴-۲. موبایل
```bash
cd wholesale-mobile

npx tsc --noEmit
# انتظار: exit code 0

npx expo lint
# انتظار: 0 errors, 140 warnings
# ⚠️ ۱۴۰ هشدار عمدی‌اند — «تمیزشان» نکنید
```

### ۴-۳. ⚠️ آنچه این دستورها **نمی‌گیرند**

| چیز | چرا گرفته نمی‌شود |
|---|---|
| 🔴 `assets/` موجود نیست | `require()` برای `.ttf`/`.png` با wildcard type اعلام شده — فقط Metro می‌گیرد |
| 🔴 مسیر route اشتباه | expo-router در runtime resolve می‌کند |
| 🔴 پاسخ API تغییر کرده | هیچ تست e2e نیست |
| 🔴 alias `@/` ناهمگام بین babel و tsconfig | `tsc` از tsconfig می‌خواند، Metro از babel |
| ⚠️ رفتار Prisma روی DB واقعی | تست‌ها از mock in-memory استفاده می‌کنند |
| ⚠️ RTL / SafeArea | فقط بصری قابل تشخیص است |

> **نتیجه:** `tsc` + `eslint` سبز بودن ≠ اپ کار می‌کند.
> برای تغییرات UI، **حتماً اپ را اجرا کنید.**

---

## 5. تست

### ۵-۱. بک‌اند — ۴ suite / ۱۸ تست
`CONFIRMED`

| فایل | موضوع |
|---|---|
| `src/orders/orders.service.spec.ts` (674 خط) | ⭐ مسیر پول: موجودی اتمیک، race، idempotency، لغو |
| `src/auth/auth.service.spec.ts` | OTP، verify، JWT |
| `src/auth/auth.controller.spec.ts` | لایهٔ controller |
| `src/prisma/prisma.service.spec.ts` | اتصال |

`CONFIRMED` کامیت `7b72446`:
> «money-path tests (**14 cases w/ faithful in-memory Prisma**: atomic stock, race,
> idempotency) + proven cancel-order P2025->400 fix»

### ۵-۲. ⚠️ config مهم Jest
`CONFIRMED` از `package.json`:
```json
"jest": {
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": {
    "^expo-server-sdk$": "<rootDir>/../test/mocks/expo-server-sdk.mock.ts"
  },
  "testEnvironment": "node"
}
```

🔴 **دو تله:**
1. `rootDir: "src"` → فایل spec باید **داخل `src/`** باشد
2. `moduleNameMapper` → اگر `test/mocks/expo-server-sdk.mock.ts` را حذف کنید، تست‌ها می‌شکنند
   (کامیت `56e3df5` این را برای رفع مشکل ESM اضافه کرد)

### ۵-۳. نکات نوشتن تست (از تجربهٔ verify شده)
`CONFIRMED`

```ts
// ❌ غلط — string token کار نمی‌کند
providers: [{ provide: 'OrdersService', useValue: mock }]

// ✅ درست — از کلاس واقعی استفاده کنید
providers: [{ provide: OrdersService, useValue: mock }]
```

```ts
// ❌ غلط
app.getHttpServer()._router

// ✅ درست
app.getHttpAdapter().getInstance()._router.stack
```

⚠️ اگر guardها را override می‌کنید، باید `req.user` را ست کنید —
وگرنه `@GetUser()` مقدار `undefined` می‌دهد و **۵۰۰** می‌گیرید.

### ۵-۴. موبایل — ❌ هیچ تستی نیست
`CONFIRMED` `jest` در devDependencies موبایل نیست و هیچ `*.test.tsx` وجود ندارد.

### ۵-۵. e2e — ❌ وجود ندارد
`CONFIRMED` `test/jest-e2e.json` نیست → `npm run test:e2e` شکست می‌خورد.
`supertest` نصب است ولی بی‌استفاده.

---

## 6. Lint و فرمت

### ۶-۱. بک‌اند
`CONFIRMED` `eslint.config.mjs` — ESLint 9 flat config.
وضعیت: **۰ خطا، ۰ هشدار.**

⚠️ `npm run lint` شامل `--fix` است. برای verify بدون تغییر فایل:
```bash
npx eslint "{src,apps,libs,test}/**/*.ts"
```

### ۶-۲. موبایل
`CONFIRMED` `eslint-config-expo@~56.0.4`.
وضعیت: **۰ خطا، ۱۴۰ هشدار.**

⚠️ **۱۴۰ هشدار عمدی‌اند** — عمدتاً:
- `react-hooks/set-state-in-effect`
- `react-hooks/exhaustive-deps`

`CONFIRMED` کامیت‌های `dc90862` و `3f12639` نشان می‌دهند این الگوها
**آگاهانه حفظ شده‌اند** (با «reopen triggers» مستندشده).

🔴 **«تمیزشان» نکنید** مگر اینکه کاربر صریحاً بخواهد.

---

## 7. Migration دیتابیس

### ۷-۱. جریان درست
```bash
cd wholesale-api

# ۱. schema را ویرایش کنید
# ۲. اعتبارسنجی
npx prisma validate

# ۳. ساخت migration
npx prisma migrate dev --name add_<descriptive_name>

# ۴. ⚠️ SQL تولیدشده را دستی بخوانید
cat prisma/migrations/<timestamp>_add_<name>/migration.sql
#    به‌ویژه: DROP COLUMN · ALTER TYPE · DROP TABLE

# ۵. generate
npx prisma generate

# ۶. verify
npm run build && npm test
```

### ۷-۲. دیپلوی
```bash
npm run db:deploy          # prisma migrate deploy
```
`CONFIRMED` کامیت `020d603`: «verified on fresh DB: all 16 migrations»

### ۷-۳. 🔴 کارهایی که نکنید
| دستور | چرا |
|---|---|
| `npx prisma format` | فایل را بازنویسی می‌کند، کامنت‌ها جابه‌جا می‌شوند |
| `npx prisma migrate reset` | سه `*_init` را دوباره اجرا می‌کند |
| `npx prisma db push` روی DB دارای داده | از دست رفتن داده |
| `prisma migrate dev` روی DB پروداکشن | shadow database می‌سازد |

---

## 8. دیپلوی

`CONFIRMED` runbook کامل در `RELEASE-CHECKLIST.md` بوده که **در این snapshot نیست**.
بازیابی:
```bash
cd /path/to/project/src && git show HEAD:RELEASE-CHECKLIST.md
```

`CONFIRMED` از کامیت `020d603`: «full step-by-step **Ubuntu/Nginx** runbook»

### ۸-۱. نکات حیاتی دیپلوی
```
☐ ۱. NODE_ENV=production       ← 🔴 وگرنه testCode در پاسخ OTP است
☐ ۲. JWT_SECRET جدید            ← 🔴 فعلی در ریپازیتوری لو رفته
☐ ۳. رمز DATABASE_URL را بچرخانید
☐ ۴. اعتبارنامه‌های ملی‌پیامک را بچرخانید
☐ ۵. 🔴 /docs را در nginx مسدود کنید:
        location ~ ^/docs(-json)?$ { return 404; }
     (کامیت 020d603: «localhost guard by design fails behind proxy»)
☐ ۶. uploads/ و backups/ را روی دیسک پایدار/پشتیبان‌گیری‌شده بگذارید
☐ ۷. app.listen روی 0.0.0.0 است — با firewall کنترل کنید
☐ ۸. npm run db:deploy (نه migrate dev)
☐ ۹. npm run start:prod  →  node dist/src/main
```

### ۸-۲. OTA (موبایل)
`CONFIRMED` کامیت `5fee68a`: «EAS Update OTA - eas.json channels (preview/production)»

✅ `eas.json` در `wholesale-mobile/eas.json` **موجود و tracked** است.
⚠️ توجه: `git show HEAD:eas.json` **شکست می‌خورد** — مسیر درست `wholesale-mobile/eas.json` است.

راهنما در `OTA-GUIDE.md` بوده → `git show HEAD:OTA-GUIDE.md`

```bash
npm i -g eas-cli                    # ⚠️ نه npx eas
eas login
eas init                            # projectId را در app.json می‌نویسد
npm run update -- "پیام تغییرات"    # production
npm run update:preview -- "..."     # preview
```

`CONFIRMED` کامیت `b861e71`: «user OTA setup progress (login/init done,
projectId linked, **benign 403 icon note**)»

---

## 9. الگوهای کار با این کاربر (از تاریخچه)

`CONFIRMED` از پیام‌های کامیت‌ها:

### ۹-۱. Minimal & Scoped
`CONFIRMED` کامیت `df558a2`:
> «deliverable: sync-audit kit (**read-only audit first, per Minimal&Scoped rules**);
> **withdraw blanket full-sync zip**»

**قاعده:** اول audit فقط‌خواندنی، بعد کمترین تغییر ممکن.

### ۹-۲. تحویل به‌صورت بستهٔ تغییرات
`CONFIRMED` الگوی تکرارشونده:
```
93aeae1  phase5-1-changes.zip (43 files + README-APPLY)
f242714  sync-minimal.zip (4 justified files from audit)
32a1c48  consolidated ALL-FIXES-final.zip (21 files) to remove multi-zip confusion
```
**درس:** یک بستهٔ واحد با README بهتر از چند زیپ پراکنده است.

### ۹-۳. verify روی ماشین کاربر
`CONFIRMED` کامیت‌های `ed33e7e`, `4d48c1e`:
> «docs: record **user-machine verification** of Phase 5-1 (backend+mobile green)»

**قاعده:** «سبز بودن در محیط AI» کافی نیست — کاربر باید روی ماشین خودش تأیید کند.

### ۹-۴. جایگزینی کورکورانه فقط با درخواست صریح
`CONFIRMED` کامیت `9b293fb`:
> «**blind 1:1 replacement of 14 files per explicit one-time user request**
> (lint regression expected, **fix scheduled next**)»

### ۹-۵. عقب‌اندازی آگاهانه با «reopen trigger»
`CONFIRMED` کامیت `3f12639`:
> «finalize step-5 **deferred-item decisions with reopen triggers** (approved)»

**قاعده:** اگر کاری را عقب می‌اندازید، **شرط بازگشایی‌اش** را هم ثبت کنید.

---

## 10. دستورات مفید برای اکتشاف

```bash
# ساختار
cd /path/to/project/src
find wholesale-api/src -type f -name "*.ts" | sort
find wholesale-mobile/app -type f | sort

# سرشماری endpoint
grep -rhcE "^\s*@(Get|Post|Put|Patch|Delete)\(" \
  --include=*.controller.ts wholesale-api/src | paste -sd+ | bc

# پیداکردن guardها
grep -rn "@UseGuards\|@Roles" --include=*.controller.ts wholesale-api/src

# پیداکردن رویدادها
grep -rn "\.emit(\|@OnEvent" --include=*.ts wholesale-api/src

# پیداکردن throw های خام
grep -rn "throw new Error(" --include=*.ts wholesale-api/src

# تاریخچه
git log --oneline --reverse
git show <commit>

# بازیابی فایل حذف‌شده
git show HEAD:RELEASE-CHECKLIST.md

# بررسی اینکه چیزی ارجاع شده یا نه
grep -rn "<symbol>" wholesale-mobile/app wholesale-mobile/src
```

⚠️ `cat` فایل‌های بزرگ را truncate می‌کند — از `sed -n 'A,Bp'` یا `grep -n` استفاده کنید.

⚠️ **هرگز محتوای `.env` را چاپ نکنید** — فقط نام کلیدها.

---

## 🔐 متغیرهای محیطی جدید (فاز رفع P0)

همه در `.env.example` مستند شده‌اند. **هیچ‌کدام اجباری نیستند** — کد پیش‌فرض دارد.

| کلید | پیش‌فرض کد | production پیشنهادی | اثر |
|---|---|---|---|
| `THROTTLE_LIMIT` | `60` | `60` | حد عمومی برای همهٔ ۱۱۷ endpoint |
| `THROTTLE_TTL_MS` | `60000` | `60000` | پنجرهٔ زمانی حد عمومی |
| `OTP_REQUEST_LIMIT` | `20` | `5` | حد `POST /auth/request-otp` |
| `OTP_REQUEST_TTL_MS` | `900000` | `900000` | پنجرهٔ آن |
| `OTP_VERIFY_LIMIT` | `50` | `10` | حد `POST /auth/verify-otp` |
| `OTP_VERIFY_TTL_MS` | `900000` | `900000` | پنجرهٔ آن |
| `TRUST_PROXY` | `0` | `1` **پشت nginx** | باور کردن `X-Forwarded-For` |

> ⚠️ **پیش‌فرض‌ها عمداً ملایم‌اند** تا در development باعث lockout نشوند.
> برای production مقادیر ستون سوم را در `.env` بگذارید.

> 🔴 **`TRUST_PROXY` پشت nginx باید `1` شود** — وگرنه `req.ip` برای همهٔ کاربران
> آدرس proxy است و همه در یک سطل rate-limit می‌افتند (چند کاربر همزمان = قطعی).
> اگر سرویس **مستقیم** در معرض اینترنت است، `0` بماند (وگرنه با جعل
> `X-Forwarded-For` محدودیت قابل دورزدن است).

### کلیدهایی که در `.env.example` نبودند ولی کد می‌خواند
`MELIPAYAMAK_USERNAME` · `MELIPAYAMAK_PASSWORD` · `MELIPAYAMAK_BODY_ID` (`sms.service.ts:43-45`)
و `SENTRY_DSN` (`main.ts:17`) — هر چهار مورد اضافه شدند.

### پیکربندی مرده (صفر ارجاع در کد)
`MIN_ORDER_AMOUNT` و `FREE_SHIPPING_MIN_AMOUNT` — در `.env.example` کامنت خوردند
ولی حذف نشدند.
