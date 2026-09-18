import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppVersionService } from './app-version.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogErrorDto } from './dto/log-error.dto';

@Controller('app')
export class AppVersionController {
  constructor(
    private readonly appVersionService: AppVersionService,
    private readonly prisma: PrismaService // اتصال به دیتابیس
  ) {}

  @Get('version')
  getVersion() {
    return this.appVersionService.getAppVersion();
  }

  // اندپوینت جدید برای دریافت خطاهای اپلیکیشن
  @Post('log-error')
  async logError(@Body() body: LogErrorDto) {
    try {
      // ثبت در جدول خطاهای دیتابیس
      return await this.prisma.errorLog.create({
        data: {
          message: body.message || 'Unknown Error',
          stack: body.stack,
          deviceInfo: body.deviceInfo,
          userId: body.userId,
        },
      });
    } catch {
      return { ok: false };
    }
  }
}
