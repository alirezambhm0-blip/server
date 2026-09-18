import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestUser } from './get-user.decorator';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = RequestUser>(err: unknown, user: unknown): TUser {
    // اگر توکن معتبر بود، یوزر را برمی‌گرداند،
    // در غیر این صورت null (بدون throw کردن خطا)
    return (user || null) as unknown as TUser;
  }
}
