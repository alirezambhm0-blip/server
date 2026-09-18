import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
// B32 / P2-2 — DTOهای واقعی به‌جای تایپ inline.
// تایپ inline در زمان اجرا از بین می‌رفت، پس ValidationPipe سراسری روی این
// endpointها هیچ اثری نداشت. قرارداد API تغییر نکرده است.
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CreateAdminOrderDto } from './dto/create-admin-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // مشتری
  /** ثبت سفارش از روی سبد خرید — آدرس می‌تواند آدرس پیش‌فرض مشتری یا آدرس جایگزین باشد */
  @Post()
  create(@GetUser() user: RequestUser, @Body() body: CreateOrderDto) {
    return this.orders.createFromCart(
      user.userId,
      body.delivery_address,
      body.is_alternative_address,
      body.customer_note,
      body.idempotency_key
    );
  }

  /** لیست سفارش‌های مشتری جاری با فیلتر (all/active/...) و صفحه‌بندی (سقف pageSize=100) */
  @Get()
  mine(
    @GetUser() user: RequestUser,
    @Query('filter') filter?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    return this.orders.listCustomerOrders(
      user.userId,
      filter,
      page ? Number(page) : 1,
      pageSize ? Math.min(Number(pageSize), 100) : 10
    );
  }

  /** آخرین سفارش مشتری جاری */
  @Get('latest')
  latest(@GetUser() user: RequestUser) {
    return this.orders.getLatestOrder(user.userId);
  }

  /** سفارش‌های فعال مشتری جاری (PENDING تا SHIPPED) */
  @Get('active')
  active(@GetUser() user: RequestUser) {
    return this.orders.getActiveOrders(user.userId);
  }

  /** جزئیات یک سفارش متعلق به مشتری جاری */
  @Get(':id')
  one(@GetUser() user: RequestUser, @Param('id') id: string) {
    return this.orders.getOrder(user.userId, id);
  }

  /** لغو سفارش توسط مشتری (فقط در وضعیت‌های قابل لغو) با دلیل اختیاری */
  @Post(':id/cancel')
  cancel(@GetUser() user: RequestUser, @Param('id') id: string, @Body('reason') reason?: string) {
    return this.orders.cancelOrder(user.userId, id, reason);
  }

  /** دریافت فاکتور سفارش */
  @Get(':id/invoice')
  invoice(@GetUser() user: RequestUser, @Param('id') id: string) {
    return this.orders.getInvoice(user.userId, id);
  }

  // ادمین
  /** ادمین: لیست همه سفارش‌ها با فیلتر وضعیت و صفحه‌بندی */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  all(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: OrderStatus) {
    return this.orders.listAll(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20, status);
  }

  /** ادمین: تغییر وضعیت سفارش/پرداخت — DELIVERED شدن، پرداخت را PAID می‌کند و رویداد نوتیفیکیشن صادر می‌شود */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateOrderStatusDto) {
    return this.orders.updateStatus(id, body.status, body.paymentStatus);
  }

  // ثبت سفارش توسط ادمین (برای سفارشات حضوری یا دستی)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/create')
  async createAdminOrder(@GetUser() user: RequestUser, @Body() body: CreateAdminOrderDto) {
    return this.orders.createAdminOrder(
      user.userId,
      user.customer?.id,
      body.customerId,
      body.guestName,
      body.guestPhone,
      body.newCustomer,
      body.items,
      body.note,
      body.deliveryAddress
    );
  }
}
