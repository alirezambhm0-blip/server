// src/sms/sms.service.ts
import { Injectable, Logger, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as soap from 'soap';

type MeliPayamakSendByBaseNumberResponse = {
  SendByBaseNumberResult?: string | number;
};

type MeliPayamakSoapClient = {
  SendByBaseNumberAsync(args: {
    username: string;
    password: string;
    text: string[];
    to: string;
    bodyId: number;
  }): Promise<[MeliPayamakSendByBaseNumberResponse]>;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private soapClient: MeliPayamakSoapClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async getClient(): Promise<MeliPayamakSoapClient> {
    if (!this.soapClient) {
      const wsdlUrl = 'http://api.payamak-panel.com/post/send.asmx?wsdl';
      try {
        this.soapClient = (await soap.createClientAsync(wsdlUrl)) as unknown as MeliPayamakSoapClient;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to create SOAP client: ${message}`);
        throw new ServiceUnavailableException('سرویس پیامک در دسترس نیست.');
      }
    }
    return this.soapClient;
  }

  async sendOtp(to: string, otpCode: string): Promise<boolean> {
    // گرفتن مقادیر و حذف کوتیشن یا فاصله‌های اضافی احتمالی
    const username = this.configService.get<string>('MELIPAYAMAK_USERNAME')?.replace(/['"]+/g, '').trim();
    const password = this.configService.get<string>('MELIPAYAMAK_PASSWORD')?.replace(/['"]+/g, '').trim();
    const bodyIdRaw = this.configService.get<string>('MELIPAYAMAK_BODY_ID')?.replace(/['"]+/g, '').trim();

    const bodyId = Number.parseInt(bodyIdRaw || '', 10);

    // دیباگ لاگ برای اطمینان از صحت لود شدن کانفیگ (در محیط dev)
    // P5 — شماره با همان maskPhoneNumber موجود mask می‌شود. پیش از این شمارهٔ کامل
    // لاگ می‌شد و چون در main.ts هیچ logger option تنظیم نشده، سطح debug در
    // production هم فعال است. هیچ پیاده‌سازی mask جدیدی ساخته نشد.
    this.logger.debug(
      `Attempting SMS: to=${this.maskPhoneNumber(to)}, bodyId=${bodyId}, username=${username ? 'LOADED' : 'MISSING'}`
    );

    if (!username || !password || !Number.isInteger(bodyId) || bodyId <= 0) {
      this.logger.error(`Invalid SMS Config: username=${!!username}, password=${!!password}, bodyId=${bodyIdRaw}`);
      throw new InternalServerErrorException('تنظیمات سرویس پیامک در بک‌اَند ناقص یا اشتباه است.');
    }

    try {
      const client = await this.getClient();

      // متد ملی پیامک برای ارسال بر اساس پترن (Base Number)
      const [result] = await client.SendByBaseNumberAsync({
        username,
        password,
        text: [otpCode], // کد OTP را به عنوان آرایه متن می‌فرستیم
        to,
        bodyId,
      });

      const responseCode = this.parseResponseCode(result);

      // کدهای بالای ۲۰۰۰ یا ۱۰۰ در ملی‌پیامک یعنی شناسه تراکنش (موفقیت)
      // کدهای کوچک‌تر از ۱۰۰ معمولاً خطا هستند
      if (responseCode > 100) {
        this.logger.log(`SMS OTP sent successfully to ${this.maskPhoneNumber(to)}. ResponseCode: ${responseCode}`);
        return true;
      }

      this.logger.error(
        `MeliPayamak rejected request. Error Code: ${responseCode} for number: ${this.maskPhoneNumber(to)}`
      );
      throw new InternalServerErrorException(`سرویس پیامک خطا داد (کد: ${responseCode})`);
    } catch (error) {
      // اگر خطا قبلاً handle شده بود، همان را پرتاب کن
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      // P5 — پیش از این message/stack/response.data به‌صورت خام لاگ می‌شد. بدنهٔ
      // درخواست SOAP شامل username، password و otpCode است (text: [otpCode] در بالا)
      // و کتابخانهٔ soap در خطاهای transport ممکن است آن را echo کند. پس هیچ‌کدام
      // لاگ نمی‌شوند؛ فقط نام کلاس خطا به‌عنوان دسته‌بندی کلی باقی می‌ماند.
      // هیچ request identifier موجودی در این سرویس وجود ندارد که اضافه شود.
      const err = error as { constructor?: { name?: string } };
      this.logger.error(
        `CRITICAL: SMS Service Exception (provider=Melipayamak, operation=SendByBaseNumber, category=${
          err?.constructor?.name ?? 'UnknownError'
        })`
      );

      throw new ServiceUnavailableException('خطای غیرمنتظره در ارتباط با اپراتور پیامک.');
    }
  }

  private parseResponseCode(result: MeliPayamakSendByBaseNumberResponse): number {
    const rawResponse = result?.SendByBaseNumberResult;
    const responseCode = Number.parseInt(String(rawResponse), 10);

    if (Number.isNaN(responseCode)) {
      // P5 — پاسخ خام provider دیگر JSON.stringify و لاگ نمی‌شود؛ ممکن است بخشی از
      // ورودی (شامل کد OTP) را echo کند. فقط این واقعیت که کد پاسخ قابل تحلیل نبود.
      this.logger.error('Invalid Provider Response Object: unparseable response code (raw response not logged)');
      throw new InternalServerErrorException('پاسخ دریافتی از سرور پیامک قابل تحلیل نیست.');
    }

    return responseCode;
  }

  private maskPhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/(\d{4})\d{3}(\d{4})/, '$1***$2');
  }
}
