import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { RequestUser } from '../auth/get-user.decorator';
import { PushTokenDto } from './dto/push-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(
    @GetUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!user.customer) return { items: [], total: 0, page: 1, pageSize: 20 };
    return this.notificationsService.getMyNotifications(
      user.userId,
      user.customer.id,
      page ? Number(page) : 1,
      pageSize ? Math.min(Number(pageSize), 100) : 20,
      user.customer.status
    );
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @GetUser() user: RequestUser) {
    return this.notificationsService.markAsRead(user.userId, id);
  }

  @Post('read-all')
  async readAll(@GetUser() user: RequestUser, @Body('category') category?: string) {
    return this.notificationsService.markAllAsRead(user.userId, category);
  }

  @Post('push-token')
  async registerToken(@Body() body: PushTokenDto, @GetUser() user: RequestUser) {
    if (!user.customer) return { ok: false };
    await this.notificationsService.registerToken(user.customer.id, body.token, body.platform);
    return { ok: true };
  }

  @Delete('push-token')
  async removeToken(@GetUser() user: RequestUser) {
    if (!user.customer) return { ok: false };
    await this.notificationsService.removeToken(user.customer.id);
    return { ok: true };
  }
}
