// src/api/productsApi.ts
import { httpClient, buildUrl } from './httpClient';
import { Product } from '@/types/product';

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  productCount?: number;
}

interface ServerCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  _count?: { products?: number };
}

interface ServerProduct {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  oldPrice?: number | null;
  unit: string;
  stock: number;
  minOrderQty?: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isDiscounted: boolean;
  sortOrder?: number;
  category?: { id: string; name: string; slug: string } | null;
}

export interface ListProductsResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductDetail extends Product {
  images: string[];
  brand?: string | null;
  productCode?: string | null;
  unitDetails?: string | null;
}

function toLocalProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug || p.id,
    imageUrl: p.image_url || undefined,
    category: {
      id: p.category_id ?? p.category?.id ?? '',
      name: p.category_name ?? p.category?.name ?? '',
      slug: '',
    },
    unit: p.unit_label || 'عدد',
    price: p.price,
    oldPrice: p.original_price && p.original_price !== p.price ? p.original_price : undefined,
    stock: p.stock,
    isActive: true,
    isFeatured: p.is_suggested || p.isFeatured,
    isNew: p.is_new || p.isNew,
    isDiscounted: p.is_discounted || p.isDiscounted,
    description: p.description || undefined,
    minOrderQty: p.min_order_qty ?? 1,
    isFavorited: p.is_favorited,
    cartQuantity: p.cart_quantity,
    items_per_package: p.items_per_package ?? null,
    package_type: p.package_type ?? null,
    items_per_package_label: p.items_per_package_label ?? null,
  };
}

function toLocalProductDetail(p: any): ProductDetail {
  const base = toLocalProduct(p);
  return {
    ...base,
    images: p.images || [p.image_url],
    brand: p.brand,
    productCode: p.product_code,
    unitDetails: p.unit_details,
  };
}

function toLocalCategory(c: ServerCategory): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    imageUrl: c.imageUrl ? buildUrl(c.imageUrl) : null,
    productCount: c._count?.products ?? 0,
  };
}

export const productsApi = {
  async list(params: {
    categoryId?: string;
    categorySlug?: string;
    search?: string;
    isFeatured?: boolean;
    isNew?: boolean;
    isDiscounted?: boolean;
    filter?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
    includeInactive?: boolean;
  } = {}): Promise<ListProductsResponse> {
    const q = new URLSearchParams();
    if (params.categoryId) q.set('categoryId', params.categoryId);
    if (params.categorySlug) q.set('categorySlug', params.categorySlug);
    if (params.search) q.set('search', params.search);
    if (params.isFeatured) q.set('isFeatured', 'true');
    if (params.isNew) q.set('isNew', 'true');
    if (params.isDiscounted) q.set('isDiscounted', 'true');
    if (params.filter) q.set('filter', params.filter);
    if (params.sort) q.set('sort', params.sort);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.includeInactive) q.set('all', '1');
    const qs = q.toString();
    const url = qs ? `/products?${qs}` : '/products';
    const res = await httpClient.get<{
      data: ServerProduct[];
      meta: {
        total: number;
        current_page: number;
        per_page: number;
      }
    }>(url);
    return {
      items: res.data.data.map(toLocalProduct),
      total: res.data.meta.total,
      page: res.data.meta.current_page,
      pageSize: res.data.meta.per_page,
    };
  },

  async listCategories(includeInactive = false): Promise<Category[]> {
    const url = includeInactive ? '/categories?all=1' : '/categories';
    const res = await httpClient.get<any>(url);
    const list = res.data.items || res.data || [];
    return list.map(toLocalCategory);
  },

  async getOne(idOrSlug: string): Promise<ProductDetail | null> {
    if (!idOrSlug) return null;
    try {
      const res = await httpClient.get<any>(`/products/${encodeURIComponent(idOrSlug)}`);
      return res.data ? toLocalProductDetail(res.data) : null;
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  },

  async getSimilar(id: string): Promise<Product[]> {
    try {
      const res = await httpClient.get<any[]>(`/products/${encodeURIComponent(id)}/similar`);
      return (res.data || []).filter(Boolean).map(toLocalProduct);
    } catch (e) {
      console.warn('Failed to fetch similar products', e);
      return [];
    }
  },

  async getFeatureCounts(): Promise<{ isNew: number; isFeatured: number; isDiscounted: number }> {
    const res = await httpClient.get<{ isNew: number; isFeatured: number; isDiscounted: number }>('/products/counts');
    return res.data;
  },

  async toggleFavorite(productId: string): Promise<{ isFavorite: boolean }> {
    const res = await httpClient.post<{ isFavorite: boolean }>(`/products/${productId}/favorite`);
    return res.data;
  },

  async getFavorites(): Promise<Product[]> {
    const res = await httpClient.get<ServerProduct[]>('/products/favorites');
    const list = res.data || [];
    return list.map(toLocalProduct);
  },
};
