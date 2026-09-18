import { OrderStatus } from '@prisma/client';

export type TemplateKey =
  | 'ORDER_CREATED'
  | 'ORDER_PREPARING'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED';

/** پارامترهایی که قالب‌ها ممکن است استفاده کنند (از روی کلاس‌های Event) */
export interface NotificationTemplateParams {
  orderNo?: string;
  orderId?: string;
  reason?: string;
}

export type TemplateDefinition = {
  title: string;
  body: string | ((params: NotificationTemplateParams) => string);
  channelId: string;
  data: { route: string | ((params: NotificationTemplateParams) => string) };
  sendPush?: boolean; // آیا به صورت پوش (Lock Screen) ارسال شود یا نه (پیش‌فرض true)
};

export const NOTIFICATION_TEMPLATES: Record<TemplateKey, TemplateDefinition> = {
  ORDER_CREATED: {
    title: 'سفارش شما ثبت شد',
    body: (p) => `سفارش ${p.orderNo} دریافت شد و در انتظار بررسی است.`,
    channelId: 'orders',
    data: { route: (p) => `/orders/${p.orderId}` },
  },
  ORDER_PREPARING: {
    title: 'سفارش در حال آماده‌سازی',
    body: (p) => `سفارش ${p.orderNo} در حال آماده‌سازی است.`,
    channelId: 'orders',
    data: { route: (p) => `/orders/${p.orderId}` },
  },
  ORDER_SHIPPED: {
    title: 'سفارش ارسال شد 🚚',
    body: (p) => `سفارش ${p.orderNo} در حال ارسال به آدرس شماست.`,
    channelId: 'orders',
    data: { route: (p) => `/orders/${p.orderId}` },
  },
  ORDER_DELIVERED: {
    title: 'سفارش تحویل داده شد ✅',
    body: (p) => `سفارش ${p.orderNo} با موفقیت تحویل شد. از خرید شما متشکریم.`,
    channelId: 'orders',
    data: { route: (p) => `/orders/${p.orderId}` },
  },
  ORDER_CANCELLED: {
    title: 'سفارش لغو شد',
    body: (p) => `سفارش ${p.orderNo} لغو شد. برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.`,
    channelId: 'orders',
    data: { route: (p) => `/orders/${p.orderId}` },
  },
  KYC_SUBMITTED: {
    title: 'مدارک شما دریافت شد',
    body: 'مدارک شما ثبت شد و در حال بررسی است. نتیجه به‌زودی اعلام می‌شود.',
    channelId: 'kyc',
    data: { route: '/onboarding' },
  },
  KYC_APPROVED: {
    title: 'حساب شما تایید شد ✅',
    body: 'احراز هویت شما کامل شد. اکنون می‌توانید قیمت‌ها را ببینید و سفارش ثبت کنید.',
    channelId: 'kyc',
    data: { route: '/(tabs)/browse' },
  },
  KYC_REJECTED: {
    title: 'مدارک نیاز به اصلاح دارد',
    body: (p) => `${p.reason ? p.reason + ' — ' : ''}لطفاً مدارک را اصلاح و دوباره ارسال کنید.`,
    channelId: 'kyc',
    data: { route: '/onboarding' },
  },
};

export const ORDER_STATUS_TEMPLATE: Partial<Record<OrderStatus, TemplateKey>> = {
  PROCESSING: 'ORDER_PREPARING',
  SHIPPED: 'ORDER_SHIPPED',
  DELIVERED: 'ORDER_DELIVERED',
  CANCELLED: 'ORDER_CANCELLED',
};
