import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, ERROR_HTTP_STATUS } from '../../domain/errors/domain-errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = req.requestId ?? 'unknown';

    if (exception instanceof DomainError) {
      res.status(ERROR_HTTP_STATUS[exception.code]).json({
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined ? { details: exception.details } : {}),
        },
        request_id: requestId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json({
        error: {
          code: 'http_error',
          message: exception.message,
        },
        request_id: requestId,
      });
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
      request_id: requestId,
    });
  }
}
