export type Product = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  description?: string;
  // S7 — برای مهمان و مشتری تاییدنشده، API قیمت را null می‌فرستد.
  // (قبلاً تایپ number بود ولی API عدد واقعی می‌داد و مخفی‌سازی فقط سمت UI بود.)
  price: number | null;
  /** S7 — آیا قیمت برای این کاربر قابل نمایش است؟ */
  priceVisible?: boolean;
  oldPrice?: number;
  unit: string;
  stock: number;
  minOrderQty: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isDiscounted: boolean;
  is_suggested?: boolean;
  is_new?: boolean;
  is_discounted?: boolean;
  isFavorited?: boolean;
  cartQuantity?: number;
  items_per_package?: number | null;
  package_type?: string | null;
  items_per_package_label?: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
};
