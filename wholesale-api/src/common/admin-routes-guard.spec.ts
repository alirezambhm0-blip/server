import * as fs from 'fs';
import * as path from 'path';
import { Reflector } from '@nestjs/core';
// P2-5 — `Type` برای تایپ درست کلاس کنترلر. پیش از این `cls: unknown` بود و
// چهار خطای TS2345/TS2769 می‌داد، چون Reflect.getMetadata پارامتر `Object`
// می‌خواهد و Reflector.getAllAndOverride هم `Function | Type<any>`.
// اصلاح با تایپ درست انجام شد، نه با any-cast.
import type { Type } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';

import { AdminController } from '../admin/admin.controller';
import { AppVersionController } from '../app-version/app-version.controller';
import { AuthController } from '../auth/auth.controller';
import { BannersController } from '../banners/banners.controller';
import { CartController } from '../cart/cart.controller';
import { CategoriesController } from '../categories/categories.controller';
import { FilesController } from '../files/files.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { OrdersController } from '../orders/orders.controller';
import { FavoritesController } from '../products/favorites.controller';
import { ProductsController } from '../products/products.controller';
import { ProfileController } from '../profile/profile.controller';
import { SearchController } from '../search/search.controller';
import { TicketsController } from '../tickets/tickets.controller';
import {
  VisitorSalesController,
  CustomerSearchController,
  VisitorOrderController,
} from '../visitor-sales/visitor-sales.controller';

/**
 * S9 (سیستماتیک) — هر مسیر `admin/*` باید نقش‌محافظت‌شده باشد.
 *
 * چرا این تست لازم است:
 * `RolesGuard` وقتی `@Roles` نباشد `true` برمی‌گرداند (رفتار استاندارد NestJS).
 * یعنی هر کنترلر ادمینی که `@Roles` نداشته باشد، **باز** است.
 * باگ S3 دقیقاً همین بود و به‌صورت دستی پیدا شد. این تست جلوی تکرار
 * کل آن دسته را می‌گیرد.
 *
 * به دیتابیس نیازی ندارد — فقط metadata واقعی کلاس‌ها را می‌خواند.
 */
describe('Admin routes must be role-protected (S9 systemic)', () => {
  const CONTROLLERS: { name: string; cls: Type<unknown> }[] = [
    { name: 'AdminController', cls: AdminController },
    { name: 'AppVersionController', cls: AppVersionController },
    { name: 'AuthController', cls: AuthController },
    { name: 'BannersController', cls: BannersController },
    { name: 'CartController', cls: CartController },
    { name: 'CategoriesController', cls: CategoriesController },
    { name: 'FilesController', cls: FilesController },
    { name: 'NotificationsController', cls: NotificationsController },
    { name: 'OrdersController', cls: OrdersController },
    { name: 'FavoritesController', cls: FavoritesController },
    { name: 'ProductsController', cls: ProductsController },
    { name: 'ProfileController', cls: ProfileController },
    { name: 'SearchController', cls: SearchController },
    { name: 'TicketsController', cls: TicketsController },
    { name: 'VisitorSalesController', cls: VisitorSalesController },
    { name: 'CustomerSearchController', cls: CustomerSearchController },
    { name: 'VisitorOrderController', cls: VisitorOrderController },
  ];

  const reflector = new Reflector();

  const prefixes = (cls: Type<unknown>): string[] => {
    const raw: unknown = Reflect.getMetadata(PATH_METADATA, cls);
    return (Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === 'string');
  };

  const isAdminRoute = (cls: Type<unknown>) => prefixes(cls).some((p) => p === 'admin' || p.startsWith('admin/'));

  const adminControllers = CONTROLLERS.filter((c) => isAdminRoute(c.cls));

  it('finds the expected admin controllers', () => {
    const names = adminControllers.map((c) => c.name).sort();
    expect(names).toEqual(['AdminController', 'CustomerSearchController', 'VisitorSalesController']);
  });

  it.each(adminControllers)('$name declares @Roles including ADMIN', ({ cls }) => {
    const roles = reflector.getAllAndOverride<UserRole[]>('roles', [() => undefined, cls]);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it.each(adminControllers)('$name has RolesGuard bound', ({ cls }) => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, cls) ?? []) as unknown[];
    expect(guards).toContain(RolesGuard);
  });

  it.each(adminControllers)('$name does NOT grant CUSTOMER', ({ cls }) => {
    const roles = reflector.getAllAndOverride<UserRole[]>('roles', [() => undefined, cls]);
    expect(roles ?? []).not.toContain(UserRole.CUSTOMER);
  });

  /**
   * خودنگهدار: اگر کنترلر جدیدی اضافه شود و در فهرست بالا ثبت نشود،
   * این تست شکست می‌خورد تا مجبور شویم نقش آن را بررسی کنیم.
   */
  it('every controller class on disk is registered in this test', () => {
    // این فایل در src/common/ است؛ ریشهٔ کنترلرها src/ یعنی یک سطح بالاتر
    const root = path.resolve(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.controller.ts')) files.push(full);
      }
    };
    walk(root);

    const declared = files.reduce((total, file) => {
      const src = fs.readFileSync(file, 'utf-8');
      return total + (src.match(/export class \w+Controller/g)?.length ?? 0);
    }, 0);

    expect({ declaredOnDisk: declared, registeredInTest: CONTROLLERS.length }).toEqual({
      declaredOnDisk: CONTROLLERS.length,
      registeredInTest: CONTROLLERS.length,
    });
  });
});
