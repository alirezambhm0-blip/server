// src/api/cartApi.ts
import { httpClient, buildUrl } from './httpClient';
import { Cart } from '@/types/cart';

type CartItemInput = { productId: string; quantity: number };

// شکل پاسخ سرور (هماهنگ با cart.service.ts backend)
// نکته: بک‌اند snake_case برمی‌گرداند (product_id, unit_price, image_url, unit_label, is_available)
export type ServerCartResponse = {
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    line_discount: number;
    stock_warning: string | null;
    product: {
      id: string;
      name: string;
      image_url?: string | null;
      unit_label: string;
      price: number;
      discounted_price?: number | null;
      original_price: number;
      stock: number;
      is_available: boolean;
    };
  }>;
  summary: {
    items_count: number;
    total_quantity: number;
    subtotal: number;
    total_discount: number;
    final_total: number;
  };
  user_default_address: string;
  warnings: any[];
};

export const cartApi = {
  get: () => httpClient.get<ServerCartResponse>('/cart').then((r) => r.data),

  add: (productId: string, quantity = 1) =>
    httpClient
      .post<ServerCartResponse>('/cart/items', { productId, quantity })
      .then((r) => r.data),

  update: (productId: string, quantity: number) =>
    httpClient
      .put<ServerCartResponse>('/cart/items', { productId, quantity })
      .then((r) => r.data),

  remove: (productId: string) =>
    httpClient
      .delete<ServerCartResponse>(`/cart/items/${encodeURIComponent(productId)}`)
      .then((r) => r.data),

  clear: () => httpClient.delete<ServerCartResponse>('/cart').then((r) => r.data),

  merge: (items: CartItemInput[]) =>
    httpClient
      .post<ServerCartResponse>('/cart/merge', { items })
      .then((r) => r.data),
};

/** تبدیل پاسخ سرور به Cart shape که فرانت استفاده می‌کند */
export function serverCartToLocal(remote: ServerCartResponse): Cart {
  const items = remote.items.map((it) => {
    const p = it.product;
    return {
      id: it.id,
      productId: it.product_id,
      unitPrice: it.unit_price,
      totalPrice: it.line_total,
      quantity: it.quantity,
      product: {
        id: p.id,
        name: p.name,
        slug: '',
        imageUrl: p.image_url || undefined,
        category: { id: '', name: '', slug: '' },
        unit: p.unit_label,
        price: p.original_price,
        stock: p.stock,
        isActive: p.is_available,
        isFeatured: false,
        isNew: false,
        isDiscounted: !!p.discounted_price,
        oldPrice: p.original_price,
      } as any,
    };
  });

  return {
    items,
    totalItems: remote.summary?.total_quantity ?? items.reduce((s, i) => s + i.quantity, 0),
    subtotal: remote.summary?.subtotal ?? items.reduce((s, i) => s + i.totalPrice, 0),
    totalPrice: remote.summary?.final_total ?? items.reduce((s, i) => s + i.totalPrice, 0),
  };
}
