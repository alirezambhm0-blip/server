/**
 * ============================================================================
 * B32 / P2-2 — تست اعتبارسنجی DTOهای Orders
 * ============================================================================
 *
 * چرا این تست لازم است؟
 *   پیش از این بدنهٔ درخواست‌های Orders با تایپ inline TypeScript گرفته می‌شد.
 *   تایپ TS در زمان اجرا وجود ندارد، پس ValidationPipe سراسری هیچ متادیتایی
 *   برای کار کردن نداشت و عملاً هیچ ورودی‌ای بررسی نمی‌شد.
 *
 *   این تست دقیقاً همان ValidationPipe سراسری پروژه را (با همان گزینه‌های
 *   main.ts: whitelist + forbidNonWhitelisted + transform) روی DTOهای جدید
 *   اجرا می‌کند و ثابت می‌کند اعتبارسنجی حالا واقعاً انجام می‌شود.
 *
 *   علاوه بر آن، «سازگاری با کلاینت‌های موجود» را هم بررسی می‌کند: payload
 *   واقعی موبایل (app/(tabs)/cart.tsx:155-160) و payload واقعی پنل ادمین
 *   (public/admin/orders.js:456-460) باید بدون هیچ تغییرپذیری پذیرفته شوند.
 * ============================================================================
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CreateAdminOrderDto } from './dto/create-admin-order.dto';

// دقیقاً همان گزینه‌های ValidationPipe سراسری در src/main.ts
const OPTS = { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: false };

async function check(cls: unknown, payload: Record<string, unknown>) {
  const instance = plainToInstance(cls as never, payload);
  const errors: ValidationError[] = await validate(instance as object, OPTS);
  const flat = (errs: ValidationError[]): string[] =>
    errs.flatMap((e) => [...Object.keys(e.constraints ?? {}), ...flat(Object.values(e.children ?? {}).flat())]);
  return { errors, messages: flat(errors) };
}

// کلیدهایی که کلاینت‌های واقعی می‌فرستند
const MOBILE_CHECKOUT_PAYLOAD = {
  delivery_address: 'تهران، خیابان ولیعصر',
  is_alternative_address: false,
  customer_note: 'لطفاً قبل از ارسال تماس بگیرید',
  idempotency_key: 'c3f1a2b4-5d6e-4f70-8a9b-0c1d2e3f4a5b',
};

const ADMIN_GUEST_PAYLOAD = {
  items: [{ productId: 'p-1', quantity: 2 }],
  note: 'ثبت ادمین',
  guestName: 'مشتری متفرقه',
  guestPhone: '09121234567',
};

describe('B32 / P2-2 — اعتبارسنجی DTOهای Orders', () => {
  describe('CreateOrderDto — POST /orders', () => {
    it('payload واقعی موبایل را می‌پذیرد (سازگاری با کلاینت موجود)', async () => {
      const { errors } = await check(CreateOrderDto, MOBILE_CHECKOUT_PAYLOAD);
      expect(errors).toHaveLength(0);
    });

    it('customer_note و idempotency_key اختیاری‌اند (کلاینت قدیمی نمی‌شکند)', async () => {
      const { errors } = await check(CreateOrderDto, {
        delivery_address: 'آدرس پیش‌فرض',
        is_alternative_address: false,
      });
      expect(errors).toHaveLength(0);
    });

    it('کلید ناشناخته را رد می‌کند — یعنی whitelist حالا واقعاً کار می‌کند', async () => {
      const { errors, messages } = await check(CreateOrderDto, {
        ...MOBILE_CHECKOUT_PAYLOAD,
        totalAmount: 1, // ← تزریق مبلغ توسط کلاینت
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(messages).toContain('whitelistValidation');
    });

    it('نوع اشتباه را رد می‌کند', async () => {
      const { errors } = await check(CreateOrderDto, {
        delivery_address: 12345,
        is_alternative_address: 'yes',
      });
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('فیلد الزامی حذف‌شده را رد می‌کند', async () => {
      const { errors } = await check(CreateOrderDto, { is_alternative_address: false });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('رشتهٔ بی‌نهایت بلند را رد می‌کند (پیش از این هیچ سقفی نبود)', async () => {
      const { errors } = await check(CreateOrderDto, {
        ...MOBILE_CHECKOUT_PAYLOAD,
        delivery_address: 'x'.repeat(5000),
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateOrderStatusDto — PATCH /orders/:id/status', () => {
    it('فقط status را می‌پذیرد (الگوی orders.js:141)', async () => {
      const { errors } = await check(UpdateOrderStatusDto, { status: 'CONFIRMED' });
      expect(errors).toHaveLength(0);
    });

    it('فقط paymentStatus را می‌پذیرد (الگوی orders.js:173)', async () => {
      const { errors } = await check(UpdateOrderStatusDto, { paymentStatus: 'PAID' });
      expect(errors).toHaveLength(0);
    });

    it('مقدار enum نامعتبر را رد می‌کند (پیش از این بی‌صدا می‌گذشت)', async () => {
      const { errors } = await check(UpdateOrderStatusDto, { status: 'HACKED_STATUS' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateAdminOrderDto — POST /orders/admin/create', () => {
    it('payload واقعی پنل ادمین (حالت guest) را می‌پذیرد', async () => {
      const { errors } = await check(CreateAdminOrderDto, ADMIN_GUEST_PAYLOAD);
      expect(errors).toHaveLength(0);
    });

    it('حالت existing را می‌پذیرد (customerId به‌جای guest)', async () => {
      const { errors } = await check(CreateAdminOrderDto, {
        items: [{ productId: 'p-1', quantity: 1 }],
        note: 'ثبت ادمین',
        customerId: 'c-1',
      });
      expect(errors).toHaveLength(0);
    });

    it('⚠️ بدون deliveryAddress هم می‌پذیرد — پنل ادمین آن را هرگز نمی‌فرستد', async () => {
      // اگر این فیلد required می‌شد، پنل ادمین می‌شکست. این تست همان رگرسیون را
      // برای همیشه قفل می‌کند.
      const { errors } = await check(CreateAdminOrderDto, ADMIN_GUEST_PAYLOAD);
      expect('deliveryAddress' in ADMIN_GUEST_PAYLOAD).toBe(false);
      expect(errors).toHaveLength(0);
    });

    it('حالت new (newCustomer تودرتو) را می‌پذیرد', async () => {
      const { errors } = await check(CreateAdminOrderDto, {
        items: [{ productId: 'p-1', quantity: 1 }],
        note: 'ثبت ادمین',
        newCustomer: { firstName: 'علی', phone: '09121234567', storeName: 'فروشگاه', lastName: '—' },
      });
      expect(errors).toHaveLength(0);
    });

    it('items خالی را رد می‌کند', async () => {
      const { errors } = await check(CreateAdminOrderDto, { items: [], note: 'x' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('quantity منفی یا صفر را رد می‌کند', async () => {
      const { errors } = await check(CreateAdminOrderDto, {
        items: [{ productId: 'p-1', quantity: 0 }],
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('اعتبارسنجی تودرتو واقعاً اجرا می‌شود (نه فقط سطح اول)', async () => {
      const { errors } = await check(CreateAdminOrderDto, {
        items: [{ productId: 'p-1', quantity: 'not-a-number' }],
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('شماره موبایل نامعتبر در newCustomer را رد می‌کند', async () => {
      const { errors } = await check(CreateAdminOrderDto, {
        items: [{ productId: 'p-1', quantity: 1 }],
        newCustomer: { firstName: 'a', phone: '12345', storeName: 's', lastName: 'l' },
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
