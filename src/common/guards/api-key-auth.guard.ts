import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import type { ApiKey } from '../../domain/schemas/api-key.schema';
import { DomainError } from '../../domain/errors/domain-errors';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const API_KEYS_MAP_TOKEN = 'API_KEYS_MAP';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @Inject(API_KEYS_MAP_TOKEN) private readonly apiKeys: Map<string, ApiKey>,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new DomainError('unauthorized', 'Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) {
      throw new DomainError('unauthorized', 'Invalid token format: missing separator');
    }

    const keyId = token.slice(0, dotIndex);
    const secret = token.slice(dotIndex + 1);

    const apiKey = this.apiKeys.get(keyId);
    if (!apiKey) {
      throw new DomainError('unauthorized', 'Invalid credentials');
    }

    const secretHash = createHash('sha256').update(secret).digest('hex');
    const expectedBuf = Buffer.from(apiKey.secret_hash, 'hex');
    const actualBuf = Buffer.from(secretHash, 'hex');

    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      throw new DomainError('unauthorized', 'Invalid credentials');
    }

    req.apiKey = apiKey;
    return true;
  }
}
