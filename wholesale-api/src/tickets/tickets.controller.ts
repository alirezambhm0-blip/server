import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards, Request } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { CreateTicketDto, ReplyTicketDto } from './dto/ticket.dto';

@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  async getMyTickets(@GetUser() user: RequestUser, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    if (!user.customer) return { items: [], total: 0, page: 1, pageSize: 20 };
    return this.ticketsService.getMyTickets(
      user.customer.id,
      page ? Number(page) : 1,
      pageSize ? Math.min(Number(pageSize), 100) : 20
    );
  }

  @Get(':id')
  async getTicketDetails(@Param('id') id: string, @GetUser() user: RequestUser) {
    if (!user.customer) return null;
    return this.ticketsService.getTicketDetails(user.customer.id, id);
  }

  @Post()
  async createTicket(@Body() body: CreateTicketDto, @GetUser() user: RequestUser) {
    // B11 — قبلاً Error خام → HTTP 500. عمداً 403 است نه 401،
    // چون موبایل روی 401 کاربر را logout می‌کند (httpClient.ts:272).
    if (!user.customer) throw new ForbiddenException('فقط مشتریان می‌توانند تیکت ثبت کنند');
    return this.ticketsService.createTicket(user.customer.id, body.subject, body.message);
  }

  @Post(':id/reply')
  async replyTicket(@Param('id') id: string, @Body() body: ReplyTicketDto, @GetUser() user: RequestUser) {
    if (!user.customer) throw new ForbiddenException('فقط مشتریان می‌توانند پاسخ دهند');
    return this.ticketsService.replyAsCustomer(user.customer.id, id, body.message);
  }
}
