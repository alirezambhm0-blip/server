import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  async findAllActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Admin Methods
  async listAll(page = 1, pageSize = 20) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.banner.count(),
      this.prisma.banner.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(data: Prisma.BannerCreateInput) {
    return this.prisma.banner.create({ data });
  }

  async update(id: string, data: Prisma.BannerUpdateInput) {
    return this.prisma.banner.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }
}
