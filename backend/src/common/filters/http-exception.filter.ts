import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Flatten Nest's error payload into a single human-readable string so every
    // client (admin + mobile) can show the real reason instead of "[object Object]".
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const m = (res as { message?: unknown }).message;
        if (Array.isArray(m)) message = m.join(', ');
        else if (typeof m === 'string') message = m;
        else message = (res as { error?: string }).error ?? message;
      }
    }

    if (status >= 500) {
      // Database errors can include personal data and binary upload parameters.
      const error = exception as { name?: string; code?: string; driverError?: {code?: string} };
      this.logger.error({ name: error?.name ?? 'Error', code: error?.driverError?.code ?? error?.code ?? 'UNKNOWN' });
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
