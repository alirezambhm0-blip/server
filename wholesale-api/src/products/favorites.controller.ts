import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { ProductsService } from '../products/products.service';

@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('toggle')
  toggle(@GetUser() user: RequestUser, @Body('product_id') productId: string) {
    return this.productsService.toggleFavorite(user.userId, productId);
  }
}
