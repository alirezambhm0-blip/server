import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CustomerStatus,
  NotificationTargetType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductUnit,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { BannersService } from '../banners/banners.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { ProductsService } from '../products/products.service';
import { CategoriesService } from '../categories/categories.service';
import { OrdersService } from '../orders/orders.service';
import { FilesService } from '../files/files.service';
import type { UploadedFile as UploadedImageFile } from '../files/files.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';

/** بدنه‌ی ساخت محصول — مشتق از ورودی سرویس (بدون تغییر رفتار Validation در runtime) */
type AdminProductCreateBody = Parameters<ProductsService['create']>[0];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly productsSvc: ProductsService,
    private readonly categoriesSvc: CategoriesService,
    private readonly ordersSvc: OrdersService,
    private readonly bannersSvc: BannersService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly files: FilesService
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboardStats();
  }

  // ------- مشتریان -------
  @Get('customers')
  customers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: CustomerStatus,
    @Query('search') search?: string
  ) {
    return this.admin.listCustomers({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
      search,
    });
  }

  // جست‌وجوی سریع مشتری برای فروش حضوری (نام / شماره تماس / نام فروشگاه / کد ملی)
  // باید قبل از `customers/:id` تعریف شود تا کلمه‌ی 'search' به‌عنوان id گرفته نشود
  @Get('customers/search')
  async customerSearch(@Query('q') q?: string, @Query('limit') limit?: string) {
    if (!q || !String(q).trim()) return { customers: [] };
    const r = await this.admin.listCustomers({
      search: String(q).trim(),
      pageSize: limit ? Number(limit) : 6,
    });
    return {
      customers: r.items.map((c) => ({
        id: c.id,
        storeName: c.storeName || '',
        ownerName: [c.firstName, c.lastName].filter(Boolean).join(' ') || '',
        phone: (c.user && c.user.phone) || '',
        address: [c.province, c.city, c.address].filter(Boolean).join('، ') || '',
      })),
    };
  }

  @Get('customers/:id')
  customer(@Param('id') id: string) {
    return this.admin.getCustomer(id);
  }

  @Delete('customers/:id/hard')
  hardDeleteCustomer(@Param('id') id: string) {
    return this.admin.hardDeleteCustomer(id);
  }

  @Post('customers')
  createCustomer(@Body() body: Parameters<AdminService['createCustomer']>[0]) {
    return this.admin.createCustomer(body);
  }

  @Put('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() body: Parameters<AdminService['updateCustomer']>[1]) {
    return this.admin.updateCustomer(id, body);
  }

  @Patch('customers/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: CustomerStatus; notes?: string }) {
    return this.admin.updateCustomerStatus(id, body.status, body.notes);
  }

  // ------- سفارش‌ها -------
  @Get('orders')
  orders(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: OrderStatus) {
    return this.ordersSvc.listAll(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20, status);
  }

  @Patch('orders/:id/status')
  orderStatus(@Param('id') id: string, @Body() body: { status?: OrderStatus; paymentStatus?: PaymentStatus }) {
    return this.ordersSvc.updateStatus(id, body.status, body.paymentStatus);
  }

  @Delete('orders/:id/hard')
  hardDeleteOrder(@Param('id') id: string) {
    return this.ordersSvc.hardDelete(id);
  }

  // ------- محصولات و دسته‌بندی -------
  @Get('products')
  async products(@Query('all') all?: string, @Query('categoryId') categoryId?: string) {
    // Admin needs raw Prisma fields (isActive, isNew, isFeatured, imageUrl, etc.)
    // findAll() transforms these into snake_case mobile-friendly shapes — wrong for admin UI
    const where: Prisma.ProductWhereInput = {};
    if (all !== '1') where.isActive = true;
    if (categoryId) where.categoryId = categoryId;
    const items = await this.prisma.product.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      take: 500,
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return { items, total: items.length };
  }

  @Get('products/:id')
  async productById(@Param('id') id: string) {
    // Return raw Prisma data so admin form gets isActive, isNew, isFeatured, etc.
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!p) throw new NotFoundException('محصول یافت نشد');
    return p;
  }

  @Post('products')
  createProduct(@Body() body: AdminProductCreateBody) {
    return this.productsSvc.create({
      name: body.name,
      categoryId: body.categoryId,
      slug: body.slug,
      description: body.description,
      imageUrl: body.imageUrl,
      galleryImages: body.galleryImages,
      brand: body.brand,
      productCode: body.productCode,
      unitDetails: body.unitDetails,
      itemsPerPackage: body.itemsPerPackage,
      packageType: body.packageType,
      price: body.price,
      costPrice: body.costPrice,
      oldPrice: body.oldPrice,
      unit: body.unit,
      stock: body.stock,
      minOrderQty: body.minOrderQty,
      isActive: body.isActive,
      isFeatured: body.isFeatured,
      isNew: body.isNew,
      isDiscounted: body.isDiscounted,
      sortOrder: body.sortOrder,
    });
  }

  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() body: AdminProductCreateBody) {
    // ساخت دستی data برای عبور از validation pipe
    const data: Prisma.ProductUpdateInput & { categoryId?: string } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.description !== undefined) data.description = body.description;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.galleryImages !== undefined) data.galleryImages = body.galleryImages;
    if (body.brand !== undefined) data.brand = body.brand;
    if (body.productCode !== undefined) data.productCode = body.productCode;
    if (body.unitDetails !== undefined) data.unitDetails = body.unitDetails;
    if (body.itemsPerPackage !== undefined) data.itemsPerPackage = body.itemsPerPackage;
    if (body.packageType !== undefined) data.packageType = body.packageType;
    if (body.price !== undefined) data.price = body.price;
    if (body.costPrice !== undefined) data.costPrice = body.costPrice;
    if (body.oldPrice !== undefined) data.oldPrice = body.oldPrice;
    if (body.unit !== undefined) data.unit = body.unit as ProductUnit;
    if (body.stock !== undefined) data.stock = body.stock;
    if (body.minOrderQty !== undefined) data.minOrderQty = body.minOrderQty;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
    if (body.isNew !== undefined) data.isNew = body.isNew;
    if (body.isDiscounted !== undefined) data.isDiscounted = body.isDiscounted;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    return this.productsSvc.update(id, data);
  }

  @Delete('products/:id/hard')
  hardDeleteProduct(@Param('id') id: string) {
    return this.productsSvc.hardDelete(id);
  }

  // ------- تنظیمات بیزینس -------
  @Get('settings')
  async getSettings() {
    return this.productsSvc.getSettings();
  }

  @Post('settings')
  async updateSetting(@Body() body: { key: string; value: string }) {
    return this.productsSvc.updateSetting(body.key, body.value);
  }

  @Get('categories')
  categories(@Query('all') all?: string) {
    return this.categoriesSvc.findAll(all !== '1');
  }

  @Post('categories')
  createCategory(@Body() body: CreateCategoryDto) {
    return this.categoriesSvc.create(body);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.categoriesSvc.update(id, body);
  }

  @Delete('categories/:id/hard')
  hardDeleteCategory(@Param('id') id: string) {
    return this.categoriesSvc.hardDelete(id);
  }

  /** آپلود تصویر محصول (ادمین) */
  @Post('upload/product')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadProduct(@UploadedFile() file?: UploadedImageFile) {
    if (!file) return { error: 'no file' };
    const filename = await this.files.saveProductImage(file);
    return { filename, url: this.files.getPublicUrl('product', filename) };
  }

  /** آپلود تصویر دسته‌بندی (ادمین) */
  @Post('upload/category')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadCategory(@UploadedFile() file?: UploadedImageFile) {
    if (!file) return { error: 'no file' };
    const filename = await this.files.saveCategoryImage(file);
    return { filename, url: this.files.getPublicUrl('category', filename) };
  }

  // ------- لاگ‌ها -------
  @Get('otp-attempts')
  otpAttempts(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('phone') phone?: string) {
    return this.admin.listOtpAttempts({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
      phone,
    });
  }

  // ------- سیستم تیکتینگ (ادمین) -------
  @Get('tickets')
  async getAllTickets(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: TicketStatus
  ) {
    return this.admin.getAllTickets({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
    });
  }

  @Post('tickets/:id/reply')
  async replyToTicket(@Param('id') id: string, @Body() body: { message: string }, @GetUser() user: RequestUser) {
    return this.admin.replyToTicket(id, body.message, user.userId);
  }

  @Patch('tickets/:id/status')
  async updateTicketStatus(@Param('id') id: string, @Body() body: { status: TicketStatus }) {
    return this.admin.updateTicketStatus(id, body.status);
  }

  // ------- سیستم اعلان‌ها (ادمین) -------
  @Get('notifications')
  async getAllNotifications(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.admin.getAllNotifications(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Post('notifications')
  async createNotification(
    @Body()
    body: {
      title: string;
      body: string;
      targetType: NotificationTargetType;
      targetStatus?: CustomerStatus;
      targetUsers?: string[];
      sendPush?: boolean;
    }
  ) {
    return this.admin.createNotification(body);
  }

  // ------- درخواست‌های تغییر پروفایل -------
  @Get('profile-changes')
  async listProfileChanges(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.authService.listProfileChanges(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Post('profile-changes/:id/approve')
  async approveProfileChange(@Param('id') id: string, @Body() body: { adminNotes?: string }) {
    return this.authService.approveChange(id, body.adminNotes);
  }

  @Post('profile-changes/:id/reject')
  async rejectProfileChange(@Param('id') id: string, @Body() body: { adminNotes?: string }) {
    return this.authService.rejectChange(id, body.adminNotes);
  }

  // ------- بنرها -------
  @Get('banners')
  banners(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.bannersSvc.listAll(page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Post('banners')
  createBanner(@Body() body: Parameters<BannersService['create']>[0]) {
    return this.bannersSvc.create(body);
  }

  @Put('banners/:id')
  updateBanner(@Param('id') id: string, @Body() body: Parameters<BannersService['update']>[1]) {
    return this.bannersSvc.update(id, body);
  }

  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.bannersSvc.remove(id);
  }

  @Post('upload/banner')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async uploadBanner(@UploadedFile() file?: UploadedImageFile) {
    if (!file) return { error: 'no file' };
    const filename = await this.files.saveBannerImage(file);
    return { filename, url: this.files.getPublicUrl('banner', filename) };
  }

  // ------- بخش پیشرفته امنیت -------
  @Get('security/stats')
  async getSecurityStats() {
    return this.admin.getSecurityStats();
  }

  @Get('security/errors')
  async getErrorLogs(@Query('page') page = '1') {
    return this.admin.getErrorLogs(Number(page));
  }

  @Get('security/active-users')
  async getActiveUsers() {
    return this.admin.getActiveUsers();
  }

  // ------- چاپ فاکتور A5 (Professional / B2B) -------
  @Get('orders/:id/invoice-print')
  async invoicePrint(@Param('id') id: string, @Res() res: Response) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, customer: { include: { user: true } }, statusHistory: true },
    });
    if (!order) {
      res.status(404).send('سفارش یافت نشد');
      return;
    }

    const o = order;
    const fa = (n: number | string) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

    const date = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(o.createdAt);

    // ---- تنظیمات فروشگاه/فاکتور (از جدول settings؛ بدون داده‌ی ساختگی) ----
    const settingsRows = await this.prisma.setting.findMany();
    const settings: Record<string, string> = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });
    const storeName = settings.STORE_NAME || 'بنکو پخش';
    const visitorPhone = settings.VISITOR_PHONE || '';
    const driverPhone = settings.DRIVER_PHONE || '';
    const storePhone = settings.STORE_PHONE || '';
    const storeAddress = settings.STORE_ADDRESS || '';
    const supportPhone = settings.SUPPORT_PHONE || '';

    // ---- اطلاعات واقعی سفارش/مشتری ----
    const customer = o.customer;
    // سفارش مهمان/بدون پروفایل: وقتی شناسه مشتری (customerId) وجود ندارد
    const isGuest = !o.customerId;
    const fullName = ((customer?.firstName || '') + ' ' + (customer?.lastName || '')).trim() || o.guestName || '';
    const buyerStore = customer?.storeName || '';
    const custPhone = customer?.user?.phone || o.guestPhone || '';
    const nationalCode = customer?.nationalCode || '';
    // اولویت آدرس: آدرس جایگزین سفارش → سپس آدرس مشتری
    const address =
      o.alternativeAddress || [customer?.province, customer?.city, customer?.address].filter(Boolean).join('، ');

    let orderNote = String(o.note ?? '').trim();
    if (orderNote === 'ثبت ادمین') orderNote = ''; // یادداشت داخلی ثبت ادمین چاپ نشود

    // ---- مالی: همان مقادیر موجود در سفارش — بدون احتساب مجدد ----
    const subtotal = o.subtotalAmount != null ? o.subtotalAmount : o.totalAmount;
    const shipping = o.shippingAmount || 0;
    const discount = subtotal + shipping - o.totalAmount;
    const finalDiscount = discount > 0 ? discount : 0;

    // ---- دادهی موردنیاز فاکتور (برای ساخت سمت کلاینت و صفحهبندی) ----
    const invData = {
      storeName,
      visitorPhone,
      driverPhone,
      storePhone,
      storeAddress,
      supportPhone,
      isGuest: !!isGuest,
      orderNumber: o.orderNumber,
      dateStr: date,
      fullName: fullName || '',
      buyerStore: buyerStore || '',
      custPhone: custPhone || '',
      nationalCode: nationalCode || '',
      custAddr: address || '',
      items: o.items.map((it) => ({
        productName: it.productName,
        itemsPerPackageLabel: it.itemsPerPackageLabel || '',
        quantity: it.quantity,
        productPrice: it.productPrice,
        lineTotal: it.lineTotal,
      })),
      subtotal,
      shipping,
      discount: finalDiscount,
      total: o.totalAmount,
      note: orderNote,
    };

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاکتور ${fa(o.orderNumber)}</title>
  <style>
    @page { size: A5 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Vazirmatn','IRANSans',Tahoma,sans-serif; font-size: 11px; line-height: 1.55; direction: rtl; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-wrap { max-width: 148mm; margin: 0 auto; }
    .invoice-a5-page { width: 148mm; height: 210mm; margin: 0 auto 12px; padding: 8mm 7mm; background: #fff; color: #0f172a; direction: rtl; font-size: 11px; line-height: 1.55; text-align: right; display: flex; flex-direction: column; box-shadow: 0 2px 16px rgba(0,0,0,.18); border: 1px solid #e2e8f0; overflow: hidden; }
    .invoice-a5-page * { box-sizing: border-box; }
    .invoice-a5-measure { position: absolute; left: -99999px; top: 0; visibility: hidden; width: 134mm; direction: rtl; text-align: right; }
    .inv-header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 11px; }
    .inv-brand-row { text-align: center; font-size: 18px; font-weight: 800; margin-bottom: 6px; }
    .inv-header-lower { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .inv-meta { text-align: right; flex: 0 0 auto; }
    .inv-title { font-size: 14px; font-weight: 800; margin-bottom: 4px; }
    .inv-meta-row { font-size: 10.5px; color: #334155; margin-top: 1px; }
    .inv-meta-row b { font-weight: 700; color: #0f172a; }
    .inv-contacts { text-align: left; font-size: 10.5px; color: #334155; flex: 0 0 auto; }
    .inv-contact-row { margin-top: 1px; }
    .inv-contact-row b { font-weight: 700; color: #0f172a; }
    .inv-panel { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; margin-bottom: 11px; }
    .inv-panel-title { font-size: 11px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 7px; }
    .inv-cust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
    .inv-fld { display: flex; gap: 5px; font-size: 10.5px; align-items: baseline; }
    .inv-fld .k { color: #475569; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
    .inv-fld .v { color: #0f172a; font-weight: 500; word-wrap: break-word; overflow-wrap: break-word; }
    .inv-fld-wide { grid-column: 1 / -1; }
    .inv-fld-pull { transform: translateX(40px); }
    .inv-table-title { font-size: 11px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 8px; }
    .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
    .inv-table th { border: 1px solid #94a3b8; background: #f1f5f9; font-weight: 700; padding: 5px 4px; text-align: center; font-size: 10px; }
    .inv-table td { border: 1px solid #cbd5e1; padding: 4px 5px; vertical-align: middle; font-size: 10px; }
    .inv-table td.c { text-align: center; }
    .inv-table td.num { text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; direction: ltr; }
    .inv-table td.name { text-align: right; }
    .inv-name { font-weight: 600; word-wrap: break-word; overflow-wrap: break-word; }
    .inv-pack { font-size: 9.5px; color: #334155; word-wrap: break-word; overflow-wrap: break-word; }
    .inv-sum-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 8px; font-size: 11px; }
    .inv-sum-row .k { color: #334155; }
    .inv-sum-row .v { font-variant-numeric: tabular-nums; text-align: left; }
    .inv-sum-total { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; background: #f8fafc; font-weight: 800; font-size: 13px; padding: 7px 8px; margin-top: 4px; }
    .inv-sum-total .v { font-size: 14px; }
    .inv-notes { margin-top: 9px; border-top: 1px solid #e2e8f0; padding-top: 7px; }
    .inv-notes-label { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 3px; }
    .inv-notes-text { font-size: 10.5px; color: #0f172a; white-space: pre-wrap; }
    .inv-footer { margin-top: auto; display: flex; flex-direction: column; border-top: 1px solid #cbd5e1; padding-top: 9px; font-size: 9.5px; color: #334155; }
    .inv-store-info { width: 100%; text-align: right; }
    .inv-store-info-title { font-weight: 800; font-size: 11px; color: #0f172a; margin-bottom: 4px; }
    .inv-store-info-intro { margin-bottom: 6px; }
    .inv-store-info p { margin: 0 0 2px; line-height: 1.5; }
    .inv-store-info b { color: #0f172a; }
    .inv-store-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; margin-top: 2px; }
    .inv-sigs { display: flex; gap: 24px; margin-top: 16px; padding-top: 10px; }
    .inv-sig { flex: 1; text-align: center; }
    .inv-sig-label { font-size: 9.5px; font-weight: 700; color: #475569; margin-bottom: 2px; }
    .inv-sig-line { height: 26px; border-bottom: 1px solid #94a3b8; }
    .no-print button { padding: 12px 30px; background: #2563EB; color: #fff; border: 0; border-radius: 8px; font-size: 14px; cursor: pointer; font-family: inherit; }
    @media print {
      @page { size: A5 portrait; margin: 0; }
      body, html { margin: 0; padding: 0; background: #fff !important; }
      .invoice-a5-page { width: 148mm !important; height: 210mm !important; margin: 0 auto !important; padding: 8mm 7mm !important; box-shadow: none !important; border: none !important; overflow: hidden; break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always; }
      .invoice-a5-page.last { break-after: auto; page-break-after: auto; }
      .inv-table { break-inside: auto; page-break-inside: auto; }
      .inv-table tr { break-inside: avoid; page-break-inside: avoid; }
      .invoice-a5-measure { display: none !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-wrap">
    <div class="no-print" style="text-align:center; margin-bottom:14px;">
      <button onclick="window.print()">🖨 چاپ فاکتور</button>
    </div>
    <div id="invRoot"></div>
  </div>
  <script>
    var __INV__ = ${JSON.stringify(invData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')};
    (function(){
      function es(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
      function faNum(x){return Number(x||0).toLocaleString('fa-IR');}
      var D=__INV__;
      var storeName=D.storeName, visitorPhone=D.visitorPhone, driverPhone=D.driverPhone,
          storePhone=D.storePhone, storeAddress=D.storeAddress, supportPhone=D.supportPhone,
          isGuest=D.isGuest, orderNumber=D.orderNumber, dateStr=D.dateStr,
          fullName=D.fullName, buyerStore=D.buyerStore, custPhone=D.custPhone,
          nationalCode=D.nationalCode, custAddr=D.custAddr, items=D.items||[],
          subtotal=D.subtotal, shipping=D.shipping, discount=D.discount, total=D.total, note=D.note||'';
      function fld(label,val,wide,pull){ if(!val) return ''; return '<div class="inv-fld'+(wide?' inv-fld-wide':'')+(pull?' inv-fld-pull':'')+'"><span class="k">'+label+':</span><span class="v">'+es(val)+'</span></div>'; }
      function headerHtml(pageNo,totalPages){
        return '<div class="inv-header"><div class="inv-brand-row">'+es(storeName)+'</div><div class="inv-header-lower">'+
          '<div class="inv-meta"><div class="inv-title">فاکتور فروش</div>'+
          '<div class="inv-meta-row"><b>شماره:</b> '+es(orderNumber)+'</div>'+
          '<div class="inv-meta-row"><b>تاریخ:</b> '+es(dateStr)+'</div></div>'+
          '<div class="inv-contacts">'+(isGuest?'':
            '<div class="inv-contact-row"><b>شماره تماس ویزیتور:</b> '+es(visitorPhone||'—')+'</div>'+
            '<div class="inv-contact-row"><b>شماره تماس راننده:</b> '+es(driverPhone||'—')+'</div>'+
            '<div class="inv-contact-row"><b>صفحه:</b> '+faNum(pageNo)+' از '+faNum(totalPages)+'</div>')+
          '</div></div></div>';
      }
      function buyerHtml(){ return '<div class="inv-panel"><div class="inv-panel-title">اطلاعات خریدار</div><div class="inv-cust-grid">'+
        fld('نام و نام خانوادگی',fullName)+fld('نام فروشگاه',buyerStore,false,true)+fld('شماره تماس',custPhone)+
        fld('کد ملی',nationalCode,false,true)+fld('آدرس',custAddr,true)+'</div></div>'; }
      function titleHtml(){ return '<div class="inv-table-title">جزئیات خرید</div>'; }
      function theadHtml(){ return '<thead><tr><th style="width:5%">ردیف</th><th style="width:30%">شرح کالا</th><th style="width:20%">تعداد در بسته</th><th style="width:10%">تعداد سفارش</th><th style="width:17%">قیمت واحد</th><th style="width:18%">جمع کل</th></tr></thead>'; }
      function rowHtml(it,idx){ return '<tr><td class="c">'+faNum(idx+1)+'</td><td class="name"><div class="inv-name">'+es(it.productName)+'</div></td><td class="c"><div class="inv-pack">'+es(it.itemsPerPackageLabel||'—')+'</div></td><td class="c">'+faNum(it.quantity)+'</td><td class="num">'+faNum(it.productPrice)+'</td><td class="num">'+faNum(it.lineTotal)+'</td></tr>'; }
      function tableHtml(start,end){ var b=''; if(!items.length){ b='<tr><td colspan="6" style="text-align:center;color:#64748b;border:none;">محصولی برای این سفارش ثبت نشده است.</td></tr>'; } else { for(var i=start;i<end;i++) b+=rowHtml(items[i],i); } return '<table class="inv-table">'+theadHtml()+'<tbody>'+b+'</tbody></table>'; }
      function sumHtml(){ var s='<div class="inv-summary"><div class="inv-sum-row"><span class="k">جمع کالاها</span><span class="v">'+faNum(subtotal)+' تومان</span></div>'; if(shipping>0) s+='<div class="inv-sum-row"><span class="k">هزینه ارسال</span><span class="v">'+faNum(shipping)+' تومان</span></div>'; if(discount>0) s+='<div class="inv-sum-row"><span class="k">تخفیف</span><span class="v">'+faNum(discount)+' تومان</span></div>'; s+='<div class="inv-sum-row inv-sum-total"><span class="k">جمع نهایی</span><span class="v">'+faNum(total)+' تومان</span></div></div>'; return s; }
      function notesHtml(){ return '<div class="inv-notes"><div class="inv-notes-label">توضیحات:</div><div class="inv-notes-text">'+es(note||'—')+'</div></div>'; }
      function sigHtml(){ return isGuest?'':'<div class="inv-sigs"><div class="inv-sig"><div class="inv-sig-label">مهر و امضای فروشنده</div><div class="inv-sig-line"></div></div><div class="inv-sig"><div class="inv-sig-label">امضای خریدار</div><div class="inv-sig-line"></div></div></div>'; }
      function footHtml(){ return '<div class="inv-footer"><div class="inv-store-info"><div class="inv-store-info-title">اطلاعات فروشگاه</div><div class="inv-store-intro"><p>این فاکتور بصورت الکترونیکی چاپ شده.</p><p>لطفاً هنگام تحویل سفارش، نسبت به بررسی تعداد و اقلام تحویلی دقت لازم را مبذول فرمایید.</p></div><div class="inv-store-grid">'+(supportPhone?'<div class="inv-fld"><span class="k">شماره پشتیبانی:</span><span class="v">'+es(supportPhone)+'</span></div>':'')+(storePhone?'<div class="inv-fld"><span class="k">تلفن فروشگاه:</span><span class="v">'+es(storePhone)+'</span></div>':'')+(storeAddress?'<div class="inv-fld inv-fld-wide"><span class="k">آدرس '+es(storeName)+':</span><span class="v">'+es(storeAddress)+'</span></div>':'')+'</div></div>'+(isGuest?'':sigHtml())+'</div>'; }
      var pxPerMm=96/25.4, contentHpx=(210-16)*pxPerMm;
      function mg(el,prop){ return el? parseFloat(getComputedStyle(el)[prop]||'0'):0; }
      var m=document.createElement('div'); m.className='invoice-a5-measure';
      m.innerHTML=headerHtml(1,1)+(isGuest?titleHtml():buyerHtml())+tableHtml(0,items.length)+sumHtml()+notesHtml()+footHtml();
      document.body.appendChild(m);
      var hEl=m.querySelector('.inv-header'), titleEl=m.querySelector('.inv-table-title'), buyerEl=m.querySelector('.inv-panel'),
          tblEl=m.querySelector('.inv-table'), theadEl=m.querySelector('.inv-table thead'), sumEl=m.querySelector('.inv-summary'),
          noteEl=m.querySelector('.inv-notes'), footEl=m.querySelector('.inv-footer');
      var headerH=hEl?hEl.offsetHeight:0, mbHeader=mg(hEl,'marginBottom');
      var buyerH=isGuest?0:(buyerEl?buyerEl.offsetHeight:0), mbBuyer=isGuest?0:mg(buyerEl,'marginBottom');
      var titleH=isGuest?(titleEl?titleEl.offsetHeight:0):0, mbTitle=isGuest?mg(titleEl,'marginBottom'):0;
      var theadH=theadEl?theadEl.offsetHeight:0, mbTable=mg(tblEl,'marginBottom');
      var summaryH=sumEl?sumEl.offsetHeight:0, mtSummary=mg(sumEl,'marginTop');
      var notesH=noteEl?noteEl.offsetHeight:0, mtNotes=mg(noteEl,'marginTop');
      var footerH=footEl?footEl.offsetHeight:0;
      var rowHs=[], rowsEls=m.querySelectorAll('.inv-table tbody tr'); for(var r=0;r<rowsEls.length;r++) rowHs.push(rowsEls[r].offsetHeight);
      document.body.removeChild(m);
      function pageUsed(start,end,isFirst,withTail){ var u=headerH+mbHeader; if(isFirst)u+=isGuest?(titleH+mbTitle):(buyerH+mbBuyer); u+=theadH+mbTable; for(var i=start;i<end;i++)u+=rowHs[i]; if(withTail)u+=summaryH+mtSummary+notesH+mtNotes+footerH; return u; }
      var n=items.length, pages=[];
      if(n===0){ pages.push({start:0,end:0,isFirst:true,isLast:true}); }
      else {
        var tailFixed=summaryH+mtSummary+notesH+mtNotes+footerH;
        if(pageUsed(0,n,true,true)<=contentHpx){ pages.push({start:0,end:n,isFirst:true,isLast:true}); }
        else {
          var lastBase=headerH+mbHeader+theadH+mbTable+tailFixed, lastRows=0, used=lastBase;
          for(var i=n-1;i>=0;i--){ if(used+rowHs[i]<=contentHpx){ used+=rowHs[i]; lastRows++; } else break; }
          if(lastRows>=n) lastRows=n-1; if(lastRows<0) lastRows=0;
          var frontEnd=n-lastRows, idx=0, pno=1;
          while(idx<frontEnd){ var isFirst=(pno===1); var start=idx; while(idx<frontEnd && pageUsed(start,idx+1,isFirst,false)<=contentHpx) idx++; if(idx===start) idx=start+1; pages.push({start:start,end:idx,isFirst:isFirst,isLast:false}); pno++; }
          pages.push({start:frontEnd,end:n,isFirst:false,isLast:true});
        }
      }
      var out='';
      for(var p2=0;p2<pages.length;p2++){ var pg=pages[p2]; var inner=headerHtml(p2+1,pages.length); if(pg.isFirst) inner+=isGuest?titleHtml():buyerHtml(); inner+=tableHtml(pg.start,pg.end); if(pg.isLast) inner+=sumHtml()+notesHtml()+footHtml(); out+='<div class="invoice-a5-page'+(pg.isLast?' last':'')+'" dir="rtl">'+inner+'</div>'; }
      document.getElementById('invRoot').innerHTML=out;
    })();
  </script>
    </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
