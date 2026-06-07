import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { Observable } from 'rxjs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const incoming = req.headers['x-request-id'];
    const raw = Array.isArray(incoming) ? incoming[0] : incoming;
    req.requestId = raw && UUID_REGEX.test(raw) ? raw : randomUUID();
    return next.handle();
  }
}
