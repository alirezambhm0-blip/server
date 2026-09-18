import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SenderType, TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  // دریافت لیست تیکت‌های یک مشتری خاص (موبایل)
  async getMyTickets(customerId: string, page = 1, pageSize = 20) {
    const where = { customerId };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { messages: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize };
  }

  // دریافت جزئیات یک تیکت همراه با پیام‌هایش (موبایل)
  async getTicketDetails(customerId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, customerId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    return ticket;
  }

  // ایجاد تیکت جدید توسط مشتری (موبایل)
  async createTicket(customerId: string, subject: string, initialMessage: string) {
    return this.prisma.ticket.create({
      data: {
        customerId,
        subject,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            senderType: SenderType.CUSTOMER,
            senderId: customerId,
            body: initialMessage,
          },
        },
      },
    });
  }

  // ارسال پاسخ جدید توسط مشتری به تیکت خودش (موبایل)
  async replyAsCustomer(customerId: string, ticketId: string, message: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, customerId },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');

    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.OPEN, updatedAt: new Date() }, // وقتی کاربر جواب میده دوباره باز میشه
      });
      return tx.ticketMessage.create({
        data: {
          ticketId,
          senderType: SenderType.CUSTOMER,
          senderId: customerId,
          body: message,
        },
      });
    });
  }
}
