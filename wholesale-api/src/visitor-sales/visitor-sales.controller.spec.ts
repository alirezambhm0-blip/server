import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { VisitorSalesController, CustomerSearchController, VisitorOrderController } from './visitor-sales.controller';
import { VisitorSalesService } from './visitor-sales.service';

/**
 * S3/B3 — visitor-sales باید فقط برای ADMIN و VISITOR باز باشد.
 *
 * این تست خودِ RolesGuard واقعی را با Reflector واقعی اجرا می‌کند و
 * metadata واقعیِ روی کلاس‌های کنترلر را می‌خواند؛ بنابراین اگر @Roles
 * یا RolesGuard از کنترلری حذف شود، تست شکست می‌خورد.
 * به DB نیازی ندارد — VisitorSalesService هرگز صدا زده نمی‌شود.
 */
describe('VisitorSalesController — role guard (S3/B3)', () => {
  const controllers = [
    { name: 'VisitorSalesController', cls: VisitorSalesController },
    { name: 'CustomerSearchController', cls: CustomerSearchController },
    { name: 'VisitorOrderController', cls: VisitorOrderController },
  ];

  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  // ExecutionContext ساختگی: metadata از کلاس واقعی، user با نقش دلخواه
  const ctxFor = (controllerClass: unknown, role: UserRole): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'user-1', phone: '09120000000', role } }),
      }),
    }) as unknown as ExecutionContext;

  describe('guard registration', () => {
    it.each(controllers)('$name has RolesGuard registered', ({ cls }) => {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, cls) ?? []) as unknown[];
      expect(guards).toContain(RolesGuard);
    });

    it.each(controllers)('$name declares @Roles(ADMIN, VISITOR)', ({ cls }) => {
      const roles = reflector.getAllAndOverride<UserRole[]>('roles', [() => undefined, cls]);
      expect(roles).toEqual(expect.arrayContaining([UserRole.ADMIN, UserRole.VISITOR]));
      expect(roles).not.toContain(UserRole.CUSTOMER);
    });
  });

  describe('runtime enforcement', () => {
    it.each(controllers)('$name rejects CUSTOMER with 403', ({ cls }) => {
      expect(() => guard.canActivate(ctxFor(cls, UserRole.CUSTOMER))).toThrow(ForbiddenException);
    });

    it.each(controllers)('$name allows ADMIN', ({ cls }) => {
      expect(guard.canActivate(ctxFor(cls, UserRole.ADMIN))).toBe(true);
    });

    it.each(controllers)('$name allows VISITOR', ({ cls }) => {
      expect(guard.canActivate(ctxFor(cls, UserRole.VISITOR))).toBe(true);
    });

    it('rejects a request with no user at all', () => {
      const ctx = {
        getHandler: () => () => undefined,
        getClass: () => VisitorOrderController,
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as unknown as ExecutionContext;
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  it('VisitorSalesService is injectable into the controller (wiring intact)', () => {
    const svc = {} as VisitorSalesService;
    expect(new VisitorSalesController(svc)).toBeDefined();
    expect(new CustomerSearchController(svc)).toBeDefined();
    expect(new VisitorOrderController(svc)).toBeDefined();
  });
});
