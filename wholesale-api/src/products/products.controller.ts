import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  // عمومی برای مهمان (مرور کاتالوگ بدون قیمت در UI)؛ توکن معتبر هم پذیرفته می‌شود (برای isAdmin/isFavorite)
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @GetUser() user: RequestUser,
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('search') search?: string,
    @Query('isFeatured') isFeatured?: string,
    @Query('isNew') isNew?: string,
    @Query('isDiscounted') isDiscounted?: string,
    @Query('filter') filter?: string,
    @Query('sort') sort?: string,
    @Query('all') all?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('limit') limit?: string
  ) {
    // تنها ادمین‌ها می‌توانند محصولات غیرفعال را ببینند
    const isAdmin = user?.role === 'ADMIN';
    // S7 — قیمت فقط برای مشتری تاییدشده یا ادمین (همان قاعدهٔ PriceBox در موبایل)
    const canSeePrices = isAdmin || user?.customer?.status === 'APPROVED';
    return this.service.findAll({
      categoryId,
      categorySlug,
      search,
      isFeatured: isFeatured === 'true',
      isNew: isNew === 'true',
      isDiscounted: isDiscounted === 'true',
      filter,
      sort,
      onlyActive: isAdmin ? all !== '1' : true, // ادمین‌ها می‌توانند all=1 بگذارند
      page: page ? Number(page) : 1,
      pageSize: pageSize || limit ? Number(pageSize || limit) : 24,
      userId: user?.userId,
      canSeePrices,
    });
  }

  @Get('counts')
  getFeatureCounts() {
    return this.service.getFeatureCounts();
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  getMyFavorites(@GetUser() user: RequestUser) {
    return this.service.getMyFavorites(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  toggleFavorite(@GetUser() user: RequestUser, @Param('id') id: string) {
    return this.service.toggleFavorite(user.userId, id);
  }

  // عمومی برای مهمان (صفحه جزئیات بدون قیمت در UI)؛ محصول غیرفعال برای غیرادمین همچنان ۴۰۴ می‌شود
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async findOne(@GetUser() user: RequestUser, @Param('id') id: string) {
    const product = await this.service.findOne(
      id,
      user?.userId,
      user?.role === 'ADMIN' || user?.customer?.status === 'APPROVED'
    );
    // کاربران غیرادمین نمی‌توانند محصولات غیرفعال را ببینند
    if (!product.is_active && user?.role !== 'ADMIN') {
      throw new NotFoundException('محصول یافت نشد');
    }
    return product;
  }

  // S7 — این endpoint قبلاً **هیچ گاردی نداشت** و user همیشه undefined بود،
  // یعنی حتی مشتری تاییدشده هم در بخش «محصولات مشابه» قیمت نمی‌دید.
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/similar')
  getSimilar(@GetUser() user: RequestUser, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.getSimilar(
      id,
      user?.userId,
      limit ? Number(limit) : 10,
      user?.role === 'ADMIN' || user?.customer?.status === 'APPROVED'
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('toggle-favorite')
  toggleFavoriteAlt(@GetUser() user: RequestUser, @Body('product_id') productId: string) {
    return this.service.toggleFavorite(user.userId, productId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() body: CreateProductDto) {
    return this.service.create(body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.service.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
