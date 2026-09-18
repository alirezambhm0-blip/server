import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * TooManyRequestsException (HTTP 429) — برای اعلام cooldown/rate-limit
 * (NestJS به‌صورت پیش‌فرض این استثنا را خارج از بسته‌ی @nestjs/throttler
 * ندارد، بنابراین خودمان پیاده‌سازی می‌کنیم.)
 */
export class TooManyRequestsException extends HttpException {
  constructor(message: string | object = 'Too many requests') {
    super(
      typeof message === 'string' ? { message, statusCode: HttpStatus.TOO_MANY_REQUESTS } : message,
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}
