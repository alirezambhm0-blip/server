import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderStatus, OrderStatusHistory, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EVENT_ORDER_CREATED,
  OrderCreatedEvent,
  EVENT_ORDER_STATUS_CHANGED,
  OrderStatusChangedEvent,
} from '../notifications/events/events';

/**
 * سفارش همراه با روابط لازم برای ساخت پاسخ؛ statusHistory در برخی کوئری‌ها include نمی‌شود.
 * Perf: رابطه customer عمداً به ۳ فیلد آدرس محدود شده — mapOrderToResponse فقط همین‌ها را مصرف می‌کند؛
 * اگر فیلد بیشتری لازم شد، همین‌جا select را اضافه کن (نه بازگشت به include کامل).
 */
type OrderForResponse = Omit<
  Prisma.OrderGetPayload<{
    include: {
      items: true;
      customer: { select: { province: true; city: true; address: true } };
      statusHistory: true;
    };
  }>,
  'statusHistory'
> & { statusHistory?: OrderStatusHistory[] };

/**
 * نکته مهم درباره قفل‌گذاری روی موجودی کالا:
 * Prisma آرگومان «lock» (مثل pessimistic_write) را در findMany پشتیبانی نمی‌کند — نه در تایپ و نه در runtime.
 * اتمی‌بودن کسر موجودی با «آپدیت شرطی» تضمین می‌شود: where: { id, stock: { gte: qty } }
 * اگر بین خواندن کالا و کسر، موجودی تغییر کند، این آپدیت ۰ رکورد اعمال می‌کند (خطای P2025)
 * که به همان خطای کسب‌وکاری STOCK_UNAVAILABLE تبدیل می‌شود و کل تراکنش rollback می‌شود؛
 * در نتیجه فروش بیش از موجودی (oversell) غیرممکن است.
 */

export interface TimelineStep {
  status: string;
  label_fa: string;
  description_fa: string;
  timestamp?: Date | null;
  timestamp_shamsi?: string | null;
  is_completed?: boolean;
  is_current?: boolean;
}

interface CartWarning {
  type: string;
  product_id: string;
  product_name: string;
  available_stock?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    @Inject(EventEmitter2) private eventEmitter: EventEmitter2
  ) {}

  private fa(n: number): string {
    return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  }

  private generateOrderNumber(): string {
    return `ORD-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 1000)}`;
  }

  private getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      PENDING: 'در انتظار بررسی',
      CONFIRMED: 'تایید شده',
      PROCESSING: 'در حال آماده‌سازی',
      SHIPPED: 'ارسال شده',
      DELIVERED: 'تحویل شده',
      CANCELLED: 'لغو شده',
    };
    return labels[status] || status;
  }

  private getStatusColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      PENDING: 'warning',
      CONFIRMED: 'info',
      PROCESSING: 'warning',
      SHIPPED: 'info',
      DELIVERED: 'success',
      CANCELLED: 'error',
    };
    return colors[status] || 'default';
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'همین الان';
    if (diffMin < 60) return `${this.fa(diffMin)} دقیقه پیش`;
    if (diffHrs < 24) return `${this.fa(diffHrs)} ساعت پیش`;
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 7) return `${this.fa(diffDays)} روز پیش`;
    if (diffDays < 30) return `${this.fa(Math.floor(diffDays / 7))} هفته پیش`;
    return new Intl.DateTimeFormat('fa-IR').format(date);
  }

  private buildTimeline(
    statusHistory: OrderStatusHistory[],
    currentStatus: OrderStatus,
    cancellationReason?: string
  ): TimelineStep[] {
    const allSteps: { status: OrderStatus; label_fa: string; description_fa: string }[] = [
      { status: 'PENDING', label_fa: 'ثبت سفارش', description_fa: 'سفارش شما با موفقیت ثبت شد' },
      { status: 'CONFIRMED', label_fa: 'تایید سفارش', description_fa: 'سفارش شما توسط تیم ما تایید شد' },
      { status: 'PROCESSING', label_fa: 'آماده‌سازی', description_fa: 'سفارش شما در حال آماده‌سازی است' },
      { status: 'SHIPPED', label_fa: 'ارسال', description_fa: 'سفارش شما ارسال شد و در راه است' },
      { status: 'DELIVERED', label_fa: 'تحویل شده', description_fa: 'سفارش شما تحویل داده شد' },
    ];

    // If cancelled, show steps up to cancellation + cancelled step
    if (currentStatus === 'CANCELLED') {
      const historyMap = new Map(statusHistory.map((h) => [h.status, h] as const));
      const steps: TimelineStep[] = [];

      for (const step of allSteps) {
        const historyEntry = historyMap.get(step.status);
        if (historyEntry) {
          steps.push({
            status: step.status,
            label_fa: step.label_fa,
            description_fa: step.description_fa,
            timestamp: historyEntry.timestamp,
            timestamp_shamsi: new Intl.DateTimeFormat('fa-IR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(historyEntry.timestamp),
            is_completed: true,
            is_current: false,
          });
        }
        if (step.status === 'PENDING') break; // Only show PENDING for cancelled orders that were never confirmed
      }

      // Add cancelled step
      const cancelEntry = historyMap.get('CANCELLED');
      steps.push({
        status: 'CANCELLED',
        label_fa: 'لغو شده',
        description_fa: cancellationReason || 'این سفارش لغو شد',
        timestamp: cancelEntry?.timestamp || new Date(),
        timestamp_shamsi: cancelEntry
          ? new Intl.DateTimeFormat('fa-IR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(cancelEntry.timestamp)
          : null,
        is_completed: true,
        is_current: true,
      });

      return steps;
    }

    // Normal flow
    const historyMap = new Map(statusHistory.map((h) => [h.status, h] as const));
    const currentIdx = allSteps.findIndex((s) => s.status === currentStatus);

    return allSteps.map((step, idx) => {
      const historyEntry = historyMap.get(step.status);
      const isCompleted = idx <= currentIdx && !!historyEntry;
      const isCurrent = step.status === currentStatus;

      return {
        status: step.status,
        label_fa: step.label_fa,
        description_fa: step.description_fa,
        timestamp: historyEntry?.timestamp || null,
        timestamp_shamsi: historyEntry?.timestamp
          ? new Intl.DateTimeFormat('fa-IR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(historyEntry.timestamp)
          : null,
        is_completed: isCompleted,
        is_current: isCurrent,
      };
    });
  }

  private mapOrderToResponse(o: OrderForResponse) {
    // ساخت آدرس کامل از فیلدهای جداگانه مشتری
    let customerAddress = 'آدرس ثبت نشده';
    if (o.customer) {
      const parts = [o.customer.province, o.customer.city, o.customer.address].filter(Boolean);
      customerAddress = parts.length > 0 ? parts.join('، ') : 'آدرس ثبت نشده';
    }
    const deliveryAddress = o.alternativeAddress || customerAddress;
    const items = o.items || [];
    const subtotal = o.subtotalAmount;
    const totalAmount = o.totalAmount;
    const totalDiscount = subtotal - totalAmount;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      order_number: o.orderNumber,
      status: o.status,
      status_label_fa: this.getStatusLabel(o.status),
      status_color: this.getStatusColor(o.status),
      paymentMethod: o.paymentMethod,
      payment_method_label_fa: 'پرداخت هنگام تحویل',
      placed_at: o.createdAt,
      placed_at_shamsi: new Intl.DateTimeFormat('fa-IR').format(o.createdAt),
      placed_at_relative: this.getRelativeTime(o.createdAt),
      delivery_address: deliveryAddress,
      delivery_address_short: deliveryAddress.length > 50 ? deliveryAddress.slice(0, 50) + '...' : deliveryAddress,
      is_alternative_address: !!o.alternativeAddress,
      customer_note: o.note,
      cancellation_reason: o.cancellationReason,
      subtotal,
      total_discount: totalDiscount > 0 ? totalDiscount : 0,
      final_total: totalAmount,
      items_count: items.length || 0,
      total_quantity: items.reduce((sum: number, i) => sum + (i.quantity || 0), 0) || 0,
      items: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
        unitLabel: item.productUnit,
        unitPrice: item.productPrice,
        originalPrice: item.originalPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        itemsPerPackageLabel: item.itemsPerPackageLabel || null,
        lineDiscount:
          item.originalPrice && item.originalPrice > item.productPrice
            ? (item.originalPrice - item.productPrice) * item.quantity
            : 0,
        productStillAvailable: !!item.productId,
      })),
      timeline: o.statusHistory ? this.buildTimeline(o.statusHistory, o.status, o.cancellationReason ?? undefined) : [],
      invoice: {
        has_invoice: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status),
        invoice_number: `INV-${o.orderNumber}`,
        invoice_url: null,
        invoice_image_url: null,
      },
      can_cancel: o.status === 'PENDING',
      can_reorder: o.status !== 'PENDING',
      orderSource: o.orderSource || 'APP',
      placedByName: o.placedByName || null,
    };
  }

  async getCustomerAndCheck(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user || !user.isActive || !user.customer) throw new ForbiddenException('دسترسی محدود');
    return { user, customer: user.customer };
  }

  /**
   * ثبت سفارش از سبد خرید در یک تراکنش دیتابیس واحد:
   * خواندن کالاها → بررسی موجودی/فعال‌بودن → ساخت سفارش و آیتم‌ها → کسر موجودی با آپدیت شرطی اتمیک → پاک شدن سبد.
   * هر خطا = rollback کامل؛ نیمه‌سفارش یا کسر موجودی بدون سفارش غیرممکن است.
   */
  async createFromCart(
    userId: string,
    deliveryAddress: string,
    isAlternativeAddress: boolean,
    customerNote?: string,
    /**
     * B19 — کلید یکتای تولیدشده در کلاینت (cart.tsx) برای هر تلاش واقعی checkout.
     * اگر فرستاده نشود (کلاینت قدیمی) رفتار دقیقاً مثل قبل می‌ماند: فیلد NULL است
     * و چون NULLها در PostgreSQL با هم برخورد نمی‌کنند، @unique اثری ندارد.
     */
    idempotencyKey?: string
  ) {
    const { customer } = await this.getCustomerAndCheck(userId);
    if (customer.status !== 'APPROVED') throw new ForbiddenException('حساب تایید نشده');

    const cart = await this.prisma.cartItem.findMany({
      where: { customerId: customer.id },
      include: { product: true },
    });
    if (cart.length === 0) throw new BadRequestException('CART_EMPTY');

    // B19 — عمداً در یک متغیر گرفته می‌شود و نه inline: افزودن حلقهٔ .catch به انتهای
    // زنجیره، prettier را وادار می‌کرد کل بدنهٔ ~۱۰۰ خطی تراکنش را re-indent کند.
    const orderPromise = this.prisma
      .$transaction(async (tx) => {
        const productIds = cart.map((i) => i.productId).filter(Boolean);
        if (productIds.length === 0) throw new BadRequestException('CART_EMPTY');

        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        const warnings: CartWarning[] = [];

        for (const item of cart) {
          const p = productMap.get(item.productId);
          if (!p || !p.isActive) {
            warnings.push({
              type: 'product_inactive',
              product_id: item.productId,
              product_name: p?.name || item.productId,
            });
          } else if (p.stock < item.quantity) {
            warnings.push({
              type: 'stock_unavailable',
              product_id: item.productId,
              product_name: p.name,
              available_stock: p.stock,
            });
          }
        }

        if (warnings.length > 0) {
          throw new UnprocessableEntityException({ error: 'STOCK_UNAVAILABLE', warnings });
        }

        let subtotal = 0;
        const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

        for (const item of cart) {
          const p = productMap.get(item.productId)!;
          const unitPrice = p.price;
          const originalPrice = p.oldPrice || p.price;
          subtotal += unitPrice * item.quantity;

          orderItemsData.push({
            productId: p.id,
            productName: p.name,
            productImageUrl: p.imageUrl,
            productUnit: p.unit,
            productPrice: unitPrice,
            originalPrice,
            quantity: item.quantity,
            lineTotal: unitPrice * item.quantity,
            itemsPerPackageLabel: p.itemsPerPackage
              ? `${p.itemsPerPackage} عدد` + (p.packageType ? ` در ${p.packageType}` : '')
              : null,
          });

          try {
            await tx.product.update({
              where: {
                id: p.id,
                stock: { gte: item.quantity },
              },
              data: { stock: { decrement: item.quantity } },
            });
          } catch (e) {
            // مسابقه خرید همزمان: اگر بین خواندن کالا و کسر، موجودی عوض شده باشد، آپدیت شرطی ۰ رکورد می‌زند (P2025)
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
              throw new UnprocessableEntityException({
                error: 'STOCK_UNAVAILABLE',
                warnings: [{ type: 'stock_unavailable', product_id: p.id, product_name: p.name }],
              });
            }
            throw e;
          }
        }

        const order = await tx.order.create({
          data: {
            orderNumber: this.generateOrderNumber(),
            idempotencyKey: idempotencyKey ?? null,
            customerId: customer.id,
            status: 'PENDING',
            paymentMethod: 'CASH_ON_DELIVERY',
            paymentStatus: 'UNPAID',
            subtotalAmount: subtotal,
            totalAmount: subtotal,
            note: customerNote,
            alternativeAddress: isAlternativeAddress ? deliveryAddress : null,
            statusHistory: { create: { status: 'PENDING', note: 'سفارش ثبت شد' } },
            items: {
              createMany: { data: orderItemsData },
            },
          },
          include: { items: true, customer: true, statusHistory: true },
        });

        await tx.cartItem.deleteMany({ where: { customerId: customer.id } });
        return this.mapOrderToResponse(order);
      })
      .then((result) => {
        try {
          this.eventEmitter.emit(EVENT_ORDER_CREATED, new OrderCreatedEvent(userId, result.id, result.orderNumber));
        } catch {
          // Notification failure must not break order placement
        }
        return result;
      });

    // B19 — اگر همان کلید قبلاً سفارش ساخته باشد، تراکنش کامل rollback می‌شود
    // (کسر موجودی هم برمی‌گردد) و سفارش اصلیِ موجود برگردانده می‌شود.
    // عمداً .catch روی promiseٔ جداست: هندلر .then بالا روی rejection اجرا نمی‌شود،
    // پس EVENT_ORDER_CREATED برای درخواست تکراری دوباره صادر نمی‌شود.
    return orderPromise.catch(async (e) => {
      const duplicate = await this.resolveIdempotentDuplicate(e, idempotencyKey, customer.id);
      if (duplicate) return duplicate;
      throw e;
    });
  }

  /**
   * B19 — تشخیص «درخواست تکراری» از روی نقض @unique ستون idempotencyKey.
   *
   * چرا target بررسی می‌شود و کورکورانه هر P2002 پذیرفته نمی‌شود:
   * مدل Order بیش از یک constraint یکتا دارد (orderNumber هم @unique است).
   * اگر هر P2002 را «تکراری» فرض کنیم، یک تصادف orderNumber می‌تواند سفارش
   * نامربوطی را به کاربر برگرداند.
   *
   * در صورت تطابق: سفارش اصلی با HTTP 200 برمی‌گردد (نه 201 و نه 409).
   */
  private async resolveIdempotentDuplicate(e: unknown, idempotencyKey: string | undefined, customerId: string) {
    if (!idempotencyKey) return null;
    if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return null;

    const target = (e.meta as { target?: unknown } | undefined)?.target;
    // Prisma مقدار target را گاهی رشته (نام constraint) و گاهی آرایهٔ نام فیلد می‌دهد
    const targetStr = Array.isArray(target)
      ? target.map((t) => (typeof t === 'string' ? t : '')).join(',')
      : typeof target === 'string'
        ? target
        : '';
    if (!targetStr.toLowerCase().includes('idempotencykey')) return null;

    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: {
        items: true,
        customer: { select: { province: true, city: true, address: true } },
        statusHistory: true,
      },
    });
    if (!existing) return null; // تراکنش رقیب هم rollback شده ⇒ خطای اصلی پرتاب می‌شود

    // محافظت در برابر نشت اطلاعات: کلیدی که به مشتری دیگری تعلق دارد هرگز برنمی‌گردد.
    if (existing.customerId !== customerId) {
      throw new ConflictException('کلید ارسال‌شده تکراری است');
    }
    return this.mapOrderToResponse(existing);
  }

  async listCustomerOrders(userId: string, filter: string = 'all', page = 1, pageSize = 10) {
    const { customer } = await this.getCustomerAndCheck(userId);
    const where: Prisma.OrderWhereInput = { customerId: customer.id };
    if (filter === 'active') where.status = { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] };
    else if (filter === 'delivered') where.status = 'DELIVERED';
    else if (filter === 'cancelled') where.status = 'CANCELLED';

    const [total, items, allCounts] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: true, customer: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { customerId: customer.id },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);

    const counts_by_filter: { all: number; active: number; delivered: number; cancelled: number } = {
      all: total,
      active: 0,
      delivered: 0,
      cancelled: 0,
    };
    allCounts.forEach((c) => {
      const count = c._count && typeof c._count === 'object' ? c._count._all || 0 : 0;
      if (['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(c.status)) {
        counts_by_filter.active += count;
      } else if (c.status === 'DELIVERED') {
        counts_by_filter.delivered = count;
      } else if (c.status === 'CANCELLED') {
        counts_by_filter.cancelled = count;
      }
    });

    return {
      data: items.map((o) => this.mapOrderToResponse(o)),
      meta: { current_page: page, last_page: Math.ceil(total / pageSize), per_page: pageSize, total, counts_by_filter },
    };
  }

  async getOrder(userId: string, orderId: string) {
    const { customer } = await this.getCustomerAndCheck(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: customer.id },
      include: { items: true, statusHistory: { orderBy: { timestamp: 'asc' } }, customer: true },
    });
    if (!order) throw new NotFoundException('سفارش یافت نشد');
    return this.mapOrderToResponse(order);
  }

  async getLatestOrder(userId: string) {
    const { customer } = await this.getCustomerAndCheck(userId);
    const o = await this.prisma.order.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true, customer: true },
    });
    return o ? this.mapOrderToResponse(o) : null;
  }

  async getActiveOrders(userId: string) {
    const { customer } = await this.getCustomerAndCheck(userId);
    const orders = await this.prisma.order.findMany({
      where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      include: { items: true, customer: true },
    });
    return orders.map((o) => this.mapOrderToResponse(o));
  }

  async cancelOrder(userId: string, orderId: string, reason?: string) {
    const { customer } = await this.getCustomerAndCheck(userId);

    return this.prisma
      .$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (!order || order.customerId !== customer.id) {
          throw new BadRequestException('این سفارش یافت نشد یا متعلق به شما نیست');
        }

        // لغو اتمیک: شرط status:'PENDING' داخل where است تا لغو موازی/دوباره‌کاری فقط یک‌بار موفق شود.
        // نکته: اگر رکورد مطابق شرط نباشد، Prisma خطای P2025 پرتاب می‌کند (نه null) — پس catch می‌کنیم.
        let updated: Prisma.OrderGetPayload<{ include: { items: true; customer: true; statusHistory: true } }>;
        try {
          updated = await tx.order.update({
            where: {
              id: orderId,
              customerId: customer.id,
              status: 'PENDING',
            },
            data: {
              status: 'CANCELLED',
              cancellationReason: reason,
              statusHistory: { create: { status: 'CANCELLED', note: reason } },
            },
            include: { items: true, customer: true, statusHistory: true },
          });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
            throw new BadRequestException('این سفارش قابل لغو نیست یا قبلاً لغو شده است');
          }
          throw e;
        }

        for (const item of order.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }

        return this.mapOrderToResponse(updated);
      })
      .then((result) => {
        try {
          this.eventEmitter.emit(
            EVENT_ORDER_STATUS_CHANGED,
            new OrderStatusChangedEvent(userId, orderId, result.orderNumber, 'PENDING', 'CANCELLED')
          );
        } catch {
          /* non-blocking */
        }
        return result;
      });
  }

  async getInvoice(userId: string, orderId: string) {
    const order = await this.getOrder(userId, orderId);
    if (!order.invoice.has_invoice) throw new BadRequestException('فاکتور هنوز صادر نشده است');
    return {
      ...order,
      seller: {
        name: 'بنکو مارکت',
        address: 'تهران، بازار بزرگ، مجتمع تجاری بنکو',
        phone: '۰۲۱-۱۲۳۴۵۶۷۸',
        website: 'www.bonko.ir',
      },
    };
  }

  // --- متدهای ادمین ---
  async listAll(page = 1, pageSize = 20, status?: OrderStatus) {
    const where: Prisma.OrderWhereInput = status ? { status } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { items: true, customer: { include: { user: true } } },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * تغییر وضعیت سفارش (ادمین) — نکات رفتاری:
   * - اگر status=DELIVERED و paymentStatus داده نشده باشد، پرداخت خودکار PAID می‌شود.
   * - فقط در «تغییر واقعی وضعیت» رکورد statusHistory ساخته و رویداد OrderStatusChanged (نوتیفیکیشن) emit می‌شود.
   */
  async updateStatus(orderId: string, status?: OrderStatus, paymentStatus?: PaymentStatus) {
    const exists = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!exists) throw new NotFoundException();

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: status || undefined,
        paymentStatus: paymentStatus || (status === 'DELIVERED' ? 'PAID' : undefined),
        statusHistory:
          status && status !== exists.status
            ? {
                create: { status, note: 'تغییر وضعیت توسط مدیریت' },
              }
            : undefined,
      },
    });

    // Emit status change event if status actually changed
    if (status && status !== exists.status && exists.customerId) {
      try {
        this.eventEmitter.emit(
          EVENT_ORDER_STATUS_CHANGED,
          new OrderStatusChangedEvent(exists.customerId, orderId, exists.orderNumber, exists.status, status)
        );
      } catch {
        /* non-blocking */
      }
    }

    return updated;
  }

  async hardDelete(id: string) {
    const exists = await this.prisma.order.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }

  // ثبت سفارش توسط ادمین
  async createAdminOrder(
    adminUserId: string,
    adminCustomerId: string | undefined,
    customerId: string | undefined,
    guestName: string | undefined,
    guestPhone: string | undefined,
    newCustomer: { firstName: string; phone: string; storeName: string; lastName: string } | undefined,
    items: { productId: string; quantity: number }[],
    note?: string,
    deliveryAddress?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      // اگر مشتری جدید باید ساخته شود
      let finalCustomerId: string | undefined = customerId;

      if (newCustomer) {
        // ساخت کاربر جدید
        const newUser = await tx.user.create({
          data: {
            phone: newCustomer.phone,
            isActive: true,
            role: 'CUSTOMER',
          },
        });

        // ساخت مشتری جدید
        const newCustomerRecord = await tx.customer.create({
          data: {
            userId: newUser.id,
            firstName: newCustomer.firstName,
            lastName: newCustomer.lastName,
            storeName: newCustomer.storeName,
            status: 'APPROVED',
            onboardingCompleted: true,
          },
        });

        finalCustomerId = newCustomerRecord.id;
      }

      if (!finalCustomerId && !guestName) {
        throw new BadRequestException('یا customerId یا اطلاعات مهمان باید ارائه شود');
      }

      // خواندن محصولات (قفل‌گذاری با آپدیت شرطی اتمیک در زمان کسر موجودی انجام می‌شود)
      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      // بررسی موجودی
      for (const item of items) {
        const p = productMap.get(item.productId);
        if (!p || !p.isActive || p.stock < item.quantity) {
          throw new ForbiddenException(`موجودی ${p?.name || item.productId} کافی نیست`);
        }
      }

      // محاسبه مبلغ کل
      let subtotal = 0;
      const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

      for (const item of items) {
        const p = productMap.get(item.productId)!;
        const unitPrice = p.price;
        const originalPrice = p.oldPrice || p.price;
        subtotal += unitPrice * item.quantity;

        orderItemsData.push({
          productId: p.id,
          productName: p.name,
          productImageUrl: p.imageUrl,
          productUnit: p.unit,
          productPrice: unitPrice,
          originalPrice,
          quantity: item.quantity,
          lineTotal: unitPrice * item.quantity,
          itemsPerPackageLabel: p.itemsPerPackage
            ? `${p.itemsPerPackage} عدد` + (p.packageType ? ` در ${p.packageType}` : '')
            : null,
        });

        // کاهش موجودی
        try {
          await tx.product.update({
            where: {
              id: p.id,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
        } catch (e) {
          // مسابقه خرید همزمان: آپدیت شرطی ۰ رکورد زد (P2025) یعنی موجودی بین خواندن و کسر عوض شده
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
            throw new ForbiddenException(`موجودی ${p.name} کافی نیست`);
          }
          throw e;
        }
      }

      const orderNumber = this.generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: finalCustomerId || null,
          guestName: finalCustomerId ? null : guestName,
          guestPhone: finalCustomerId ? null : guestPhone,
          status: 'CONFIRMED',
          paymentMethod: 'CASH_ON_DELIVERY',
          paymentStatus: 'UNPAID',
          subtotalAmount: subtotal,
          totalAmount: subtotal,
          note: note || 'ثبت توسط ادمین',
          alternativeAddress: deliveryAddress || null,
          orderSource: 'ADMIN',
          placedByUserId: adminUserId,
          placedByName: adminCustomerId ? `ادمین ${adminCustomerId.slice(0, 8)}` : 'ادمین',
          statusHistory: {
            create: {
              status: 'CONFIRMED',
              note: 'سفارش توسط ادمین ثبت شد',
              changedBy: adminUserId,
            },
          },
          items: {
            createMany: { data: orderItemsData },
          },
        },
        include: { items: true, customer: true, statusHistory: true },
      });

      return this.mapOrderToResponse(order);
    });
  }
}
