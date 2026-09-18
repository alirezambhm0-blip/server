// src/visitor-sales/visitor-sales.module.ts
import { Module } from '@nestjs/common';
import { VisitorSalesService } from './visitor-sales.service';
import { VisitorSalesController, CustomerSearchController, VisitorOrderController } from './visitor-sales.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VisitorSalesController, CustomerSearchController, VisitorOrderController],
  providers: [VisitorSalesService],
  exports: [VisitorSalesService],
})
export class VisitorSalesModule {}
