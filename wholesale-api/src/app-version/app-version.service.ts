import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppVersionService {
  constructor(private configService: ConfigService) {}

  getAppVersion() {
    return {
      minVersion: this.configService.get<string>('MIN_APP_VERSION', '1.0.0'),
      latestVersion: this.configService.get<string>('LATEST_APP_VERSION', '1.0.0'),
      forceUpdate: true,
      message: 'لطفاً برای ادامه استفاده از اپلیکیشن، آن را به آخرین نسخه به‌روزرسانی کنید.',
      updateUrl: 'https://cafebazaar.ir/app/com.testcompany.wholesaleapp', // Example store link
    };
  }
}
