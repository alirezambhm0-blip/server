import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePersian } from '../common/utils/normalization';

function slugify(input: string): string {
  return (
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, '') // حروف فارسی، لاتین، عدد
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `p-${Date.now()}`
  );
}

/** تبدیل اعداد انگلیسی به فارسی */
function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** ساخت لیبل "تعداد در بسته" */
function buildItemsPerPackageLabel(itemsPerPackage: number | null, packageType: string | null): string | null {
  if (!itemsPerPackage) return null;
  const count = toFa(itemsPerPackage);
  if (packageType) return `${count} عدد در ${packageType}`;
  return `${count} عدد`;
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(input: {
    name: string;
    categoryId: string;
    slug?: string;
    description?: string;
    imageUrl?: string;
    galleryImages?: string[];
    brand?: string;
    productCode?: string;
    unitDetails?: string;
    itemsPerPackage?: number;
    packageType?: string;
    price: number;
    costPrice?: number;
    oldPrice?: number;
    unit: string;
    stock: number;
    minOrderQty?: number;
    isActive?: boolean;
    isFeatured?: boolean;
    isNew?: boolean;
    isDiscounted?: boolean;
    sortOrder?: number;
  }) {
    const cat = await this.prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!cat) throw new BadRequestException('دسته‌بندی نامعتبر است');

    let slug = input.slug?.trim() || slugify(input.name);
    let i = 1;
    const baseSlug = slug;
    while (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    return this.prisma.product.create({
      data: {
        name: input.name.trim(),
        nameNormalized: normalizePersian(input.name),
        slug,
        description: input.description,
        imageUrl: input.imageUrl,
        galleryImages: input.galleryImages || [],
        brand: input.brand || null,
        productCode: input.productCode || null,
        unitDetails: input.unitDetails || null,
        itemsPerPackage: input.itemsPerPackage || null,
        packageType: input.packageType || null,
        price: input.price,
        costPrice: input.costPrice,
        oldPrice: input.oldPrice,
        unit: (input.unit as ProductUnit) || 'CARTON',
        stock: input.stock,
        minOrderQty: input.minOrderQty ?? 1,
        isActive: input.isActive ?? true,
        isFeatured: input.isFeatured,
        isNew: input.isNew,
        isDiscounted: input.isDiscounted,
        sortOrder: input.sortOrder ?? 0,
        category: { connect: { id: input.categoryId } },
      },
    });
  }

  /**
   * S7 — فیلدهای قیمت.
   *
   * تا پیش از این، قیمت عمده برای هر کسی (از جمله مهمانِ بدون احراز هویت) در پاسخ API
   * ارسال می‌شد و مخفی‌سازی فقط سمت UI انجام می‌گشت (PriceBox/ProductCard).
   * یعنی با یک درخواست مستقیم به API قیمت لو می‌رفت.
   *
   * قاعده — دقیقاً همان چیزی که UI از قبل پیاده کرده بود:
   *   قیمت فقط برای مشتری تاییدشده (Customer.status = APPROVED) یا ادمین.
   *
   * پیش‌فرض canSeePrices = false است (fail-closed): اگر فراخوانی فراموش کند
   * پرچم را بفرستد، قیمت لو نمی‌رود.
   */
  private priceFields(p: { price: number; oldPrice: number | null; isDiscounted: boolean }, canSeePrices: boolean) {
    if (!canSeePrices) {
      return {
        price: null,
        discounted_price: null,
        original_price: null,
        discount_percentage: null,
        price_visible: false as const,
      };
    }
    return {
      price: p.price,
      discounted_price: p.isDiscounted ? p.price : null,
      original_price: p.oldPrice || p.price,
      discount_percentage:
        p.oldPrice && p.oldPrice > p.price ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : null,
      price_visible: true as const,
    };
  }

  async findAll(
    params: {
      categoryId?: string;
      categorySlug?: string;
      search?: string;
      onlyActive?: boolean;
      isFeatured?: boolean;
      isNew?: boolean;
      isDiscounted?: boolean;
      filter?: string; // "discounted", "suggested", "new", "favorited"
      sort?: string; // "default", "newest", "price_asc", "price_desc", "discounted"
      page?: number;
      pageSize?: number;
      userId?: string;
      /** S7 — آیا قیمت‌ها ارسال شوند؟ فقط مشتری تاییدشده یا ادمین. پیش‌فرض: false */
      canSeePrices?: boolean;
    } = {}
  ) {
    const {
      categoryId,
      categorySlug,
      search,
      onlyActive = true,
      isFeatured,
      isNew,
      isDiscounted,
      filter,
      sort,
      page = 1,
      pageSize = 24,
      userId,
      canSeePrices = false,
    } = params;

    let favoriteProductIds: string[] = [];
    if (filter === 'favorited' && userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        // Perf: فقط id مشتری مصرف می‌شود
        select: { customer: { select: { id: true } } },
      });
      if (user?.customer) {
        const favs = await this.prisma.favorite.findMany({
          where: { customerId: user.customer.id },
          select: { productId: true },
        });
        favoriteProductIds = favs.map((f) => f.productId);
      }
    }

    const where: Prisma.ProductWhereInput = {
      ...(onlyActive ? { isActive: true } : {}),
      ...(isFeatured || filter === 'suggested' ? { isFeatured: true } : {}),
      ...(isNew || filter === 'new' ? { isNew: true } : {}),
      ...(isDiscounted || filter === 'discounted' ? { isDiscounted: true } : {}),
      ...(filter === 'favorited' ? { id: { in: favoriteProductIds } } : {}),
      ...(categoryId || categorySlug
        ? { category: { OR: [{ id: categoryId }, { slug: categorySlug }].filter(Boolean) } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { category: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    let orderBy: any = { sortOrder: 'asc' };
    if (sort === 'newest') orderBy = { createdAt: 'desc' };
    else if (sort === 'price_asc') orderBy = { price: 'asc' };
    else if (sort === 'price_desc') orderBy = { price: 'desc' };
    else if (sort === 'discounted') orderBy = [{ isDiscounted: 'desc' }, { sortOrder: 'asc' }];

    // We also want out-of-stock at the end.
    // Prisma doesn't support complex "order by boolean expression" easily in findMany
    // without raw SQL or multiple sorts. We'll use multiple sorts if possible.
    const finalOrderBy: any[] = [
      { stock: 'desc' }, // Higher stock first (simplistic way to put 0 at end)
      orderBy,
    ];

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: finalOrderBy,
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
    ]);

    // Map to include user-specific data
    const userCartMap = new Map<string, number>();
    const userFavoriteSet = new Set<string>();

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        // Perf: فقط فیلدهای لازم برای ساخت نقشه سبد/علاقه‌مندی (به‌جای کل ردیف‌ها)
        select: {
          customer: {
            select: {
              cartItems: { select: { productId: true, quantity: true } },
              favorites: { select: { productId: true } },
            },
          },
        },
      });
      if (user?.customer) {
        user.customer.cartItems.forEach((ci) => userCartMap.set(ci.productId, ci.quantity));
        user.customer.favorites.forEach((f) => userFavoriteSet.add(f.productId));
      }
    }

    const enhancedItems = items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      image_url: p.imageUrl,
      images: [p.imageUrl, ...(p.galleryImages || [])].filter(Boolean),
      brand: p.brand,
      product_code: p.productCode,
      category_id: p.category?.id,
      category_name: p.category?.name,
      unit_label: p.unit === 'CARTON' ? 'کارتن' : p.unit,
      unit_details: p.unitDetails,
      items_per_package: p.itemsPerPackage || null,
      package_type: p.packageType || null,
      items_per_package_label: buildItemsPerPackageLabel(p.itemsPerPackage, p.packageType),
      ...this.priceFields(p, canSeePrices),
      stock: p.stock,
      is_new: p.isNew,
      is_suggested: p.isFeatured,
      is_discounted: p.isDiscounted,
      is_favorited: userFavoriteSet.has(p.id),
      cart_quantity: userCartMap.get(p.id) || 0,
    }));

    return {
      items: enhancedItems, // Return items directly for mobile compatibility
      data: enhancedItems,
      meta: {
        current_page: page,
        last_page: Math.ceil(total / pageSize),
        per_page: pageSize,
        total,
      },
    };
  }

  async findOne(idOrSlug: string, userId?: string, canSeePrices = false) {
    const p = await this.prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { category: true },
    });
    if (!p) throw new NotFoundException('محصول یافت نشد');

    let cart_quantity = 0;
    let is_favorited = false;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        // Perf: فقط فیلدهای لازم برای ساخت نقشه سبد/علاقه‌مندی (به‌جای کل ردیف‌ها)
        select: {
          customer: {
            select: {
              cartItems: { select: { productId: true, quantity: true } },
              favorites: { select: { productId: true } },
            },
          },
        },
      });
      if (user?.customer) {
        const ci = user.customer.cartItems.find((i) => i.productId === p.id);
        if (ci) cart_quantity = ci.quantity;
        is_favorited = user.customer.favorites.some((f) => f.productId === p.id);
      }
    }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      image_url: p.imageUrl,
      images: [p.imageUrl, ...(p.galleryImages || [])].filter(Boolean),
      category: {
        id: p.category?.id,
        name: p.category?.name,
      },
      brand: p.brand,
      product_code: p.productCode,
      unit_label: p.unit === 'CARTON' ? 'کارتن' : p.unit,
      unit_details: p.unitDetails,
      items_per_package: p.itemsPerPackage || null,
      package_type: p.packageType || null,
      items_per_package_label: buildItemsPerPackageLabel(p.itemsPerPackage, p.packageType),
      ...this.priceFields(p, canSeePrices),
      stock: p.stock,
      is_new: p.isNew,
      is_suggested: p.isFeatured,
      is_discounted: p.isDiscounted,
      is_active: p.isActive,
      is_favorited,
      cart_quantity,
    };
  }

  async getSimilar(id: string, userId?: string, limit = 10, canSeePrices = false) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('محصول یافت نشد');

    const where: Prisma.ProductWhereInput = {
      categoryId: product.categoryId,
      id: { not: id },
      isActive: true,
    };

    const items = await this.prisma.product.findMany({
      where,
      take: Math.min(limit, 20),
      orderBy: [
        { stock: 'desc' }, // Prioritize in-stock (simplistic)
        { isFeatured: 'desc' },
        { isNew: 'desc' },
        { id: 'desc' },
      ],
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    // Reuse the mapping logic if needed, but here we just need standard listing fields
    // I will call findMany and then map it similar to how findAll does.

    const userCartMap = new Map<string, number>();
    const userFavoriteSet = new Set<string>();

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        // Perf: فقط فیلدهای لازم برای ساخت نقشه سبد/علاقه‌مندی (به‌جای کل ردیف‌ها)
        select: {
          customer: {
            select: {
              cartItems: { select: { productId: true, quantity: true } },
              favorites: { select: { productId: true } },
            },
          },
        },
      });
      if (user?.customer) {
        user.customer.cartItems.forEach((ci) => userCartMap.set(ci.productId, ci.quantity));
        user.customer.favorites.forEach((f) => userFavoriteSet.add(f.productId));
      }
    }

    return items.map((p) => ({
      id: p.id,
      name: p.name,
      image_url: p.imageUrl,
      category_id: p.category?.id,
      category_name: p.category?.name,
      unit_label: p.unit === 'CARTON' ? 'کارتن' : p.unit,
      items_per_package: p.itemsPerPackage || null,
      package_type: p.packageType || null,
      items_per_package_label: buildItemsPerPackageLabel(p.itemsPerPackage, p.packageType),
      ...this.priceFields(p, canSeePrices),
      stock: p.stock,
      is_new: p.isNew,
      is_suggested: p.isFeatured,
      is_discounted: p.isDiscounted,
      is_favorited: userFavoriteSet.has(p.id),
      cart_quantity: userCartMap.get(p.id) || 0,
    }));
  }

  async update(id: string, data: Prisma.ProductUpdateInput) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('محصول یافت نشد');

    if (typeof data.name === 'string') {
      data.nameNormalized = normalizePersian(data.name);
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('محصول یافت نشد');
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async hardDelete(id: string) {
    const exists = await this.prisma.product.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('محصول یافت نشد');
    return this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.orderItem.updateMany({ where: { productId: id }, data: { productId: null } });
      return tx.product.delete({ where: { id } });
    });
  }

  async getFeatureCounts() {
    const [isNew, isFeatured, isDiscounted] = await Promise.all([
      this.prisma.product.count({ where: { isNew: true, isActive: true } }),
      this.prisma.product.count({ where: { isFeatured: true, isActive: true } }),
      this.prisma.product.count({ where: { isDiscounted: true, isActive: true } }),
    ]);
    return { isNew, isFeatured, isDiscounted };
  }

  async toggleFavorite(userId: string, productId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Perf: فقط id مشتری مصرف می‌شود
      select: { customer: { select: { id: true } } },
    });
    if (!user || !user.customer) throw new NotFoundException('مشتری یافت نشد');

    const customerId = user.customer.id;
    const existing = await this.prisma.favorite.findUnique({
      where: { customerId_productId: { customerId, productId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      return { isFavorite: false };
    } else {
      await this.prisma.favorite.create({ data: { customerId, productId } });
      return { isFavorite: true };
    }
  }

  async getMyFavorites(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Perf: فقط id مشتری مصرف می‌شود
      select: { customer: { select: { id: true } } },
    });
    if (!user || !user.customer) return [];

    const favs = await this.prisma.favorite.findMany({
      where: { customerId: user.customer.id },
      include: { product: { include: { category: true } } },
    });
    // S6 — آبجکت خام Prisma شامل costPrice (قیمت خرید) و nameNormalized است
    // که هرگز نباید به مشتری برسد.
    // ⚠️ شکل پاسخ (camelCase) عمداً حفظ شده: getFavorites() موبایل با
    // toLocalProduct و همین نام‌ها کار می‌کند (productsApi.ts:189). اگر اینجا
    // به enhancedItems (snake_case) سوییچ کنیم، صفحهٔ علاقه‌مندی می‌شکند.
    return favs.map((f) => {
      const { costPrice, nameNormalized, ...safe } = f.product;
      void costPrice;
      void nameNormalized;
      return safe;
    });
  }

  // ------- Business Settings -------
  async getSettings() {
    const settings = await this.prisma.setting.findMany();
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
  }

  async updateSetting(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
