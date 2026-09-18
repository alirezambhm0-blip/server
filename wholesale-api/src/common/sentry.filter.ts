import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';

@Catch()
export class SentryFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] || Math.random().toString(36).substring(7)) as string;

    // Default to Internal Server Error
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    const message = 'خطای سرور. لطفاً با پشتیبانی تماس بگیرید.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      // We safely pass through known messages like Validation, Rate limit, etc.
      if (status < 500) {
        response.status(status).json(res);
        return;
      }
    }

    // Only capture 5xx errors (Internal Server Errors) to Sentry
    Sentry.captureException(exception, {
      tags: { requestId },
      extra: {
        url: request.url,
        method: request.method,
        body: request.body,
      },
    });

    console.error(`[RequestId: ${requestId}]`, exception);

    // Never leak stack traces to client!
    response.status(status).json({
      statusCode: status,
      message,
      requestId,
    });
  }
}
