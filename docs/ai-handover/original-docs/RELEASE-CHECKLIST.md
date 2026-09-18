# Release Checklist

این لیست شامل اقدامات حیاتی است که باید قبل از انتشار نهایی (Production) توسط کاربر انجام شود.
(آخرین تکمیل: فاز ۶-۳ — بخش ۶ «استقرار گام‌به‌گام روی سرور» کامل شد.)

## ۱. کلیدها و مسائل امنیتی (Credentials & Secrets)
- [ ] **JWT_SECRET**: یک رشته تصادفی و طولانی (حداقل ۳۲ کاراکتر) تولید و در فایل `.env` قرار دهید. 
    - *چرا:* امنیت توکن‌های احراز هویت کاربران به این کلید وابسته است.
- [ ] **DATABASE_URL**: آدرس دیتابیس نهایی (Production) را به همراه رمز عبور واقعی جایگزین کنید.
    - *چرا:* در حال حاضر از مقادیر تستی استفاده می‌شود که نباید به سرور واقعی منتقل شوند.
- [ ] **ADMIN_PHONE**: شماره موبایل ادمین اصلی را در `.env` وارد کنید.
    - *چرا:* اولین کاربر ادمین با این شماره در دیتابیس ساخته می‌شود (توسط Seed script).

## ۲. سرویس پیامک (MeliPayamak)
- [ ] **MELIPAYAMAK_USERNAME/PASSWORD**: نام کاربری و رمز عبور پنل ملی‌پیامک را جایگزین کنید.
- [ ] **MELIPAYAMAK_FROM/BODY_ID**: شماره فرستنده و کد قالب تایید شده را تنظیم کنید.
    - *چرا:* بدون این‌ها سیستم OTP و ورود کاربران کار نخواهد کرد.

## ۳. اپلیکیشن موبایل (Expo & Store)
- [ ] **شناسه پکیج (Package ID)**: مقدار نهایی `com.testcompany.wholesaleapp` را تعیین کنید.
    - *چرا:* تغییر این شناسه بعد از انتشار در استورها (بازار، گوگل پلی) غیرممکن است یا باعث ایجاد اپلیکیشن جدید می‌شود.
- [ ] **اکانت Expo/EAS**: در سایت Expo لاگین کرده و `projectId` واقعی را در `app.json` قرار دهید.
    - *چرا:* برای استفاده از سرویس‌های Build و OTA Update (Updates) ضروری است. (راه‌اندازی دقیق OTA = فاز ۶-۴)
- [ ] **گواهی‌های انتشار (Certificates)**: برای اندروید (Keystore) و iOS (Provisioning Profiles) گواهی‌های معتبر بسازید.
- [ ] **لینک استور (Update URL)**: در فایل `wholesale-api/src/app-version/app-version.service.ts` لینک واقعی اپ در استور را قرار دهید.
- [ ] **آدرس سرور (EXPO_PUBLIC_API_URL)**: در فایل `.env` پروژه موبایل، آدرس عمومی سرور نهایی (مثل `https://api.example.com`) را ست کنید و خروجی نهایی را با همین مقدار بسازید.

## ۴. زیرساخت و بک‌آپ
- [ ] **نصب pg_dump**: مطمئن شوید در سروری که API اجرا می‌شود، ابزار `pg_dump` نصب است.
    - *چرا:* سرویس بک‌آپ خودکار به این ابزار وابسته است.
- [ ] **دسترسی BACKUP_DIR**: مطمئن شوید مسیر مشخص شده در `.env` وجود دارد و دسترسی Write دارد.
- [ ] **بازه زمانی و تعداد بک‌آپ**: مقادیر `BACKUP_INTERVAL` و `BACKUP_MAX_COUNT` را در `.env` تنظیم کنید.
- [ ] **ماندگاری پوشه uploads**: پوشه `wholesale-api/uploads/` محل ذخیره تصاویر (محصول/مدارک KYC/بنر) است؛ در هر ری‌دیپلوی نباید پاک شود و باید در استراتژی بک‌آپ‌گیری دستی/خودکار بیاید.

## ۵. تنظیمات تجاری و قانونی
- [ ] **MIN_ORDER_AMOUNT**: حداقل مبلغ سفارش را در `.env` بازبینی کنید.
- [ ] **لینک صفحه حریم خصوصی**: آدرس صفحه قوانین و حریم خصوصی را برای ثبت در استورها آماده کنید.
- [ ] **ایمیل پشتیبانی**: یک ایمیل رسمی برای نمایش در بخش «تماس با ما» یا تیکت‌ها در نظر بگیرید.

## ۶. استقرار گام‌به‌گام روی سرور (Ubuntu + Nginx) ✅ فاز ۶-۳
پیش‌فرض: یک VPS تازه با Ubuntu 22.04، و ریپو/فایل‌های پروژه که همین‌جا روی سیستم شماست.

### ۶-۱ پیش‌نیازها (یک‌بار روی سرور)
```bash
sudo apt update && sudo apt install -y postgresql nginx curl
# Node 20 LTS:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
```
ساخت دیتابیس و کاربر اختصاصی (نه postgres اصلی):
```sql
CREATE DATABASE wholesale_db;
CREATE USER wholesale_user WITH PASSWORD 'یک-رمز-قوی';
GRANT ALL PRIVILEGES ON DATABASE wholesale_db TO wholesale_user;
```

### ۶-۲ انتقال کد و نصب دقیق
پوشه `wholesale-api` را (بدون `node_modules`) به سرور منتقل کنید، سپس:
```bash
cd wholesale-api
npm ci            # دقیقاً مطابق package-lock تست‌شده — نه npm install
```

### ۶-۳ فایل ‎`.env` پروداکشن
مقادیر بخش‌های ۱ تا ۵ را همین‌جا کامل کنید + این‌ها:
- `NODE_ENV=production` (خروجی testCode در OTP خاموش می‌شود)
- `CORS_ORIGINS` فقط دامنه‌های واقعی شما (مثل پنل ادمین/دامنه عمومی) — بدون localhost
- `VISITOR1_PHONE/VISITOR2_PHONE` را **خالی** بگذارید (کاربر تستی ساخته نشود)

### ۶-۴ دیتابیس (امن پروداکشن)
```bash
npm run db:deploy    # معادل: prisma migrate deploy
```
- *چرا:* دستور `migrate dev` برای محیط توسعه است و ممکن است در Production باعث حذف داده‌ها شود. `db:deploy` فقط مهاجرت‌های تعهدشده را اعمال می‌کند. (تست‌شده در فاز ۶-۳ روی دیتابیس تازه: هر ۱۶ مهاجرت اعمال شد.)
- اگر اولین‌بار است: `npm run db:generate` لازم نیست (با build/prisma خودش انجام می‌شود)، ولی برای سیید اولیه: `npm run db:seed` (اختیاری — ادمین اولیه را از ADMIN_PHONE می‌سازد).

### ۶-۵ ساخت و اجرا
```bash
npm run build
npm run start:prod
```
اجرای دائمی با مدیر پروسس — نمونه systemd (فایل `/etc/systemd/system/wholesale-api.service`):
```ini
[Unit]
Description=Wholesale API
After=network.target postgresql.service

[Service]
WorkingDirectory=/path/to/wholesale-api
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
# EnvironmentFile=/path/to/wholesale-api/.env   ← یا env از فایل خوانده شود (@nestjs/config همان .env کنار پروژه را می‌خواند)

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now wholesale-api
```
(معادل سریع با pm2: `npm i -g pm2 && pm2 start npm --name wholesale-api -- run start:prod && pm2 save && pm2 startup`)

### ۶-۶ Nginx به‌عنوان Reverse Proxy + ⚠️ بستن /docs
فایل `/etc/nginx/sites-available/wholesale` — **ترتیب بلاک‌ها مهم است؛ نکته امنیتی فاز ۵-۳ همین‌جا حل می‌شود:**
```nginx
server {
    listen 80;
    server_name api.example.com;   # ← دامنه واقعی

    # ─── ⚠️ الزامی: بستن مستندات Swagger ───
    # چرا: گارد localhost داخل اپ (main.ts) آدرس TCP واقعی را چک می‌کند.
    # وقتی درخواست از Nginx می‌آید، همیشه از 127.0.0.1 است → آن گارد پشت پروکسی
    # همه را «لوکال» می‌شناسد و /docs عمومی می‌شد. بنابراین بلاک باید اینجا
    # (قبل از proxy_pass) انجام شود. پاسخ 404 است تا وجودش لو نرود.
    location = /docs      { return 404; }
    location /docs/       { return 404; }
    location = /docs-json { return 404; }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;   # آپلود تصاویر (حد مسیرهای ما ۶MB است)
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/wholesale /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
- گارد داخلی اپ همچنان فعال است و به‌عنوان «دفاع در عمق» برای دسترسی مستقیم به پورت ۳۰۰۰ کار می‌کند.
- **توصیه فایروال:** پورت ۳۰۰۰ را برای بیرون ببندید (فقط Nginx به آن برسد):
  ```bash
  sudo ufw allow 80,443/tcp && sudo ufw enable
  ```
- دسترسی به /docs بعد از دیپلوی (برای خودتان، امن): تونل SSH
  ```bash
  ssh -L 3000:localhost:3000 user@api.example.com
  # سپس روی سیستم خودتان: http://localhost:3000/docs
  ```
- HTTPS: بعد از اتصال دامنه، `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d api.example.com`

### ۶-۷ تست سلامت (بعد از بالا آمدن) — چک‌لیست پذیرش
- [ ] `curl -i https://api.example.com/app/version` ← پاسخ JSON سالم (این روت عمومیِ چک نسخه است)
- [ ] `curl -I https://api.example.com/docs` ← **باید 404 بدهد** (اثبات نکته امنیتی ۶-۶)
- [ ] `curl -i https://api.example.com/products` ← عمومی، ۲۰۰ با لیست کالاها (فاز باگ ۷)
- [ ] درخواست OTP با یک شماره واقعی → پیامک می‌رسد (تست سرویس پیامک)
- [ ] ورود به پنل ادمین + آپلود/تغییر تصویر یک محصول → در اپ نمایش داده می‌شود (مسیر sharp، ۶-۱)
- [ ] `cd wholesale-api && npm test` → `18 passed` (۶-۲ — هرگاه خواستید سلامت منطق پولی را چک کنید)
- [ ] بک‌آپ: یک روز صبر (یا تغییر موقت BACKUP_INTERVAL) و دیدن فایل در BACKUP_DIR

### ۶-۸ ری‌دیپلوی (انتشار نسخه جدید بعداً)
```bash
cd wholesale-api
# فایل‌های جدید را منتقل کنید (بدون node_modules)
npm ci
npm run db:deploy     # فقط اگر مهاجرت جدید آمده — بدون‌خطر اگر نه
npm run build
sudo systemctl restart wholesale-api
```
- پوشه `uploads/` و فایل `.env` را در انتقال بازنویسی **نکنید**.
