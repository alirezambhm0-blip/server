import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerStatus, NotificationTargetType, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  async ensureAdmin(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u || u.role !== 'ADMIN') {
      throw new ForbiddenException('دسترسی ادمین لازم است');
    }
    return u;
  }

  async dashboardStats() {
    const def = (p: Promise<number>) => p.then((v) => v).catch(() => 0);

    const [users, customers, orders, pendingOrders, products, pendingApprovals] = await Promise.all([
      def(this.prisma.user.count()),
      def(this.prisma.customer.count()),
      def(this.prisma.order.count()),
      def(this.prisma.order.count({ where: { status: 'PENDING' } })),
      def(this.prisma.product.count({ where: { isActive: true } })),
      def(this.prisma.customer.count({ where: { status: 'PENDING' } })),
    ]);

    let revenue = 0;
    let cost = 0;
    let paidOrdersCount = 0;

    try {
      const paidOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          status: {
            in: ['DELIVERED'],
          },
        },
        include: { items: { include: { product: true } } },
      });

      paidOrdersCount = paidOrders.length;
      revenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      paidOrders.forEach((order) => {
        order.items.forEach((item) => {
          const buyPrice = item.product?.costPrice ?? 0;
          cost += buyPrice * item.quantity;
        });
      });
    } catch (e) {
      console.error('Critical Dashboard Stats Error:', e);
      revenue = 0;
      cost = 0;
    }

    const profit = revenue - cost;

    return {
      counts: {
        users,
        customers,
        orders,
        pendingOrders,
        pendingApprovals,
        products,
        paidOrdersCount,
      },
      revenue,
      profit,
      cost,
    };
  }

  async listCustomers(params: { page?: number; pageSize?: number; status?: CustomerStatus; search?: string }) {
    const { page = 1, pageSize = 20, status, search } = params;
    const where: Prisma.CustomerWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { storeName: { contains: search, mode: 'insensitive' } },
              { nationalCode: { contains: search } },
              { user: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, phone: true, createdAt: true, isActive: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async getCustomer(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        orders: { orderBy: { createdAt: 'desc' }, include: { items: true }, take: 20 },
      },
    });
    if (!c) throw new NotFoundException('مشتری یافت نشد');
    return c;
  }

  async updateCustomerStatus(id: string, status: CustomerStatus, notes?: string) {
    const c = await this.prisma.customer.findUnique({ where: { id: id }, include: { user: true } });
    if (!c) throw new NotFoundException('مشتری یافت نشد');

    const updated = await this.prisma.customer.update({
      where: { id },
      data: { status, notes: notes ?? c.notes },
    });

    if (status === 'APPROVED' && c.status !== 'APPROVED') {
      await this.prisma.notification.create({
        data: {
          userId: c.userId,
          title: 'حساب شما تایید شد',
          body: 'تبریک! حساب کاربری شما تایید شد. اکنون می‌توانید قیمت‌ها را مشاهده کرده و سفارش ثبت کنید.',
          type: 'ACCOUNT_VERIFIED',
          category: 'account',
          icon: 'account',
          deepLink: { screen: 'products_list', params: {} },
          priority: 'high',
        },
      });
      this.eventEmitter.emit('kyc.approved', { customerId: id });
    } else if (status === 'REJECTED' && c.status !== 'REJECTED') {
      await this.prisma.notification.create({
        data: {
          userId: c.userId,
          title: 'احراز هویت رد شد',
          body: `متأسفانه احراز هویت شما تایید نشد. ${notes || ''}. برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.`,
          type: 'ACCOUNT_REJECTED',
          category: 'account',
          deepLink: { screen: 'account', params: {} },
          priority: 'high',
        },
      });
      this.eventEmitter.emit('kyc.rejected', { customerId: id, reason: notes });
    }

    return updated;
  }

  async hardDeleteCustomer(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('مشتری یافت نشد');

    return this.prisma.$transaction(async (tx) => {
      // Cart items and Customer have cascade, but just to be safe
      await tx.cartItem.deleteMany({ where: { customerId: id } });

      // Orders from this customer
      const orders = await tx.order.findMany({ where: { customerId: id }, select: { id: true } });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { customerId: id } });
      }

      await tx.customer.delete({ where: { id } });
      await tx.user.delete({ where: { id: c.userId } });
      return { ok: true };
    });
  }

  async createCustomer(data: {
    phone: string;
    firstName: string;
    lastName: string;
    storeName: string;
    nationalCode?: string;
    landline?: string;
    city?: string;
    address?: string;
    postalCode?: string;
    businessType: string;
    notes?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // ۱. بررسی یا ایجاد یوزر
      let user = await tx.user.findUnique({ where: { phone: data.phone } });
      if (user) {
        const existingCustomer = await tx.customer.findUnique({ where: { userId: user.id } });
        // B11 — قبلاً Error خام بود → HTTP 500 و پیام فارسی هرگز به پنل ادمین نمی‌رسید
        if (existingCustomer) throw new ConflictException('این شماره همراه قبلاً به عنوان مشتری ثبت شده است.');
      } else {
        user = await tx.user.create({ data: { phone: data.phone, role: 'CUSTOMER' } });
      }

      // ۲. ایجاد پروفایل مشتری با وضعیت تایید شده
      return tx.customer.create({
        data: {
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          storeName: data.storeName,
          nationalCode: data.nationalCode || null,
          landline: data.landline || null,
          city: data.city,
          address: data.address,
          postalCode: data.postalCode || null,
          businessType: data.businessType,
          notes: data.notes || null,
          status: 'APPROVED',
          onboardingCompleted: true,
        },
      });
    });
  }

  async updateCustomer(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      storeName?: string;
      nationalCode?: string;
      landline?: string;
      city?: string;
      address?: string;
      postalCode?: string;
      businessType?: string;
    }
  ) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        storeName: data.storeName,
        nationalCode: data.nationalCode,
        landline: data.landline,
        city: data.city,
        address: data.address,
        postalCode: data.postalCode,
        businessType: data.businessType,
      },
    });
  }

  async listOtpAttempts(params: { page?: number; pageSize?: number; phone?: string }) {
    const { page = 1, pageSize = 50, phone } = params;
    const where = phone ? { phone: { contains: phone } } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.otpAttempt.count({ where }),
      this.prisma.otpAttempt.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, total, page, pageSize };
  }
  // ------- توابع تیکت -------
  async getAllTickets(params: { page: number; pageSize: number; status?: TicketStatus }) {
    const { page, pageSize, status } = params;
    const where: Prisma.TicketWhereInput = status ? { status } : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: { customer: { select: { firstName: true, lastName: true, user: { select: { phone: true } } } } },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async replyToTicket(ticketId: string, message: string, adminId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');

    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'ANSWERED', updatedAt: new Date() },
      });
      return tx.ticketMessage.create({
        data: {
          ticketId,
          senderType: 'ADMIN',
          senderId: adminId,
          body: message,
        },
      });
    });
  }

  async updateTicketStatus(id: string, status: TicketStatus) {
    return this.prisma.ticket.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });
  }

  // ------- توابع اعلان‌ها -------
  async getAllNotifications(page: number, pageSize: number) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.notification.count(),
      this.prisma.notification.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async createNotification(data: {
    title: string;
    body: string;
    targetType: NotificationTargetType;
    targetStatus?: CustomerStatus;
    targetUsers?: string[];
    sendPush?: boolean;
  }) {
    let finalTargetUsers = data.targetUsers || [];

    if (data.targetType === 'SPECIFIC_USERS' && finalTargetUsers.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { phone: { in: finalTargetUsers } },
        select: { customer: { select: { id: true } } },
      });
      const userIds = users.map((u) => u.customer?.id).filter(Boolean);
      finalTargetUsers = userIds as string[];

      if (finalTargetUsers.length === 0) {
        throw new NotFoundException('هیچ مشتری تایید شده ای با این شماره(ها) یافت نشد.');
      }
    }

    this.eventEmitter.emit('notification.broadcast', {
      ...data,
      targetUsers: finalTargetUsers,
      sendPush: data.sendPush,
    });

    return { ok: true };
  }

  // ------- بخش پیشرفته امنیت -------
  async getSecurityStats() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [suspiciousAttempts, otpSuccess, otpTotal] = await Promise.all([
      this.prisma.otpAttempt.count({
        where: { success: false, createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prisma.otpAttempt.count({
        where: { success: true, createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prisma.otpAttempt.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
    ]);

    // کاربران بسیار فعال (بیش از ۱۰ سفارش یا تیکت)
    const hyperActiveUsers = await this.prisma.customer.count({
      where: {
        OR: [{ orders: { some: {} } }, { tickets: { some: {} } }],
      },
    });

    const otpSuccessRate = otpTotal > 0 ? Math.round((otpSuccess / otpTotal) * 100) : 0;

    return {
      suspiciousAttempts,
      hyperActiveUsers,
      otpSuccessRate,
      topError: 'Internal Server Error', // فعلاً به عنوان نمونه
    };
  }

  async getErrorLogs(page: number, pageSize = 20) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.errorLog.count(),
      this.prisma.errorLog.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async getActiveUsers() {
    return this.prisma.user.findMany({
      take: 10,
      orderBy: { lastSeenAt: 'desc' },
      include: { customer: true },
      where: { lastSeenAt: { not: null } },
    });
  }
}
