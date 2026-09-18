import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePersian } from '../common/utils/normalization';

function slugify(input: string): string {
  return (
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || `c-${Date.now()}`
  );
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(onlyActive = true, page = 1, pageSize = 20) {
    const where = onlyActive ? { isActive: true } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  findOne(idOrSlug: string) {
    return this.prisma.category.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        products: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async create(input: { name: string; slug?: string; imageUrl?: string; isActive?: boolean; sortOrder?: number }) {
    let slug = input.slug?.trim() || slugify(input.name);
    let i = 1;
    const base = slug;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return this.prisma.category.create({
      data: {
        name: input.name.trim(),
        nameNormalized: normalizePersian(input.name),
        slug,
        imageUrl: input.imageUrl,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('دسته‌بندی یافت نشد');

    if (typeof data.name === 'string') {
      data.nameNormalized = normalizePersian(data.name);
    }

    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('دسته‌بندی یافت نشد');
    // بررسی اینکه محصولی در این دسته‌بندی نباشد
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      // به‌جای حذف سخت، غیرفعال می‌کنیم
      return this.prisma.category.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.category.delete({ where: { id } });
  }

  async hardDelete(id: string) {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('دسته‌بندی یافت نشد');
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      // B11 — قبلاً Error خام → HTTP 500
      throw new BadRequestException(
        'این دسته‌بندی دارای محصول است و نمی‌توان آن را به طور کامل حذف کرد. لطفاً ابتدا محصولات آن را حذف یا جابجا کنید.'
      );
    }
    return this.prisma.category.delete({ where: { id } });
  }
}
