import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CartItemInput = { productId: string; quantity: number };

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  private async getCustomerAndCheckAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true },
    });
    if (!user || !user.isActive) {
      throw new ForbiddenException('حساب کاربری شما مسدود شده است');
    }
    if (!user.customer) {
      const customer = await this.prisma.customer.create({
        data: { userId: user.id, status: 'PENDING', onboardingCompleted: false },
      });
      return { user, customer };
    }
    if (user.customer.status === 'BLOCKED') {
      throw new ForbiddenException('حساب شما مسدود شده است');
    }
    return { user, customer: user.customer };
  }

  async getCart(userId: string) {
    const { customer } = await this.getCustomerAndCheckAccess(userId);

    const items = await this.prisma.cartItem.findMany({
      where: { customerId: customer.id },
      include: {
        product: {
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const warnings: {
      type: string;
      product_id: string;
      product_name: string;
      message: string;
      available_stock?: number;
      requested_quantity?: number;
    }[] = [];
    const processedItems = items.map((item) => {
      const p = item.product;
      if (!p || !p.isActive) {
        warnings.push({
          type: 'out_of_stock',
          product_id: item.productId,
          product_name: p?.name || 'محصول نامشخص',
          message: 'این محصول در حال حاضر ناموجود است.',
        });
        return {
          id: item.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: 0,
          line_total: 0,
          line_discount: 0,
          stock_warning: 'out_of_stock',
          product: { is_available: false, name: p?.name || 'نامشخص' },
        };
      }

      let stockWarning: string | null = null;
      let isAvailable = true;

      if (p.stock <= 0) {
        stockWarning = 'out_of_stock';
        isAvailable = false;
        warnings.push({
          type: 'out_of_stock',
          product_id: p.id,
          product_name: p.name,
          message: 'این محصول در حال حاضر ناموجود است.',
        });
      } else if (item.quantity > p.stock) {
        stockWarning = 'quantity_exceeds_stock';
        warnings.push({
          type: 'stock_exceeded',
          product_id: p.id,
          product_name: p.name,
          available_stock: p.stock,
          requested_quantity: item.quantity,
          message: `موجودی این محصول کاهش یافته. حداکثر موجودی: ${p.stock} عدد`,
        });
      } else if (p.stock <= 5) {
        stockWarning = 'low_stock';
      }

      const unitPrice = p.price;
      const originalPrice = p.oldPrice || p.price;

      return {
        id: item.id,
        product_id: p.id,
        product: {
          id: p.id,
          name: p.name,
          image_url: p.imageUrl,
          unit_label: p.unit,
          price: originalPrice,
          discounted_price: p.isDiscounted ? p.price : null,
          original_price: originalPrice,
          stock: p.stock,
          is_available: isAvailable,
        },
        quantity: item.quantity,
        unit_price: unitPrice,
        line_total: unitPrice * item.quantity,
        line_discount: (originalPrice - unitPrice) * item.quantity,
        stock_warning: stockWarning,
      };
    });

    const validItems = processedItems.filter((i) => i.product.is_available);
    const subtotal = validItems.reduce((sum, i) => sum + (i.line_total || 0), 0);
    const totalDiscount = validItems.reduce((sum, i) => sum + (i.line_discount || 0), 0);
    const totalQuantity = validItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

    return {
      items: processedItems,
      summary: {
        items_count: validItems.length,
        total_quantity: totalQuantity,
        subtotal: subtotal + totalDiscount,
        total_discount: totalDiscount,
        final_total: subtotal,
      },
      user_default_address: customer.address || '',
      warnings,
    };
  }

  async addItem(userId: string, productId: string, quantity = 1) {
    const { customer } = await this.getCustomerAndCheckAccess(userId);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    if (!product) throw new NotFoundException('محصول یافت نشد');
    if (!product.isActive || product.stock <= 0) throw new UnprocessableEntityException('این محصول ناموجود است');
    if (quantity > product.stock)
      throw new UnprocessableEntityException(`موجودی این محصول کافی نیست. موجودی فعلی: ${product.stock} عدد`);

    await this.prisma.cartItem.upsert({
      where: { customerId_productId: { customerId: customer.id, productId } },
      update: { quantity },
      create: { customerId: customer.id, productId, quantity },
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    const { customer } = await this.getCustomerAndCheckAccess(userId);
    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({ where: { customerId: customer.id, productId } });
    } else {
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw new NotFoundException();
      if (quantity > product.stock)
        throw new UnprocessableEntityException(`موجودی این محصول کافی نیست. موجودی فعلی: ${product.stock} عدد`);

      await this.prisma.cartItem.updateMany({
        where: { customerId: customer.id, productId },
        data: { quantity },
      });
    }
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const { customer } = await this.getCustomerAndCheckAccess(userId);
    await this.prisma.cartItem.deleteMany({ where: { customerId: customer.id, productId } });
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const { customer } = await this.getCustomerAndCheckAccess(userId);
    await this.prisma.cartItem.deleteMany({ where: { customerId: customer.id } });
    return this.getCart(userId);
  }

  async validateCart(userId: string) {
    const cart = await this.getCart(userId);
    const isValid = cart.warnings.length === 0 && cart.items.length > 0;
    return { is_valid: isValid, warnings: cart.warnings, cart };
  }

  async reorder(userId: string, orderId: string, mode: 'add' | 'replace') {
    return this.prisma.$transaction(async (tx) => {
      const { customer } = await this.getCustomerAndCheckAccess(userId);
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || order.customerId !== customer.id) throw new NotFoundException();

      if (mode === 'replace') await tx.cartItem.deleteMany({ where: { customerId: customer.id } });

      const summary: {
        added: { product_id: string; name: string; quantity: number }[];
        adjusted: {
          product_id: string;
          name: string;
          original_quantity: number;
          adjusted_quantity: number;
          reason: string;
        }[];
        unavailable: { product_id: string; name: string; reason: string }[];
      } = { added: [], adjusted: [], unavailable: [] };

      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || !product.isActive || product.stock <= 0) {
          summary.unavailable.push({ product_id: item.productId, name: item.productName, reason: 'out_of_stock' });
          continue;
        }

        const qty = Math.min(item.quantity, product.stock);
        await tx.cartItem.upsert({
          where: { customerId_productId: { customerId: customer.id, productId: item.productId } },
          update: { quantity: qty },
          create: { customerId: customer.id, productId: item.productId, quantity: qty },
        });

        if (qty < item.quantity) {
          summary.adjusted.push({
            product_id: product.id,
            name: product.name,
            original_quantity: item.quantity,
            adjusted_quantity: qty,
            reason: 'stock_limited',
          });
        } else {
          summary.added.push({ product_id: product.id, name: product.name, quantity: qty });
        }
      }

      const cart = await this.getCart(userId);
      return { cart, summary };
    });
  }

  async mergeWithServer(userId: string, localItems: CartItemInput[]) {
    // اعتبارسنجی دسترسی کاربر (آیتم‌های نامعتبر محلی نادیده گرفته می‌شوند)
    await this.getCustomerAndCheckAccess(userId);
    for (const item of localItems) {
      try {
        await this.addItem(userId, item.productId, item.quantity);
      } catch {
        // آیتم نامعتبر لوکال نادیده گرفته می‌شود تا بقیه merge انجام شود
      }
    }
    return this.getCart(userId);
  }
}
