import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { FavoritesController } from './favorites.controller';

@Module({
  controllers: [ProductsController, FavoritesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
