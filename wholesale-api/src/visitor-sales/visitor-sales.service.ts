// src/visitor-sales/visitor-sales.service.ts
import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VisitorSalesService {
  private readonly logger = new Logger(VisitorSalesService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string, isAdmin: boolean, dateFrom?: string, dateTo?: string) {
    // dateFrom/dateTo در نسخه فعلی استفاده نمی‌شوند اما امضای endpoint حفظ می‌ماند
    void dateFrom;
    void dateTo;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // فیلتر ویزیتور: فقط سفارشات خودش
    // بعد از migration می‌توان از orderSource استفاده کرد
    //
    // P2-9 — FAIL CLOSED.
    // پیش از این، هر خطایی در probe زیر باعث می‌شد visitorFilter = {} شود؛ یعنی
    // یک ویزیتور معمولی داشبورد «همهٔ سفارشات همه» را می‌دید (نشت داده).
    //
    // چرا آن catch عملاً یک تله بود:
    //   شرط موردنظرش («ستون placedByUserId وجود ندارد») از migration
    //   20260817203724_add_items_per_package به بعد هرگز رخ نمی‌دهد، ولی همان
    //   catch هر خطای دیگری را هم می‌بلعید: قطعی دیتابیس (P1001)، timeout
    //   استخر اتصال (P2024)، و غیره. در آن حالت‌ها دسترسی به‌جای محدود شدن،
    //   «باز» می‌شد.
    //
    // رفتار جدید:
    //   • فیلتر هرگز در اثر خطا خالی نمی‌شود.
    //   • برای ادمین (isAdmin=true) فیلتر {} است و همان‌طور که باید همه را می‌بیند؛
    //     خطای اتصال همان‌جا به‌صورت خطای ۵۰۰ بالا می‌رود (نه دسترسی باز).
    //   • برای ویزیتور، اگر دامنه قابل تعیین نباشد هیچ رکوردی برگردانده نمی‌شود.
    //     این دقیقاً همان الگویی است که getVisitorOrders در همین فایل از قبل
    //     دارد (fail-closed) — یعنی معماری امن موجود حفظ و یکسان‌سازی شد،
    //     نه یک قاعدهٔ تازه.
    const visitorFilter: Prisma.OrderWhereInput = isAdmin ? {} : { placedByUserId: userId };

    if (!isAdmin) {
      // فقط برای ویزیتور probe می‌کنیم تا خطای واقعی اتصال را از «دامنهٔ نامعلوم»
      // تفکیک کنیم. خطا ⇒ fail-closed، بدون باز کردن دسترسی.
      try {
        await this.prisma.order.count({ where: visitorFilter });
      } catch (err) {
        this.logger.error(
          `[VisitorSales] تعیین دامنهٔ ویزیتور ناموفق بود — دسترسی محدود شد (userId=${userId}): ${String(err)}`
        );
        throw new ServiceUnavailableException('تعیین دامنهٔ دسترسی ممکن نشد. لطفاً دوباره تلاش کنید.');
      }
    }

    const [todayStats, weekStats, monthStats, recentOrders] = await Promise.all([
      this.getOrderStats({ ...visitorFilter, createdAt: { gte: todayStart } }),
      this.getOrderStats({ ...visitorFilter, createdAt: { gte: weekStart } }),
      this.getOrderStats({ ...visitorFilter, createdAt: { gte: monthStart } }),
      this.prisma.order.findMany({
        where: visitorFilter,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { items: true, customer: true },
      }),
    ]);

    const mapOrder = (o: Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.storeName || o.guestName || '—',
      itemsCount: o.items?.length || 0,
      totalAmount: o.totalAmount,
      status: o.status,
      statusLabelFa: this.getStatusLabel(o.status),
      placedAtShamsi: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(o.createdAt),
      placedAtRelative: this.getRelativeTime(o.createdAt),
    });

    return {
      today: todayStats,
      thisWeek: weekStats,
      thisMonth: monthStats,
      recentOrders: recentOrders.map(mapOrder),
    };
  }

  private async getOrderStats(where: Prisma.OrderWhereInput) {
    const orders = await this.prisma.order.findMany({
      where: { ...where, status: { not: 'CANCELLED' } },
      include: { items: true },
    });

    const customerIds = new Set(orders.map((o) => o.customerId).filter(Boolean));

    return {
      ordersCount: orders.length,
      totalAmount: orders.reduce((sum, o) => sum + o.totalAmount, 0),
      customersServed: customerIds.size,
      itemsSold: orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    };
  }

  async searchCustomers(query: string, limit = 10) {
    if (!query || query.length < 2) return { customers: [] };

    const customers = await this.prisma.customer.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { storeName: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { user: { phone: { contains: query } } },
        ],
      },
      take: limit,
      include: {
        user: { select: { phone: true } },
        orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });

    return {
      customers: customers.map((c) => ({
        id: c.id,
        storeName: c.storeName || '—',
        ownerName: [c.firstName, c.lastName].filter(Boolean).join(' ') || '—',
        phone: c.user?.phone || '—',
        address: [c.province, c.city, c.address].filter(Boolean).join('، ') || '—',
        businessType: c.businessType || null,
        lastOrderDate: c.orders[0] ? new Intl.DateTimeFormat('fa-IR').format(c.orders[0].createdAt) : null,
        totalOrders: 0, // TODO: count
      })),
    };
  }

  async createVisitorOrder(
    userId: string,
    userName: string,
    data: {
      customerId: string;
      items: { productId: string; quantity: number }[];
      visitorNote?: string;
      customerNote?: string;
      deliveryAddress?: string;
    }
  ) {
    // اعتبارسنجی مشتری
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId },
      include: { user: true },
    });
    if (!customer || customer.status !== 'APPROVED') {
      throw new ForbiddenException('مشتری تایید نشده');
    }

    // اعتبارسنجی اولیه محصولات (قبل از تراکنش برای خطاهای واضح)
    const productIds = data.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new ForbiddenException(`محصول ${item.productId} یافت نشد`);
      }
      if (!product.isActive) {
        throw new ForbiddenException(`محصول ${product.name} غیرفعال است`);
      }
    }

    const orderNumber = `ORD-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 1000)}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // خواندن محصولات داخل تراکنش (بدون قفل db؛ ایمنی کافی از طریق decrement شرطی انجام می‌شود)
        const lockedProducts = await tx.product.findMany({
          where: { id: { in: productIds } },
        });
        const lockedProductMap = new Map(lockedProducts.map((p) => [p.id, p]));

        // بررسی موجودی داخل تراکنش
        let subtotal = 0;
        const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

        for (const item of data.items) {
          const product = lockedProductMap.get(item.productId);
          if (!product || !product.isActive) {
            throw new ForbiddenException(`محصول ${product?.name || item.productId} ناموجود یا غیرفعال است`);
          }
          if (product.stock < item.quantity) {
            throw new ForbiddenException(`موجودی ${product.name} کافی نیست. موجودی فعلی: ${product.stock}`);
          }

          const unitPrice = product.price;
          const originalPrice = product.oldPrice || product.price;
          subtotal += unitPrice * item.quantity;

          orderItemsData.push({
            productId: product.id,
            productName: product.name,
            productImageUrl: product.imageUrl,
            productUnit: product.unit,
            productPrice: unitPrice,
            originalPrice,
            quantity: item.quantity,
            lineTotal: unitPrice * item.quantity,
            itemsPerPackageLabel: product.itemsPerPackage
              ? `${product.itemsPerPackage} عدد` + (product.packageType ? ` در ${product.packageType}` : '')
              : null,
          });
        }

        // کاهش موجودی با شرط ایمنی و اتمیک (updateMany اجازه‌ی فیلتر در where را می‌دهد)
        for (const item of data.items) {
          const res = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (res.count === 0) {
            const p = lockedProductMap.get(item.productId);
            throw new ForbiddenException(
              `موجودی ${p?.name || item.productId} کافی نیست. موجودی فعلی: ${p?.stock ?? '—'}`
            );
          }
        }

        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: data.customerId,
            status: 'PENDING',
            paymentMethod: 'CASH_ON_DELIVERY',
            paymentStatus: 'UNPAID',
            subtotalAmount: subtotal,
            totalAmount: subtotal,
            note: data.customerNote,
            alternativeAddress: data.deliveryAddress || null,
            orderSource: 'VISITOR_IN_PERSON',
            placedByUserId: userId,
            placedByName: userName,
            visitorNote: data.visitorNote || null,
            statusHistory: { create: { status: 'PENDING', note: 'سفارش حضوری ثبت شد', changedBy: userId } },
            items: { createMany: { data: orderItemsData } },
          },
          include: { items: true, customer: true, statusHistory: true },
        });

        return order;
      });
    } catch (err) {
      console.error('[VisitorSales] createVisitorOrder failed:', err);
      if (err instanceof ForbiddenException) throw err;
      throw new InternalServerErrorException(
        'ثبت سفارش انجام نشد. ' + (err instanceof Error ? err.message : String(err))
      );
    }
  }

  async getVisitorOrders(userId: string, isAdmin: boolean, page = 1, pageSize = 20, status?: string) {
    // فیلتر ساده: فقط سفارشاتی که placedByUserId دارند (حضوری)
    // بعد از migration کامل می‌توان از orderSource استفاده کرد
    const where: Prisma.OrderWhereInput = {};
    if (!isAdmin) where.placedByUserId = userId;
    if (status && status !== 'all') where.status = status as OrderStatus;

    let items: Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>[];
    let total: number;
    try {
      [total, items] = await this.prisma.$transaction([
        this.prisma.order.count({ where }),
        this.prisma.order.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          include: { items: true, customer: true },
        }),
      ]);
    } catch {
      // فیلد orderSource وجود ندارد — لیست خالی برگردان
      console.warn('[VisitorSales] orderSource field not found, returning empty list');
      items = [];
      total = 0;
    }

    return {
      data: items.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.storeName || o.guestName || '—',
        itemsCount: o.items.length,
        totalAmount: o.totalAmount,
        status: o.status,
        statusLabelFa: this.getStatusLabel(o.status),
        placedAtShamsi: new Intl.DateTimeFormat('fa-IR').format(o.createdAt),
        placedAtRelative: this.getRelativeTime(o.createdAt),
        placedByName: o.placedByName || null,
      })),
      meta: { page, pageSize, total, lastPage: Math.ceil(total / pageSize) },
    };
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'در انتظار بررسی',
      CONFIRMED: 'تایید شده',
      PROCESSING: 'در حال آماده‌سازی',
      SHIPPED: 'ارسال شده',
      DELIVERED: 'تحویل شده',
      CANCELLED: 'لغو شده',
    };
    return labels[status] || status;
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'همین الان';
    if (diffMin < 60) return `${diffMin} دقیقه پیش`;
    if (diffHrs < 24) return `${diffHrs} ساعت پیش`;
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 7) return `${diffDays} روز پیش`;
    return new Intl.DateTimeFormat('fa-IR').format(date);
  }
}
