// src/visitor-sales/visitor-sales.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { VisitorSalesService } from './visitor-sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import type { RequestWithUser } from '../auth/get-user.decorator';

@Controller('admin/visitor-sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.VISITOR)
export class VisitorSalesController {
  constructor(private svc: VisitorSalesService) {}

  @Get('dashboard')
  async dashboard(@Req() req: RequestWithUser, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const isAdmin = req.user.role === 'ADMIN';
    return this.svc.getDashboard(req.user.userId, isAdmin, dateFrom, dateTo);
  }

  @Get('orders')
  async orders(
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string
  ) {
    const isAdmin = req.user.role === 'ADMIN';
    return this.svc.getVisitorOrders(req.user.userId, isAdmin, Number(page) || 1, Number(pageSize) || 20, status);
  }
}

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.VISITOR)
export class CustomerSearchController {
  constructor(private svc: VisitorSalesService) {}

  @Get('search')
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.svc.searchCustomers(q, Number(limit) || 10);
  }
}

@Controller('visitor/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.VISITOR)
export class VisitorOrderController {
  constructor(private svc: VisitorSalesService) {}

  @Post()
  async create(@Req() req: RequestWithUser, @Body() body: Parameters<VisitorSalesService['createVisitorOrder']>[2]) {
    const userName =
      [req.user.customer?.firstName, req.user.customer?.lastName].filter(Boolean).join(' ') || req.user.phone;
    return this.svc.createVisitorOrder(req.user.userId, userName, body);
  }
}
