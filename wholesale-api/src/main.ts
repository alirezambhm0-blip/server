import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { SentryFilter } from './common/sentry.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: 1.0,
      profilesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
    });
    app.useGlobalFilters(new SentryFilter());
    logger.log('Sentry Crash Reporting initialized');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const corsOriginsEnv = process.env.CORS_ORIGINS;
  const allowedOrigins = corsOriginsEnv
    ? corsOriginsEnv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:19006', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // سرو کردن پنل ادمین از /admin
  const adminDist = path.resolve(process.cwd(), 'public', 'admin');
  if (fs.existsSync(adminDist)) {
    app.useStaticAssets(adminDist, { prefix: '/admin' });
    logger.log('Admin UI mounted at /admin');
  }

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  for (const sub of ['kyc', 'products', 'categories']) {
    const p = path.join(uploadsDir, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
  // توجه: فایل‌های uploads/kyc فقط برای ادمین از طریق FilesController سرو می‌شوند.
  // فایل‌های products/categories به‌صورت public از طریق FilesController.servePublic سرو می‌شوند.
  // (از استاتیک مستقیم استفاده نمی‌کنیم تا CORS/header کنترل شده باشد.)

  // مستندات تعاملی OpenAPI (Swagger UI) — فاز ۵-۳
  // صرفاً مستندسازی است و هیچ اثری روی رفتار API ندارد؛ خروجی JSON آن در /docs-json
  // اسکیمای DTOها به‌صورت خودکار توسط پلاگین @nestjs/swagger (تنظیم‌شده در nest-cli.json) ساخته می‌شود.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bonko Market API')
    .setDescription(
      'مستندات تعاملی API پلتفرم عمده‌فروشی Bonko Market — احراز هویت: Bearer JWT (از auth/verify-otp دریافت می‌شود)'
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  // امنیت /docs: فقط اتصال‌های localhost اجازه دارند — حتی بعد از دیپلوی روی سرور.
  // بررسی روی آدرس TCP واقعی اتصال انجام می‌شود (با جعل هدر Host قابل دورزدن نیست).
  // پاسخ مسدودها 404 است (نه 403) تا وجود /docs برای غریبه‌ها قابل تشخیص نباشد.
  // دسترسی روی سرور: ssh -L 3000:localhost:3000 user@server  →  سپس http://localhost:3000/docs
  app.use(['/docs', '/docs-json'], (req: Request, res: Response, next: NextFunction) => {
    const remote = req.socket.remoteAddress ?? '';
    if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
      next();
      return;
    }
    res.status(404).json({ statusCode: 404, message: 'Not Found' });
  });

  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });
  logger.log('Swagger UI available at /docs (localhost only)');

  // S1: پشت reverse proxy (nginx) بدون این تنظیم، req.ip برای همهٔ کاربران
  // آدرس proxy می‌شود و همه در یک سطل rate-limit می‌افتند.
  // پیش‌فرض خاموش است (امن برای استقرار مستقیم)؛ پشت nginx باید TRUST_PROXY=1 شود.
  const trustProxy = (process.env.TRUST_PROXY ?? '').trim();
  if (trustProxy && trustProxy !== '0' && trustProxy.toLowerCase() !== 'false') {
    const hops = trustProxy === '1' || trustProxy.toLowerCase() === 'true' ? 1 : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', hops);
    logger.log(`Express 'trust proxy' enabled (${trustProxy})`);
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`Backend running: http://localhost:${port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);
}
void bootstrap();
