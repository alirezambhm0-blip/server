import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePersian } from '../common/utils/normalization';
import { ProductsService } from '../products/products.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService
  ) {}

  /**
   * جست‌وجوی یکپارچه محصولات و دسته‌بندی‌ها
   */
  async search(params: {
    q: string;
    categoryId?: string;
    filter?: string;
    sort?: string;
    inStockOnly?: boolean;
    page?: number;
    limit?: number;
    userId?: string;
    /** S7 — آیا قیمت‌ها ارسال شوند؟ فقط مشتری تاییدشده یا ادمین. پیش‌فرض: false */
    canSeePrices?: boolean;
  }) {
    const { q, categoryId, filter, sort = 'relevance', page = 1, limit = 20, userId, canSeePrices = false } = params;

    const normalizedQ = normalizePersian(q);
    if (normalizedQ.length < 2) {
      throw new UnprocessableEntityException('عبارت جست‌وجو باید حداقل ۲ کاراکتر باشد');
    }

    // ۱. جست‌وجوی دسته‌بندی‌ها (حداکثر ۶ مورد)
    const matchedCategories = await this.prisma.category.findMany({
      where: {
        isActive: true,
        nameNormalized: { contains: normalizedQ },
      },
      take: 6,
      include: { _count: { select: { products: true } } },
    });

    // ۲. جست‌وجوی محصولات با رتبه‌بندی دستی (اگر Meilisearch نباشد)
    // برای سادگی و کارایی، از ProductsService.findAll استفاده می‌کنیم
    // اما منطق مرتب‌سازی relevance را جداگانه پیاده می‌کنیم اگر نیاز باشد.
    // در اینجا برای دقت بالا، یک کوئری مستقیم با Case برای Score می‌زنیم.

    const productsResult = await this.productsService.findAll({
      search: normalizedQ,
      categoryId,
      filter,
      sort: sort === 'relevance' ? undefined : sort, // If sort is relevance, we handle it below
      onlyActive: true,
      page,
      pageSize: limit,
      userId,
      canSeePrices,
    });

    // اگر مرتب‌سازی بر اساس relevance باشد، چون findAll کارهای پایه را انجام داده،
    // ما نتایج را دوباره بر اساس قوانین رتبه‌بندی مرتب می‌کنیم (در مقیاس صفحه جاری).
    if (sort === 'relevance' && productsResult.data.length > 0) {
      productsResult.data.sort((a, b) => {
        const scoreA = this.calculateRelevanceScore(a, normalizedQ);
        const scoreB = this.calculateRelevanceScore(b, normalizedQ);

        // ۱. موجودی انبار اولویت دارد
        if (a.stock > 0 && b.stock === 0) return -1;
        if (a.stock === 0 && b.stock > 0) return 1;

        // ۲. امتیاز بالاتر
        if (scoreA !== scoreB) return scoreB - scoreA;

        // ۳. جدیدتر بودن
        return b.id.localeCompare(a.id);
      });
    }

    // ۳. ثبت در لاگ (Analytics)
    await this.logSearch({
      userId,
      query: q,
      queryNormalized: normalizedQ,
      resultsCount: productsResult.meta.total,
      hadResults: productsResult.meta.total > 0 || matchedCategories.length > 0,
      categoryId,
    });

    return {
      query: q,
      normalized_query: normalizedQ,
      categories: matchedCategories.map((c) => ({
        id: c.id,
        name: c.name,
        image_url: c.imageUrl,
        product_count: c._count.products,
      })),
      products: productsResult,
      total_results: productsResult.meta.total,
      has_results: productsResult.meta.total > 0 || matchedCategories.length > 0,
    };
  }

  /**
   * پیشنهادات خودکار (Autocomplete)
   */
  async getSuggestions(q: string, limit = 8) {
    const normalizedQ = normalizePersian(q);
    if (normalizedQ.length < 2) return { suggestions: [] };

    // دسته‌ها (حداکثر ۲)
    const cats = await this.prisma.category.findMany({
      where: { isActive: true, nameNormalized: { startsWith: normalizedQ } },
      take: 2,
    });

    // محصولات
    const prods = await this.prisma.product.findMany({
      where: { isActive: true, nameNormalized: { contains: normalizedQ } },
      take: limit - cats.length,
      orderBy: [{ stock: 'desc' }, { nameNormalized: 'asc' }],
      include: { category: { select: { name: true } } },
    });

    const suggestions = [
      ...cats.map((c) => ({
        type: 'category',
        id: c.id,
        text: c.name,
        image_url: c.imageUrl,
      })),
      ...prods.map((p) => ({
        type: 'product',
        id: p.id,
        text: p.name,
        image_url: p.imageUrl,
        category_name: p.category?.name,
        in_stock: p.stock > 0,
      })),
    ];

    return { suggestions };
  }

  /**
   * تاریخچه جست‌وجوی کاربر
   */
  async getHistory(userId: string) {
    const history = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { searchedAt: 'desc' },
      take: 10,
    });
    return { history };
  }

  async addHistory(userId: string, query: string, resultsCount: number) {
    const normalized = normalizePersian(query);

    // آپدیت اگر تکراری باشد، در غیر این صورت ایجاد
    return this.prisma.searchHistory
      .upsert({
        where: {
          id:
            (await this.prisma.searchHistory.findFirst({ where: { userId, queryNormalized: normalized } }))?.id ||
            'none',
        },
        update: { searchedAt: new Date(), resultsCount },
        create: { userId, query, queryNormalized: normalized, resultsCount },
      })
      .catch(async () => {
        // Fallback for upsert with no unique match found in finding logic
        return this.prisma.searchHistory.create({
          data: { userId, query, queryNormalized: normalized, resultsCount },
        });
      });
  }

  async clearHistory(userId: string, id?: string) {
    if (id) {
      await this.prisma.searchHistory.deleteMany({ where: { id, userId } });
    } else {
      await this.prisma.searchHistory.deleteMany({ where: { userId } });
    }
    return { success: true, message: 'تاریخچه جست‌وجو پاک شد' };
  }

  /**
   * عبارات محبوب
   */
  async getPopular() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // تجمعی از لاگ‌ها
    const popular = await this.prisma.searchLog.groupBy({
      by: ['queryNormalized'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        hadResults: true,
      },
      _count: { _all: true },
      orderBy: { _count: { queryNormalized: 'desc' } },
      take: 10,
    });

    return {
      popular: popular.map((p) => ({ text: p.queryNormalized, type: 'term' })),
      source: 'auto',
    };
  }

  private calculateRelevanceScore(
    product: {
      name: string;
      name_normalized?: string | null;
      is_discounted?: boolean | null;
      is_suggested?: boolean | null;
      is_new?: boolean | null;
    },
    query: string
  ): number {
    let score = 0;
    const name = product.name_normalized || normalizePersian(product.name);

    if (name === query) score += 100;
    else if (name.startsWith(query)) score += 70;
    else if (name.includes(' ' + query)) score += 50;
    else if (name.includes(query)) score += 30;

    if (product.is_discounted) score += 5;
    if (product.is_suggested) score += 3;
    if (product.is_new) score += 2;

    return score;
  }

  private async logSearch(data: Prisma.SearchLogCreateInput) {
    try {
      await this.prisma.searchLog.create({ data });
    } catch (e) {
      console.error('Failed to log search:', e);
    }
  }

  // Admin Analytics
  getAnalytics(params: { date_from?: string; date_to?: string; only_zero_results?: boolean }) {
    // TODO: پیاده‌سازی منطق تحلیل برای ادمین
    void params;
    return { data: [], meta: {} };
  }
}
