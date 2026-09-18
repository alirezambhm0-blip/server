import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Customer, UserRole } from '@prisma/client';
import type { Request } from 'express';

/**
 * احراز هویت‌شده: خروجی متد validate() در JwtStrategy
 * که توسط Passport درون request.user قرار می‌گیرد.
 */
export interface RequestUser {
  userId: string;
  phone: string;
  role: UserRole;
  customer: Customer | null;
}

export interface RequestWithUser extends Request {
  user: RequestUser;
}

export const GetUser = createParamDecorator((data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
