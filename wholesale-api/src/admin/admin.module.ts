import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';
import { BannersModule } from '../banners/banners.module';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [ProductsModule, CategoriesModule, OrdersModule, FilesModule, BannersModule, forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
