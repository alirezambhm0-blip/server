import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerStatus, NotificationTargetType, Prisma } from '@prisma/client';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo = new Expo();

  constructor(private prisma: PrismaService) {}

  async registerToken(customerId: string, token: string, platform: string) {
    if (!Expo.isExpoPushToken(token)) return;
    return this.prisma.pushToken.upsert({
      where: { token },
      update: { customerId, lastUsedAt: new Date(), platform },
      create: { customerId, token, platform },
    });
  }

  async removeToken(customerId: string) {
    return this.prisma.pushToken.deleteMany({ where: { customerId } });
  }

  async sendPush(
    customerIds: string[],
    title: string,
    body: string,
    deepLink?: Prisma.InputJsonValue,
    priority: 'normal' | 'high' = 'normal'
  ) {
    if (!customerIds.length) return;
    const tokens = await this.prisma.pushToken.findMany({ where: { customerId: { in: customerIds } } });
    if (!tokens.length) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: { route: deepLink },
      priority: priority === 'high' ? 'high' : 'default',
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async createAndPush(
    customerIds: string[],
    title: string,
    body: string,
    targetType: NotificationTargetType,
    deepLink?: Prisma.InputJsonValue,
    channelId?: string,
    targetStatus?: CustomerStatus,
    shouldSendPush: boolean = true
  ) {
    // shouldSendPush در نسخه فعلی توسط createNotification مدیریت نمی‌شود؛ امضا حفظ می‌ماند
    void shouldSendPush;
    await this.createNotification({
      title,
      body,
      targetType,
      targetStatus,
      targetUsers: customerIds,
      deepLink,
      priority: 'normal',
    });
  }

  async createNotification(params: {
    userId?: string;
    title: string;
    body: string;
    type?: string;
    category?: string;
    imageUrl?: string;
    icon?: string;
    deepLink?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
    isBroadcast?: boolean;
    priority?: string;
    expiresAt?: Date;
    targetType?: NotificationTargetType;
    targetStatus?: CustomerStatus;
    targetUsers?: string[];
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        type: params.type,
        category: params.category || 'system',
        imageUrl: params.imageUrl,
        icon: params.icon,
        deepLink: params.deepLink,
        metadata: params.metadata,
        isBroadcast: params.isBroadcast || false,
        priority: params.priority || 'normal',
        expiresAt: params.expiresAt,
        targetType: params.targetType || (params.isBroadcast ? 'ALL' : 'SPECIFIC_USERS'),
        targetStatus: params.targetStatus,
        targetUsers: params.targetUsers || [],
      },
    });

    let recipients: string[] = [];
    if (params.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: params.userId }, include: { customer: true } });
      if (user?.customer) recipients = [user.customer.id];
    } else if (params.targetType === 'ALL' || params.isBroadcast) {
      const all = await this.prisma.customer.findMany({ select: { id: true } });
      recipients = all.map((c) => c.id);
    } else if (params.targetType === 'STATUS_BASED' && params.targetStatus) {
      const filtered = await this.prisma.customer.findMany({
        where: { status: params.targetStatus },
        select: { id: true },
      });
      recipients = filtered.map((c) => c.id);
    } else if (params.targetType === 'SPECIFIC_USERS' && params.targetUsers) {
      recipients = params.targetUsers;
    }

    if (recipients.length > 0) {
      await this.sendPush(
        recipients,
        params.title,
        params.body,
        params.deepLink,
        params.priority === 'high' ? 'high' : 'normal'
      );
    }
    return notification;
  }

  async getMyNotifications(
    userId: string,
    customerId: string,
    page = 1,
    pageSize = 20,
    customerStatus?: CustomerStatus
  ) {
    const reads = await this.prisma.notificationRead.findMany({ where: { userId }, select: { notificationId: true } });
    const readIds = reads.map((r) => r.notificationId);

    const now = new Date();
    const where: Prisma.NotificationWhereInput = {
      OR: [
        { userId },
        { isBroadcast: true },
        { targetType: 'ALL' },
        { targetType: 'STATUS_BASED', targetStatus: customerStatus },
        { targetType: 'SPECIFIC_USERS', targetUsers: { has: customerId } },
      ],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    };

    const [total, notifications, categoryCounts] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.groupBy({
        by: ['category'],
        where,
        _count: { category: true },
        orderBy: { category: 'asc' },
      }),
    ]);

    const items = notifications.map((n) => ({
      ...n,
      is_read: n.userId ? n.isRead : readIds.includes(n.id),
      category_label_fa: this.getCategoryLabel(n.category),
      created_at_relative: this.getRelativeTime(n.createdAt),
    }));

    const counts_by_category: Record<string, number> = { all: total };
    categoryCounts.forEach((c) => {
      const count = c._count && typeof c._count === 'object' ? c._count.category || 0 : 0;
      counts_by_category[c.category] = count;
    });

    return { data: items, meta: { current_page: page, total }, counts_by_category };
  }

  async markAsRead(userId: string, notificationId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n) throw new NotFoundException();
    if (n.userId === userId) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });
    } else {
      await this.prisma.notificationRead.upsert({
        where: { notificationId_userId: { notificationId, userId } },
        update: { readAt: new Date() },
        create: { notificationId, userId },
      });
    }
    return { success: true };
  }

  async getUnreadCount(userId: string, customerId: string, customerStatus?: CustomerStatus) {
    const reads = await this.prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true },
    });
    const readIds = reads.map((r) => r.notificationId);

    const now = new Date();
    const where: Prisma.NotificationWhereInput = {
      id: { notIn: readIds },
      isRead: false,
      OR: [
        { userId },
        { isBroadcast: true },
        { targetType: 'ALL' },
        { targetType: 'STATUS_BASED', targetStatus: customerStatus },
        { targetType: 'SPECIFIC_USERS', targetUsers: { has: customerId } },
      ],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    };

    return this.prisma.notification.count({ where });
  }

  async markAllAsRead(userId: string, category?: string) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      isRead: false,
      ...(category ? { category } : {}),
    };
    await this.prisma.notification.updateMany({ where, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }

  private getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      order: 'سفارش‌ها',
      promotion: 'تخفیف‌ها',
      product: 'محصولات',
      account: 'حساب کاربری',
      system: 'سیستمی',
    };
    return labels[cat] || 'سیستمی';
  }

  private getRelativeTime(date: Date): string {
    return new Intl.DateTimeFormat('fa-IR').format(date);
  }
}
