/**
 * ============================================================================
 * P2-9 — تست data isolation در VisitorSalesService
 * ============================================================================
 *
 * چرا این تست لازم است؟
 *   پیش از این، getDashboard یک الگوی fail-open داشت:
 *
 *       let visitorFilter;
 *       try {
 *         visitorFilter = isAdmin ? {} : { placedByUserId: userId };
 *         await this.prisma.order.count({ where: visitorFilter });   // probe
 *       } catch {
 *         visitorFilter = {};      // ← نشت داده: همهٔ سفارشات همه
 *       }
 *
 *   شرط موردنظر آن catch («ستون placedByUserId وجود ندارد») از migration
 *   20260817203724_add_items_per_package به بعد هرگز رخ نمی‌دهد، ولی همان
 *   catch هر خطای دیگری را هم می‌بلعید — قطعی دیتابیس (P1001)، timeout
 *   استخر اتصال (P2024) و غیره. در آن حالت‌ها یک ویزیتور معمولی داشبورد
 *   «همهٔ سفارشات همه» را می‌دید.
 *
 *   این تست روی سرویس واقعی اجرا می‌شود و قفل می‌کند که:
 *     ۱) خطای probe هرگز منجر به فیلتر خالی نشود،
 *     ۲) خطا به‌صورت کنترل‌شده بالا برود (fail-closed)،
 *     ۳) رفتار ادمین و ویزیتور سالم تغییر نکند.
 * ============================================================================
 */
import { ServiceUnavailableException } from '@nestjs/common';
import { VisitorSalesService } from './visitor-sales.service';
import { PrismaService } from '../prisma/prisma.service';

const VISITOR_ID = 'visitor-7';
const ADMIN_ID = 'admin-1';

type Where = Record<string, unknown>;

function makePrisma(opts: { probeFails?: boolean } = {}) {
  const captured: Where[] = [];

  // mock ها بیرون از آبجکت ساخته می‌شوند تا بتوان بدون جدا کردن متد از آبجکت
  // (که قاعدهٔ unbound-method را نقض می‌کند) آن‌ها را assert کرد.
  const countMock = jest.fn().mockImplementation(() => {
    // probe در getDashboard — اگر قرار باشد خطا بدهد، همین‌جا می‌دهد
    if (opts.probeFails) {
      return Promise.reject(new Error('P1001: Can not reach database server'));
    }
    return Promise.resolve(0);
  });

  const prisma = {
    order: {
      count: countMock,
      findMany: jest.fn().mockImplementation((args: { where: Where }) => {
        captured.push(args.where);
        return Promise.resolve([]);
      }),
    },
    orderItem: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { _all: 0 } }),
    },
  };

  return { prisma: prisma as unknown as PrismaService, captured, countMock };
}

describe('P2-9 — VisitorSalesService data isolation', () => {
  describe('getDashboard', () => {
    it('⚠️ خطای probe هرگز فیلتر را خالی نمی‌کند (نشت داده بسته شد)', async () => {
      const { prisma, captured } = makePrisma({ probeFails: true });
      const svc = new VisitorSalesService(prisma);

      // هستهٔ P2-9: پیش از این، این سناریو باعث می‌شد visitorFilter = {} شود
      // و کوئری نهایی «همهٔ سفارشات همه» را برگرداند.
      await expect(svc.getDashboard(VISITOR_ID, false)).rejects.toThrow(ServiceUnavailableException);

      // هیچ کوئری داده‌ای با فیلتر خالی اجرا نشده باشد
      const leaked = captured.filter((w) => Object.keys(w).every((k) => k === 'createdAt'));
      expect(leaked).toHaveLength(0);
      // اصلاً هیچ findMany اجرا نشده باشد — باید قبل از آن fail شود
      expect(captured).toHaveLength(0);
    });

    it('پیام خطا اطلاعات حساس دیگران را فاش نمی‌کند', async () => {
      const { prisma } = makePrisma({ probeFails: true });
      const svc = new VisitorSalesService(prisma);

      let err: Error | null = null;
      try {
        await svc.getDashboard(VISITOR_ID, false);
      } catch (e) {
        err = e as Error;
      }
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      // پیام عمومی است، نه جزئیات داخلی
      expect(err!.message).not.toMatch(/P1001|P2024|prisma|sql/i);
    });

    it('ویزیتور سالم → فیلتر روی placedByUserId خودش محدود می‌ماند', async () => {
      const { prisma, captured } = makePrisma();
      const svc = new VisitorSalesService(prisma);

      await svc.getDashboard(VISITOR_ID, false);

      expect(captured.length).toBeGreaterThan(0);
      // هر کوئری باید دامنهٔ ویزیتور را داشته باشد
      for (const where of captured) {
        expect(where.placedByUserId).toBe(VISITOR_ID);
      }
    });

    it('ادمین → فیلتر خالی (همه را می‌بیند) و probe هم اجرا نمی‌شود', async () => {
      const { prisma, captured, countMock } = makePrisma();
      const svc = new VisitorSalesService(prisma);

      await svc.getDashboard(ADMIN_ID, true);

      expect(captured.length).toBeGreaterThan(0);
      for (const where of captured) {
        expect(where.placedByUserId).toBeUndefined();
      }
      // probe فقط برای ویزیتور است؛ برای ادمین بی‌فایده بود.
      expect(countMock).not.toHaveBeenCalled();
    });

    it('ساختار پاسخ برای ویزیتور سالم تغییر نکرده است', async () => {
      const { prisma } = makePrisma();
      const svc = new VisitorSalesService(prisma);

      const result = await svc.getDashboard(VISITOR_ID, false);

      expect(Object.keys(result).sort()).toEqual(['recentOrders', 'thisMonth', 'thisWeek', 'today']);
    });
  });

  describe('getVisitorOrders — الگوی fail-closed از قبل موجود', () => {
    it('ویزیتور فقط سفارشات خودش را می‌گیرد', async () => {
      const wheres: Where[] = [];
      const prisma = {
        order: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockImplementation((a: { where: Where }) => {
            wheres.push(a.where);
            return Promise.resolve([]);
          }),
        },
        $transaction: jest.fn().mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
      } as unknown as PrismaService;

      const svc = new VisitorSalesService(prisma);
      await svc.getVisitorOrders(VISITOR_ID, false);

      expect(wheres.length).toBeGreaterThan(0);
      for (const w of wheres) expect(w.placedByUserId).toBe(VISITOR_ID);
    });

    it('خطای دیتابیس → لیست خالی، نه همهٔ رکوردها (fail-closed)', async () => {
      // getVisitor ابتدا promiseهای count/findMany را می‌سازد و بعد به
      // $transaction می‌دهد. اگر آن promiseها زود reject شوند، unhandled
      // rejection رخ می‌دهد؛ پس آن‌ها را «هرگز settle نشونده» نگه می‌داریم و
      // خطا را از خودِ $transaction می‌دهیم — دقیقاً همان چیزی که Prisma در
      // حالت قطعی/timeout اتصال برمی‌گرداند.
      const never = () => new Promise<never>(() => undefined);

      const prisma = {
        order: {
          count: jest.fn().mockImplementation(() => never()),
          findMany: jest.fn().mockImplementation(() => never()),
        },
        $transaction: jest.fn().mockRejectedValue(new Error('P2024')),
      } as unknown as PrismaService;

      const svc = new VisitorSalesService(prisma);
      const res = await svc.getVisitorOrders(VISITOR_ID, false);

      expect(res.data).toEqual([]);
      expect(res.meta.total).toBe(0);
    });
  });
});
