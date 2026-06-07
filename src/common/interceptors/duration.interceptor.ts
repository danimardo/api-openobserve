import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';

@Injectable()
export class DurationInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = process.hrtime.bigint();
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const durationNs = process.hrtime.bigint() - start;
        const durationSec = Number(durationNs) / 1e9;
        this.metrics.requestDurationSeconds.observe(
          {
            method: req.method,
            route: req.route?.path ?? req.path ?? 'unknown',
            status_code: String(res.statusCode),
          },
          durationSec,
        );
      }),
    );
  }
}
