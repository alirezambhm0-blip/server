import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { CustomerStatus, NotificationTargetType, OrderStatus } from '@prisma/client';
import {
  EVENT_ORDER_CREATED,
  OrderCreatedEvent,
  EVENT_ORDER_STATUS_CHANGED,
  OrderStatusChangedEvent,
  EVENT_KYC_SUBMITTED,
  KycSubmittedEvent,
  EVENT_KYC_STATUS_CHANGED,
  KycStatusChangedEvent,
} from './events/events';
import {
  NOTIFICATION_TEMPLATES,
  ORDER_STATUS_TEMPLATE,
  TemplateKey,
  NotificationTemplateParams,
} from './constants/notification-templates';

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  private async pushFromTemplate(userId: string, templateKey: TemplateKey, params: NotificationTemplateParams = {}) {
    try {
      const tpl = NOTIFICATION_TEMPLATES[templateKey];
      const title = tpl.title;
      const body = typeof tpl.body === 'function' ? tpl.body(params) : tpl.body;
      const deepLink = typeof tpl.data.route === 'function' ? tpl.data.route(params) : tpl.data.route;

      await this.notificationsService.createAndPush(
        [userId],
        title,
        body,
        NotificationTargetType.SPECIFIC_USERS,
        deepLink,
        tpl.channelId,
        undefined,
        tpl.sendPush !== false // اگر مقدار sendPush صراحتا false بود ارسال نکند، وگرنه می‌فرستد
      );
    } catch (error) {
      this.logger.error(
        `Failed to send push for template ${templateKey}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  @OnEvent(EVENT_ORDER_CREATED, { async: true })
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.pushFromTemplate(event.userId, 'ORDER_CREATED', event);
  }

  @OnEvent(EVENT_ORDER_STATUS_CHANGED, { async: true })
  async handleOrderStatusChanged(event: OrderStatusChangedEvent) {
    const templateKey = ORDER_STATUS_TEMPLATE[event.newStatus as OrderStatus];
    if (templateKey) {
      await this.pushFromTemplate(event.userId, templateKey, event);
    }
  }

  @OnEvent(EVENT_KYC_SUBMITTED, { async: true })
  async handleKycSubmitted(event: KycSubmittedEvent) {
    await this.pushFromTemplate(event.userId, 'KYC_SUBMITTED');
  }

  @OnEvent(EVENT_KYC_STATUS_CHANGED, { async: true })
  async handleKycStatusChanged(event: KycStatusChangedEvent) {
    if (event.newStatus === 'APPROVED') {
      await this.pushFromTemplate(event.userId, 'KYC_APPROVED');
    } else if (event.newStatus === 'REJECTED') {
      await this.pushFromTemplate(event.userId, 'KYC_REJECTED', { reason: event.reason });
    }
  }

  @OnEvent('notification.broadcast', { async: true })
  async handleBroadcast(payload: {
    title: string;
    body: string;
    targetType: NotificationTargetType;
    targetStatus?: CustomerStatus;
    targetUsers?: string[];
    sendPush?: boolean;
  }) {
    try {
      // Logic from before, using direct createAndPush call from AdminService emit
      await this.notificationsService.createAndPush(
        payload.targetUsers || [],
        payload.title,
        payload.body,
        payload.targetType,
        undefined,
        'promotions',
        payload.targetStatus,
        payload.sendPush
      );
    } catch (error) {
      this.logger.error(`Broadcast failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
