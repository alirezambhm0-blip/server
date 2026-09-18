// src/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';

@Module({
  imports: [ConfigModule], // برای دسترسی به متغیرهای .env
  providers: [SmsService],
  exports: [SmsService], // اینجا اکسپورتش می‌کنیم تا بقیه ماژول‌ها ببینند
})
export class SmsModule {}
