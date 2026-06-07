import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ThrottleByKeyGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    return Promise.resolve(request.apiKey?.id ?? request.ip ?? 'unknown');
  }
}
