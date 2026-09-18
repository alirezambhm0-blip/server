import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { CustomerStatus, NotificationTargetType } from '@prisma/client';

@Injectable()
export class NotificationListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('kyc.approved')
  async handleKycApproved(payload: { customerId: string }) {
    await this.notificationsService.createAndPush(
      [payload.customerId],
      'تایید حساب کاربری',
      'حساب کاربری شما با موفقیت تایید شد. اکنون می‌توانید سفارشات خود را ثبت کنید.',
      NotificationTargetType.SPECIFIC_USERS,
      '/(tabs)/browse',
      'kyc'
    );
  }

  @OnEvent('kyc.rejected')
  async handleKycRejected(payload: { customerId: string; reason?: string }) {
    await this.notificationsService.createAndPush(
      [payload.customerId],
      'رد تایید حساب',
      `متاسفانه حساب شما تایید نشد. ${payload.reason ? `دلیل: ${payload.reason}` : 'لطفا مدارک خود را بررسی کنید.'}`,
      NotificationTargetType.SPECIFIC_USERS,
      '/profile/kyc',
      'kyc'
    );
  }

  @OnEvent('order.confirmed')
  async handleOrderConfirmed(payload: { customerId: string; orderId: string; orderNumber: string }) {
    await this.notificationsService.createAndPush(
      [payload.customerId],
      'تایید سفارش',
      `سفارش شما به شماره ${payload.orderNumber} با موفقیت تایید شد.`,
      NotificationTargetType.SPECIFIC_USERS,
      `/orders/${payload.orderId}`,
      'orders'
    );
  }

  @OnEvent('order.shipped')
  async handleOrderShipped(payload: { customerId: string; orderId: string; orderNumber: string }) {
    await this.notificationsService.createAndPush(
      [payload.customerId],
      'ارسال سفارش',
      `سفارش شما به شماره ${payload.orderNumber} ارسال شد.`,
      NotificationTargetType.SPECIFIC_USERS,
      `/orders/${payload.orderId}`,
      'orders'
    );
  }

  @OnEvent('order.delivered')
  async handleOrderDelivered(payload: { customerId: string; orderId: string; orderNumber: string }) {
    await this.notificationsService.createAndPush(
      [payload.customerId],
      'تحویل سفارش',
      `سفارش شما به شماره ${payload.orderNumber} تحویل داده شد.`,
      NotificationTargetType.SPECIFIC_USERS,
      `/orders/${payload.orderId}`,
      'orders'
    );
  }

  @OnEvent('notification.broadcast')
  async handleBroadcast(payload: {
    title: string;
    body: string;
    targetType: NotificationTargetType;
    targetStatus?: CustomerStatus;
    targetUsers?: string[];
  }) {
    await this.notificationsService.createAndPush(
      payload.targetUsers || [],
      payload.title,
      payload.body,
      payload.targetType,
      undefined,
      'promotions',
      payload.targetStatus
    );
  }
}
