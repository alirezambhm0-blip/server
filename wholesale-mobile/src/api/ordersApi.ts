import { httpClient } from './httpClient';

export type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  originalPrice: number | null;
  unitLabel: string;
  productImageUrl: string | null;
  quantity: number;
  lineTotal: number;
  itemsPerPackageLabel?: string | null;
  lineDiscount: number;
  productStillAvailable: boolean;
};

export type Order = {
  id: string;
  orderNumber: string;
  order_number?: string; 
  createdAt: string;
  subtotal: number;
  total_discount: number;
  final_total: number;
  totalAmount?: number; 
  placed_at_shamsi?: string;
  items_count?: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  status_label_fa: string;
  status_color: 'warning' | 'info' | 'success' | 'error';
  payment_method: string;
  delivery_address: string;
  is_alternative_address: boolean;
  customer_note: string | null;
  items: OrderItem[];
  timeline: Array<{
      status: string;
      label_fa: string;
      description_fa: string;
      timestamp: string | null;
      timestamp_shamsi: string | null;
      is_completed: boolean;
      is_current: boolean;
  }>;
  invoice: {
      has_invoice: boolean;
      invoice_number: string | null;
      invoice_url: string | null;
      invoice_image_url: string | null;
  };
  can_cancel: boolean;
  can_reorder: boolean;
};

export async function getOrdersApi(filter = 'all', page = 1): Promise<{ data: Order[], meta: any }> {
  const res = await httpClient.get<any>('/orders', { params: { filter, page } });
  return res.data;
}

export async function getOrderDetailApi(id: string): Promise<Order> {
  const res = await httpClient.get<Order>(`/orders/${id}`);
  return res.data;
}

/** 
 * اصلاح شده: پذیرش ۱ یا ۲ آرگومان برای جلوگیری از خطای کامپایل
 */
export async function placeOrderApi(data: any, secondArgLegacy?: any): Promise<Order> {
  let payload;
  
  if (typeof data === 'object' && data !== null) {
    // حالت جدید: ارسال آبجکت
    payload = data;
  } else {
    // حالت قدیمی: آرگومان اول نوت و آرگومان دوم کلید تکرار
    payload = { 
      customer_note: data, 
      delivery_address: 'آدرس پیش‌فرض', 
      is_alternative_address: false 
    };
  }

  const res = await httpClient.post<Order>('/orders', payload);
  return res.data;
}

export async function cancelOrderApi(id: string, reason?: string): Promise<any> {
  const res = await httpClient.post<any>(`/orders/${id}/cancel`, { reason });
  return res.data;
}

export async function getLatestOrderApi(): Promise<Order | null> {
  const res = await httpClient.get<Order>('/orders/latest');
  return res.data;
}

export async function getActiveOrdersApi(): Promise<Order[]> {
  const res = await httpClient.get<Order[]>('/orders/active');
  return res.data || [];
}

export async function reorderApi(orderId: string, mode: 'add' | 'replace'): Promise<any> {
  const res = await httpClient.post<any>('/cart/reorder', { orderId, mode });
  return res.data;
}
