// ═══════════════════════════════════════════════════════════════════════
// قدم ۶-۲ (Release Readiness): تست‌های معنادار مسیرهای پولی
//   ۱) ثبت سفارش از سبد (createFromCart) — جمع مبالغ، کسر اتمیک موجودی، پاک شدن سبد
//   ۲) لغو سفارش (cancelOrder) — گارد مالکیت/وضعیت + برگشت اتمیک موجودی
//   ۳) سفارش ادمین (createAdminOrder)
// راهبرد: دابل درون‌حافظه‌ای «باوفا» برای Prisma که معناشناسی واقعی را حفظ می‌کند:
//   - آپدیت شرطی روی موجودی: اگر stock < qty باشد، دقیقاً مثل PostgreSQL/Prisma
//     خطای P2025 پرتاب می‌کند (نه null) — همان مکانیزمی که oversell را ممنوع می‌کند.
//   - آپدیت شرطی لغو: عدم‌تطابق وضعیت/مالکیت = P2025 (رفتار واقعی تأییدشده در ۶-۲).
//   - شبیه‌سازی «مسابقه خرید همزمان»: تغییر موجودی بین خواندن کالا و کسر.
// نیاز به دیتابیس ندارد (npm test همیشه مستقل اجرا می‌شود).
// ═══════════════════════════════════════════════════════════════════════
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_ORDER_CREATED, EVENT_ORDER_STATUS_CHANGED } from '../notifications/events/events';

// ─── تایپ‌های دابل ──────────────────────────────────────────────────────
interface FakeProductRow {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  itemsPerPackage: number | null;
  packageType: string | null;
}
interface FakeCartRow {
  customerId: string;
  productId: string;
  quantity: number;
}
interface FakeOrderItemRow {
  id: string;
  productId: string | null;
  productName: string;
  productImageUrl?: string | null;
  productUnit?: string | null;
  productPrice: number;
  originalPrice: number | null;
  quantity: number;
  lineTotal: number;
  itemsPerPackageLabel?: string | null;
}
interface FakeStatusHistoryRow {
  id: string;
  status: string;
  note?: string | null;
  changedBy?: string | null;
  timestamp: Date;
}
interface FakeOrderRow {
  id: string;
  orderNumber: string;
  /** B19 */
  idempotencyKey?: string | null;
  customerId: string | null;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotalAmount: number;
  totalAmount: number;
  note: string | null;
  alternativeAddress: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  guestName?: string | null;
  guestPhone?: string | null;
  orderSource?: string;
  placedByUserId?: string | null;
  placedByName?: string | null;
  statusHistory: FakeStatusHistoryRow[];
  items: FakeOrderItemRow[];
}
interface FakeCustomer {
  id: string;
  userId: string;
  status: string;
  province: string | null;
  city: string | null;
  address: string | null;
}
interface FakeUser {
  id: string;
  isActive: boolean;
}
type ProductFindArgs = { where: { id: { in: string[] } } };
type ProductUpdateArgs = {
  where: { id: string; stock?: { gte: number } };
  data: { stock?: { decrement?: number; increment?: number } };
};
type CartFindArgs = { where: { customerId: string } };
type CartDeleteArgs = { where: { customerId: string } };
type OrderFindArgs = { where: { id?: string; idempotencyKey?: string | null } };
type OrderUpdateArgs = {
  where: { id: string; customerId?: string; status?: string };
  data: {
    status: string;
    cancellationReason?: string;
    statusHistory?: { create: { status: string; note?: string; changedBy?: string } };
  };
};
interface OrderCreateItemInput {
  productId: string | null;
  productName: string;
  productImageUrl?: string | null;
  productUnit: string;
  productPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  itemsPerPackageLabel?: string | null;
}
type OrderCreateArgs = {
  data: {
    orderNumber: string;
    idempotencyKey?: string | null;
    customerId: string | null;
    guestName?: string | null;
    guestPhone?: string | null;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    subtotalAmount: number;
    totalAmount: number;
    note?: string | null;
    alternativeAddress?: string | null;
    orderSource?: string;
    placedByUserId?: string | null;
    placedByName?: string | null;
    statusHistory?: { create: { status: string; note?: string; changedBy?: string } };
    items?: { createMany: { data: OrderCreateItemInput[] } };
  };
};
interface PrismaDouble {
  $transaction: (arg: unknown) => Promise<unknown>;
  user: {
    findUnique: () => Promise<(FakeUser & { customer: FakeCustomer | null }) | null>;
    create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }>;
  };
  customer: { create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }> };
  cartItem: {
    findMany: (a: CartFindArgs) => Promise<Array<FakeCartRow & { product: FakeProductRow | null }>>;
    deleteMany: (a: CartDeleteArgs) => Promise<{ count: number }>;
  };
  // B19 — resolveIdempotentDuplicate «بیرون» از تراکنش (پس از rollback) اجرا می‌شود،
  // پس order باید در سطح بالای دابل هم در دسترس باشد، نه فقط روی tx.
  order: {
    findUnique: (args: OrderFindArgs) => Promise<(FakeOrderRow & { items: FakeOrderItemRow[] }) | null>;
  };
  __store: Map<string, FakeProductRow>;
  __cart: FakeCartRow[];
  __race: Map<string, number>;
  __createdOrders: FakeOrderRow[];
}

const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('Record to update not found.', { code: 'P2025', clientVersion: '5.22.0' });

// B19 — P2002 با target مشخص؛ همان شکلی که PostgreSQL/Prisma برای نقض @unique می‌دهد.
// target عمداً پارامتر است تا بتوان «constraint دیگر» را هم شبیه‌سازی کرد.
const p2002 = (target: string[] | string = ['idempotencyKey']) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { target },
  });

// ─── فیکسچرها ───────────────────────────────────────────────────────────
const CUSTOMER: FakeCustomer = {
  id: 'cust-1',
  userId: 'user-1',
  status: 'APPROVED',
  province: 'تهران',
  city: 'تهران',
  address: 'خیابان آزادی',
};
const USER: FakeUser = { id: 'user-1', isActive: true };

function makeProduct(over: Partial<FakeProductRow> = {}): FakeProductRow {
  return {
    id: 'p1',
    name: 'روغن',
    slug: 'roghan',
    price: 50_000,
    oldPrice: null,
    stock: 5,
    unit: 'PIECE',
    imageUrl: null,
    isActive: true,
    itemsPerPackage: null,
    packageType: null,
    ...over,
  };
}

function pendingOrder(over: Partial<FakeOrderRow> = {}): FakeOrderRow {
  return {
    id: 'order-1',
    orderNumber: 'ORD-1',
    customerId: 'cust-1',
    status: 'PENDING',
    paymentMethod: 'CASH_ON_DELIVERY',
    paymentStatus: 'UNPAID',
    subtotalAmount: 100_000,
    totalAmount: 100_000,
    note: null,
    alternativeAddress: null,
    cancellationReason: null,
    createdAt: new Date(),
    statusHistory: [{ id: 'h1', status: 'PENDING', note: 'سفارش ثبت شد', timestamp: new Date() }],
    items: [
      {
        id: 'oi1',
        productId: 'p1',
        productName: 'روغن',
        productUnit: 'عدد',
        productPrice: 50_000,
        originalPrice: 50_000,
        quantity: 2,
        lineTotal: 100_000,
        itemsPerPackageLabel: null,
      },
    ],
    ...over,
  };
}

// ─── دابل Prisma با معناشناسی واقعی ──────────────────────────────────────
function buildPrismaMock(opts: {
  user?: FakeUser;
  customer?: FakeCustomer | null;
  cartItems?: FakeCartRow[];
  products?: FakeProductRow[];
  orders?: FakeOrderRow[];
  /** B19 — تزریق خطای دلخواه در order.create برای شبیه‌سازی نقض constraint دیگر */
  orderCreateError?: Error;
}): PrismaDouble {
  const store = new Map<string, FakeProductRow>((opts.products ?? []).map((p) => [p.id, { ...p }]));
  const orderStore = new Map<string, FakeOrderRow>((opts.orders ?? []).map((o) => [o.id, o]));
  const cart: FakeCartRow[] = (opts.cartItems ?? []).map((i) => ({ ...i }));
  const race = new Map<string, number>(); // productId -> موجودی مؤثر در لحظه آپدیت (شبیه‌سازی خرید همزمان)
  const createdOrders: FakeOrderRow[] = [];
  const customer = opts.customer ?? null;
  // B19 — کسر/افزایش موجودی که «داخل» تراکنش جاری انجام شده؛ برای شبیه‌سازی دقیق
  // rollback. عمداً فقط همین‌ها برمی‌گردند: تغییر یک خریدار همزمان (مکانیزم __race)
  // یک commit بیرونی است و rollback نباید آن را از بین ببرد.
  let txStockDeltas = new Map<string, number>();

  const tx = {
    product: {
      findMany: (args: ProductFindArgs): Promise<FakeProductRow[]> =>
        Promise.resolve(
          args.where.id.in
            .map((id) => store.get(id))
            .filter((p): p is FakeProductRow => !!p)
            .map((p) => ({ ...p }))
        ),
      update: (args: ProductUpdateArgs): Promise<FakeProductRow> => {
        const p = store.get(args.where.id);
        if (!p) return Promise.reject(p2025());
        const raceVal = race.get(args.where.id);
        if (raceVal !== undefined) p.stock = raceVal;
        const gte = args.where.stock?.gte;
        if (gte !== undefined && p.stock < gte) return Promise.reject(p2025());
        const dec = args.data.stock?.decrement;
        if (dec !== undefined) {
          p.stock -= dec;
          txStockDeltas.set(args.where.id, (txStockDeltas.get(args.where.id) ?? 0) + dec);
        }
        const inc = args.data.stock?.increment;
        if (inc !== undefined) {
          p.stock += inc;
          txStockDeltas.set(args.where.id, (txStockDeltas.get(args.where.id) ?? 0) - inc);
        }
        return Promise.resolve({ ...p });
      },
    },
    cartItem: {
      deleteMany: (args: CartDeleteArgs): Promise<{ count: number }> => {
        let count = 0;
        for (let i = cart.length - 1; i >= 0; i--) {
          if (cart[i].customerId === args.where.customerId) {
            cart.splice(i, 1);
            count++;
          }
        }
        return Promise.resolve({ count });
      },
    },
    order: {
      findUnique: (args: OrderFindArgs): Promise<(FakeOrderRow & { items: FakeOrderItemRow[] }) | null> => {
        // B19 — علاوه بر id، جست‌وجو با idempotencyKey هم لازم است
        const o = args.where.id
          ? orderStore.get(args.where.id)
          : args.where.idempotencyKey
            ? createdOrders.find((x) => x.idempotencyKey === args.where.idempotencyKey)
            : undefined;
        return Promise.resolve(o ? { ...o, items: o.items.map((it) => ({ ...it })) } : null);
      },
      update: (args: OrderUpdateArgs): Promise<FakeOrderRow & { customer: FakeCustomer | null }> => {
        const o = orderStore.get(args.where.id);
        if (!o) return Promise.reject(p2025());
        if (args.where.customerId && o.customerId !== args.where.customerId) return Promise.reject(p2025());
        if (args.where.status && o.status !== args.where.status) return Promise.reject(p2025());
        o.status = args.data.status;
        o.cancellationReason = args.data.cancellationReason ?? null;
        const hist = args.data.statusHistory?.create;
        if (hist) {
          o.statusHistory.push({
            id: `h${o.statusHistory.length + 1}`,
            status: hist.status,
            note: hist.note ?? null,
            changedBy: hist.changedBy ?? null,
            timestamp: new Date(),
          });
        }
        return Promise.resolve({ ...o, customer });
      },
      create: (args: OrderCreateArgs): Promise<FakeOrderRow & { customer: FakeCustomer | null }> => {
        const d = args.data;
        if (opts.orderCreateError) return Promise.reject(opts.orderCreateError);
        // B19 — شبیه‌سازی @unique روی idempotencyKey دقیقاً مثل PostgreSQL:
        // دومین insert با همان کلید ⇒ P2002 (و در سرویس، کل تراکنش rollback می‌شود)
        if (d.idempotencyKey && createdOrders.some((o) => o.idempotencyKey === d.idempotencyKey)) {
          return Promise.reject(p2002());
        }
        const hist = d.statusHistory?.create;
        const o: FakeOrderRow & { customer: FakeCustomer | null } = {
          id: `order-${createdOrders.length + 1}`,
          createdAt: new Date(),
          cancellationReason: null,
          alternativeAddress: d.alternativeAddress ?? null,
          note: d.note ?? null,
          orderNumber: d.orderNumber,
          idempotencyKey: d.idempotencyKey ?? null,
          customerId: d.customerId,
          guestName: d.guestName ?? null,
          guestPhone: d.guestPhone ?? null,
          status: d.status,
          paymentMethod: d.paymentMethod,
          paymentStatus: d.paymentStatus,
          subtotalAmount: d.subtotalAmount,
          totalAmount: d.totalAmount,
          orderSource: d.orderSource ?? 'APP',
          placedByUserId: d.placedByUserId ?? null,
          placedByName: d.placedByName ?? null,
          items: (d.items?.createMany?.data ?? []).map((it, idx) => ({
            id: `oi${idx}`,
            productId: it.productId,
            productName: it.productName,
            productImageUrl: it.productImageUrl ?? null,
            productUnit: it.productUnit,
            productPrice: it.productPrice,
            originalPrice: it.originalPrice,
            quantity: it.quantity,
            lineTotal: it.lineTotal,
            itemsPerPackageLabel: it.itemsPerPackageLabel ?? null,
          })),
          customer,
          statusHistory: hist
            ? [
                {
                  id: 'h1',
                  status: hist.status,
                  note: hist.note ?? null,
                  changedBy: hist.changedBy ?? null,
                  timestamp: new Date(),
                },
              ]
            : [],
        };
        createdOrders.push(o);
        orderStore.set(o.id, o);
        return Promise.resolve(o);
      },
    },
    user: {
      create: (a: { data: Record<string, unknown> }): Promise<{ id: string }> =>
        Promise.resolve({ id: 'new-user-1', ...a.data }),
    },
    customer: {
      create: (a: { data: Record<string, unknown> }): Promise<{ id: string }> =>
        Promise.resolve({ id: 'new-cust-1', ...a.data }),
    },
  };

  return {
    $transaction: (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg) as Promise<unknown>;
      // B19 — شبیه‌سازی rollback: در PostgreSQL هر خطا داخل تراکنش، تغییرات همان
      // تراکنش را برمی‌گرداند. بدون این، دابل نمی‌توانست ثابت کند که درخواست تکراری
      // موجودی را دوباره کسر نمی‌کند.
      txStockDeltas = new Map();
      return Promise.resolve((arg as (t: typeof tx) => Promise<unknown>)(tx)).catch((e) => {
        txStockDeltas.forEach((amount, id) => {
          const prod = store.get(id);
          if (prod) prod.stock += amount;
        });
        throw e;
      });
    },
    user: {
      findUnique: () => Promise.resolve(opts.user ? { ...opts.user, customer } : null),
      create: tx.user.create,
    },
    customer: { create: tx.customer.create },
    cartItem: {
      findMany: (args: CartFindArgs) =>
        Promise.resolve(
          cart
            .filter((i) => i.customerId === args.where.customerId)
            .map((i) => ({ ...i, product: store.get(i.productId) ?? null }))
        ),
      deleteMany: tx.cartItem.deleteMany,
    },
    order: { findUnique: tx.order.findUnique },
    __store: store,
    __cart: cart,
    __race: race,
    __createdOrders: createdOrders,
  };
}

type HttpError = Error & { getResponse?: () => unknown };
async function catchErr(p: Promise<unknown>): Promise<HttpError | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e as HttpError;
  }
}

async function makeService(prisma: PrismaDouble, emit = jest.fn()) {
  const mod = await Test.createTestingModule({
    providers: [
      OrdersService,
      { provide: PrismaService, useValue: prisma },
      { provide: EventEmitter2, useValue: { emit } },
    ],
  }).compile();
  return { service: mod.get(OrdersService), emit };
}

// ═══════════════════════════════════════════════════════════════════════
describe('مسیر پولی: ثبت سفارش از سبد (createFromCart)', () => {
  it('خرید موفق: جمع‌ها + کسر اتمیک موجودی + پاک شدن سبد + رویداد', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [
        makeProduct({ id: 'p1', price: 50_000, oldPrice: 60_000, stock: 5 }),
        makeProduct({ id: 'p2', name: 'برنج', price: 80_000, stock: 10, itemsPerPackage: 12, packageType: 'کارتن' }),
      ],
      cartItems: [
        { customerId: 'cust-1', productId: 'p1', quantity: 2 },
        { customerId: 'cust-1', productId: 'p2', quantity: 1 },
      ],
    });
    const { service, emit } = await makeService(prisma);

    const res = await service.createFromCart('user-1', '', false, 'یادداشت تست');

    // جمع‌ها: ۲×۵۰٬۰۰۰ + ۱×۸۰٬۰۰۰
    expect(res.final_total).toBe(180_000);
    expect(res.subtotal).toBe(180_000);
    expect(res.items_count).toBe(2);
    expect(res.status).toBe('PENDING');
    expect(res.can_cancel).toBe(true);
    // تخفیف خطی آیتم اول: (۶۰٬۰۰۰−۵۰٬۰۰۰)×۲
    expect(res.items[0].lineDiscount).toBe(20_000);
    expect(res.items[0].originalPrice).toBe(60_000);
    // برچسب بسته‌بندی آیتم دوم
    expect(res.items[1].itemsPerPackageLabel).toContain('در کارتن');
    // کسر اتمیک موجودی
    expect(prisma.__store.get('p1')?.stock).toBe(3);
    expect(prisma.__store.get('p2')?.stock).toBe(9);
    // سبد خالی شده
    expect(prisma.__cart).toHaveLength(0);
    // رکورد وضعیت اولیه سفارش
    expect(prisma.__createdOrders[0].statusHistory[0].status).toBe('PENDING');
    // رویداد نوتیفیکیشن
    expect(emit).toHaveBeenCalledWith(
      EVENT_ORDER_CREATED,
      expect.objectContaining({ userId: 'user-1', orderId: res.id })
    );
  });

  it('سبد خالی ← BadRequest(CART_EMPTY) و هیچ اثر جانبی', async () => {
    const prisma = buildPrismaMock({ user: USER, customer: CUSTOMER, products: [makeProduct()], cartItems: [] });
    const { service, emit } = await makeService(prisma);

    await expect(service.createFromCart('user-1', '', false)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.__createdOrders).toHaveLength(0);
    expect(prisma.__store.get('p1')?.stock).toBe(5);
    expect(emit).not.toHaveBeenCalled();
  });

  it('مشتری تاییدنشده ← Forbidden و تراکنش اصلاً شروع نمی‌شود', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: { ...CUSTOMER, status: 'PENDING' },
      products: [makeProduct()],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 1 }],
    });
    const { service, emit } = await makeService(prisma);

    await expect(service.createFromCart('user-1', '', false)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.__createdOrders).toHaveLength(0);
    expect(prisma.__cart).toHaveLength(1); // سبد دست‌نخورده
    expect(emit).not.toHaveBeenCalled();
  });

  it('کالای غیرفعال ← 422 با warning از نوع product_inactive و صفر اثر جانبی', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ isActive: false })],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 1 }],
    });
    const { service, emit } = await makeService(prisma);

    const err = await catchErr(service.createFromCart('user-1', '', false));
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    const body = err?.getResponse?.() as { error: string; warnings: Array<Record<string, unknown>> };
    expect(body.error).toBe('STOCK_UNAVAILABLE');
    expect(body.warnings[0]).toMatchObject({ type: 'product_inactive', product_id: 'p1' });
    expect(prisma.__createdOrders).toHaveLength(0);
    expect(prisma.__cart).toHaveLength(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('کمبود موجودی هنگام خواندن ← 422 با available_stock، بدون کسر و بدون پاک شدن سبد', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ stock: 1 })],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 2 }],
    });
    const { service } = await makeService(prisma);

    const err = await catchErr(service.createFromCart('user-1', '', false));
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    const body = err?.getResponse?.() as { error: string; warnings: Array<Record<string, unknown>> };
    expect(body.warnings[0]).toMatchObject({ type: 'stock_unavailable', product_id: 'p1', available_stock: 1 });
    expect(prisma.__store.get('p1')?.stock).toBe(1);
    expect(prisma.__cart).toHaveLength(1);
    expect(prisma.__createdOrders).toHaveLength(0);
  });

  it('مسابقه خرید همزمان (موجودی بین خواندن و کسر عوض شود) ← 422 و oversell ممنوع', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ stock: 2 })],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 2 }],
    });
    // در لحظه آپدیت، موجودی ۱ شده (یک خریدار دیگر ۱ واحد برداشته)
    prisma.__race.set('p1', 1);
    const { service, emit } = await makeService(prisma);

    const err = await catchErr(service.createFromCart('user-1', '', false));
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.__store.get('p1')?.stock).toBe(1); // نه کسر اضافه (فقط اثر خریدار دیگر)
    expect(prisma.__createdOrders).toHaveLength(0);
    expect(prisma.__cart).toHaveLength(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it('خطای نوتیفیکیشن نباید خرید را خراب کند (non-blocking emit)', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct()],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 1 }],
    });
    const emit = jest.fn().mockImplementation(() => {
      throw new Error('sms provider down');
    });
    const { service } = await makeService(prisma, emit);

    const res = await service.createFromCart('user-1', '', false);
    expect(res.status).toBe('PENDING');
    expect(prisma.__store.get('p1')?.stock).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('مسیر پولی: لغو سفارش (cancelOrder) — برگشت اتمیک موجودی', () => {
  it('لغو موفق سفارش PENDING: وضعیت + دلیل + برگشت موجودی + رویداد', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ stock: 3 })],
      orders: [pendingOrder()],
    });
    const { service, emit } = await makeService(prisma);

    const res = await service.cancelOrder('user-1', 'order-1', 'بازبینی قیمت');

    expect(res.status).toBe('CANCELLED');
    expect(res.cancellation_reason).toBe('بازبینی قیمت');
    expect(res.can_cancel).toBe(false);
    // موجودی برگشته: ۳ + ۲
    expect(prisma.__store.get('p1')?.stock).toBe(5);
    // رویداد تغییر وضعیت به CANCELLED
    expect(emit).toHaveBeenCalledWith(
      EVENT_ORDER_STATUS_CHANGED,
      expect.objectContaining({ previousStatus: 'PENDING', newStatus: 'CANCELLED' })
    );
  });

  it('سفارش مشتری دیگر ← BadRequest و موجودی دست‌نخورده', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ stock: 3 })],
      orders: [pendingOrder({ customerId: 'cust-HASHEMI' })],
    });
    const { service } = await makeService(prisma);

    await expect(service.cancelOrder('user-1', 'order-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.__store.get('p1')?.stock).toBe(3);
  });

  it('لغو سفارش غیر-PENDING ← خطای کسب‌وکاری تمیز BadRequest (نه ۵۰۰ خام) و موجودی برنمی‌گردد', async () => {
    // رگرسیون یافته ۶-۲: Prisma در آپدیت شرطی ناموفق P2025 می‌دهد، نه null —
    // این تست تبدیل P2025→BadRequest را قفل می‌کند (با PostgreSQL واقعی اثبات شد).
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ stock: 3 })],
      orders: [pendingOrder({ status: 'CONFIRMED' })],
    });
    const { service, emit } = await makeService(prisma);

    const err = await catchErr(service.cancelOrder('user-1', 'order-1'));
    expect(err).toBeInstanceOf(BadRequestException);
    expect(String(err?.message)).toContain('قابل لغو نیست');
    expect(prisma.__store.get('p1')?.stock).toBe(3); // موجودی برنگشته
    expect(emit).not.toHaveBeenCalled();
  });

  it('لغو مجدد همان سفارش (idempotency) ← BadRequest و بدون برگشت دوباره موجودی', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ stock: 3 })],
      orders: [pendingOrder()],
    });
    const { service } = await makeService(prisma);

    await service.cancelOrder('user-1', 'order-1'); // لغو اول موفق → stock 5
    const err = await catchErr(service.cancelOrder('user-1', 'order-1')); // لغو دوم
    expect(err).toBeInstanceOf(BadRequestException);
    expect(prisma.__store.get('p1')?.stock).toBe(5); // دوباره اضافه نشده
  });

  it('شناسه ناموجود ← BadRequest', async () => {
    const prisma = buildPrismaMock({ user: USER, customer: CUSTOMER, products: [makeProduct()], orders: [] });
    const { service } = await makeService(prisma);

    await expect(service.cancelOrder('user-1', 'order-404')).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ═══════════════════════════════════════════════════════════════════════
describe('مسیر پولی: سفارش ادمین (createAdminOrder)', () => {
  it('سفارش مهمان موفق: CONFIRMED + orderSource=ADMIN + کسر موجودی + بدون رویداد کاربری', async () => {
    const prisma = buildPrismaMock({ customer: null, products: [makeProduct({ price: 20_000, stock: 10 })] });
    const { service, emit } = await makeService(prisma);

    const res = await service.createAdminOrder(
      'admin-1',
      undefined,
      undefined,
      'آقای رضایی',
      '09121112233',
      undefined,
      [{ productId: 'p1', quantity: 3 }],
      'فروش حضوری',
      'تهران، بازار'
    );

    expect(res.status).toBe('CONFIRMED');
    expect(res.final_total).toBe(60_000);
    expect(res.orderSource).toBe('ADMIN');
    expect(prisma.__store.get('p1')?.stock).toBe(7);
    expect(prisma.__createdOrders[0].guestName).toBe('آقای رضایی');
    expect(prisma.__createdOrders[0].statusHistory[0].changedBy).toBe('admin-1');
    expect(emit).not.toHaveBeenCalled();
  });

  it('کمبود موجودی ← Forbidden و صفر اثر جانبی', async () => {
    const prisma = buildPrismaMock({ products: [makeProduct({ stock: 1 })] });
    const { service } = await makeService(prisma);

    await expect(
      service.createAdminOrder('admin-1', undefined, undefined, 'مهمان', '0912', undefined, [
        { productId: 'p1', quantity: 2 },
      ])
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.__store.get('p1')?.stock).toBe(1);
    expect(prisma.__createdOrders).toHaveLength(0);
  });

  it('بدون customerId و بدون اطلاعات مهمان ← BadRequest', async () => {
    const prisma = buildPrismaMock({ products: [makeProduct()] });
    const { service } = await makeService(prisma);

    await expect(
      service.createAdminOrder('admin-1', undefined, undefined, undefined, undefined, undefined, [
        { productId: 'p1', quantity: 1 },
      ])
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.__createdOrders).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// B19 — Idempotency ثبت سفارش
//   ۱) درخواست اول: سفارش ساخته و کلید ذخیره می‌شود
//   ۲) درخواست تکراری با همان کلید: سفارش دوم ساخته نمی‌شود، همان سفارش با 200 برمی‌گردد
//   ۳) کلید جدید: سفارش جدید (مسیر Repeat Order بسته نمی‌شود)
//   ۴) P2002 از constraint دیگر: کورکورانه «تکراری» فرض نمی‌شود
//   ۵) بدون کلید (کلاینت قدیمی): رفتار قبلی بدون تغییر
// ═══════════════════════════════════════════════════════════════════════
describe('B19 — Idempotency ثبت سفارش (createFromCart)', () => {
  const seed = () =>
    buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ id: 'p1', price: 50_000, stock: 10 })],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 1 }],
    });

  /** شبیه‌سازی مسابقهٔ واقعی: هر دو درخواست پیش از commit، سبد را غیرخالی دیده‌اند */
  const refillCart = (prisma: PrismaDouble) =>
    prisma.__cart.push({ customerId: 'cust-1', productId: 'p1', quantity: 1 });

  it('درخواست اول ← سفارش ساخته و کلید ذخیره می‌شود', async () => {
    const prisma = seed();
    const { service } = await makeService(prisma);

    const res = await service.createFromCart('user-1', '', false, undefined, 'chk-abc');

    expect(prisma.__createdOrders).toHaveLength(1);
    expect(prisma.__createdOrders[0].idempotencyKey).toBe('chk-abc');
    expect(res.id).toBe(prisma.__createdOrders[0].id);
  });

  it('درخواست تکراری با همان کلید ← همان سفارش، بدون سفارش دوم، بدون کسر دوبارهٔ موجودی، بدون رویداد دوم', async () => {
    const prisma = seed();
    const { service, emit } = await makeService(prisma);

    const first = await service.createFromCart('user-1', '', false, undefined, 'chk-dup');
    const stockAfterFirst = prisma.__store.get('p1')?.stock;

    refillCart(prisma);
    const second = await service.createFromCart('user-1', '', false, undefined, 'chk-dup');

    expect(prisma.__createdOrders).toHaveLength(1); // سفارش دوم ساخته نشد
    expect(second.id).toBe(first.id); // همان سفارش اصلی برگشت
    expect(second.orderNumber).toBe(first.orderNumber);
    expect(prisma.__store.get('p1')?.stock).toBe(stockAfterFirst); // موجودی دوباره کسر نشد
    const orderEvents = (emit.mock.calls as unknown[][]).filter((c) => c[0] === EVENT_ORDER_CREATED);
    expect(orderEvents).toHaveLength(1); // نوتیفیکیشن تکراری نرفت
  });

  it('کلید جدید ← سفارش جدید (Repeat Order باید سفارش تازه بسازد)', async () => {
    const prisma = seed();
    const { service } = await makeService(prisma);

    const first = await service.createFromCart('user-1', '', false, undefined, 'chk-1');
    refillCart(prisma);
    const second = await service.createFromCart('user-1', '', false, undefined, 'chk-2');

    expect(prisma.__createdOrders).toHaveLength(2);
    expect(second.id).not.toBe(first.id);
  });

  it('P2002 از constraint دیگر (orderNumber) ← به‌اشتباه «تکراری» فرض نمی‌شود', async () => {
    const prisma = buildPrismaMock({
      user: USER,
      customer: CUSTOMER,
      products: [makeProduct({ id: 'p1', price: 50_000, stock: 10 })],
      cartItems: [{ customerId: 'cust-1', productId: 'p1', quantity: 1 }],
      orderCreateError: p2002(['orderNumber']),
    });
    const { service } = await makeService(prisma);

    await expect(service.createFromCart('user-1', '', false, undefined, 'chk-x')).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError
    );
    expect(prisma.__createdOrders).toHaveLength(0);
  });

  it('بدون کلید (کلاینت قدیمی) ← رفتار قبلی بدون تغییر', async () => {
    const prisma = seed();
    const { service } = await makeService(prisma);

    const res = await service.createFromCart('user-1', '', false);

    expect(prisma.__createdOrders).toHaveLength(1);
    expect(prisma.__createdOrders[0].idempotencyKey).toBeNull();
    expect(res.id).toBeDefined();
  });
});
