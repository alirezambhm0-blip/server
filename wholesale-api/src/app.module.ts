import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SmsModule } from './sms/sms.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';
import { TicketsModule } from './tickets/tickets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppVersionModule } from './app-version/app-version.module';
import { BackupModule } from './backup/backup.module';
import { BannersModule } from './banners/banners.module';
import { SearchModule } from './search/search.module';
import { ProfileModule } from './profile/profile.module';
import { VisitorSalesModule } from './visitor-sales/visitor-sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // S1: نرخ‌ها از env خوانده می‌شوند (forRootAsync تا بعد از بارگذاری .env صبر می‌کند).
    // پیش‌فرض‌ها عمداً ملایم‌اند تا در development باعث lockout نشوند؛
    // مقادیر سخت‌گیرانهٔ production در .env.example مستند شده‌اند.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const num = (key: string, fallback: number) => {
          const v = Number(config.get<string>(key));
          return Number.isFinite(v) && v > 0 ? v : fallback;
        };
        return [
          {
            name: 'default',
            ttl: num('THROTTLE_TTL_MS', 60000),
            limit: num('THROTTLE_LIMIT', 60),
          },
        ];
      },
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    PrismaModule,
    SmsModule,
    AuthModule,
    CartModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    FilesModule,
    AdminModule,
    TicketsModule,
    NotificationsModule,
    AppVersionModule,
    BackupModule,
    BannersModule,
    SearchModule,
    ProfileModule,
    VisitorSalesModule,
  ],
  // S1: بدون این binding، ThrottlerModule پیکربندی‌شده کاملاً بی‌اثر است.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
