import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationTargetType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  private fa(n: number): string {
    return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone || '';
    return phone.slice(0, 4) + '***' + phone.slice(-4);
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'در انتظار تایید',
      APPROVED: 'احراز هویت شده',
      REJECTED: 'رد شده',
      BLOCKED: 'مسدود شده',
    };
    return labels[status] || status;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: true,
      },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const c = user.customer;

    // Count orders
    const totalOrders = c ? await this.prisma.order.count({ where: { customerId: c.id } }) : 0;

    // Count favorites
    const totalFavorites = c ? await this.prisma.favorite.count({ where: { customerId: c.id } }) : 0;

    // Unread notifications count
    const reads = await this.prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true },
    });
    const readIds = reads.map((r) => r.notificationId);
    const now = new Date();
    const unreadCount = await this.prisma.notification.count({
      where: {
        id: { notIn: readIds },
        isRead: false,
        OR: [
          { userId },
          { isBroadcast: true },
          { targetType: NotificationTargetType.ALL },
          ...(c ? [{ targetType: NotificationTargetType.STATUS_BASED, targetStatus: c.status }] : []),
          ...(c ? [{ targetType: NotificationTargetType.SPECIFIC_USERS, targetUsers: { has: c.id } }] : []),
        ],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
    });

    // Open tickets count
    const openTicketsCount = c
      ? await this.prisma.ticket.count({
          where: { customerId: c.id, status: { in: ['OPEN', 'ANSWERED'] as any[] } },
        })
      : 0;

    // Verification status
    let verificationStatus = 'guest';
    if (c) {
      if (c.status === 'APPROVED') verificationStatus = 'verified';
      else if (c.status === 'PENDING') verificationStatus = 'pending';
      else if (c.status === 'REJECTED') verificationStatus = 'rejected';
      else if (c.status === 'BLOCKED') verificationStatus = 'rejected';
    }

    return {
      id: user.id,
      first_name: c?.firstName || null,
      last_name: c?.lastName || null,
      full_name: [c?.firstName, c?.lastName].filter(Boolean).join(' ') || null,
      phone_number: user.phone,
      phone_number_masked: this.maskPhone(user.phone),
      email: null,
      profile_image_url: null,

      store: {
        name: c?.storeName || null,
        type: c?.businessType || null,
        business_license_number: null,
        economic_code: null,
        default_address: c?.address || null,
      },

      verification: {
        status: verificationStatus,
        status_label_fa: this.getStatusLabel(c?.status || 'PENDING'),
        verified_at: c?.status === 'APPROVED' ? c.updatedAt : null,
        verified_at_shamsi: c?.status === 'APPROVED' ? new Intl.DateTimeFormat('fa-IR').format(c.updatedAt) : null,
        rejection_reason: c?.status === 'REJECTED' ? c.notes : null,
        can_reapply: c?.status === 'REJECTED',
      },

      stats: {
        total_orders: totalOrders,
        total_favorites: totalFavorites,
        member_since: user.createdAt,
        member_since_shamsi: new Intl.DateTimeFormat('fa-IR').format(user.createdAt),
      },

      unread_notifications_count: unreadCount,
      open_tickets_count: openTicketsCount,
    };
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      storeName?: string;
      businessType?: string;
    }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    if (!user.customer) throw new NotFoundException('پروفایل مشتری یافت نشد');

    // فیلدهای حساس که نیاز به تایید ادمین دارند
    const sensitiveFields = ['storeName', 'businessType', 'nationalCode', 'landline'];

    // بررسی اینکه آیا کاربر سعی در تغییر فیلدهای حساس دارد
    const requestedSensitiveFields = Object.keys(data).filter((field) => sensitiveFields.includes(field));

    if (requestedSensitiveFields.length > 0) {
      // B11 — قبلاً Error خام → HTTP 500
      throw new ForbiddenException(
        'تغییر فیلدهای ' +
          requestedSensitiveFields.join('، ') +
          ' نیاز به تایید ادمین دارد. لطفاً از طریق منوی "تغییر اطلاعات حساس" اقدام کنید.'
      );
    }

    const updateData: Prisma.CustomerUpdateInput = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;

    if (Object.keys(updateData).length === 0) {
      return { ok: true, message: 'تغییری اعمال نشد' };
    }

    await this.prisma.customer.update({
      where: { userId },
      data: updateData,
    });

    return { ok: true, message: 'اطلاعات با موفقیت به‌روزرسانی شد' };
  }

  async updateAddress(userId: string, address: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user || !user.customer) throw new NotFoundException('پروفایل یافت نشد');

    await this.prisma.customer.update({
      where: { userId },
      data: { address },
    });

    return { ok: true, message: 'آدرس با موفقیت به‌روزرسانی شد' };
  }
}
