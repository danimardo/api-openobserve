import type { ApiKey } from '../../domain/schemas/api-key.schema';

declare module 'express' {
  interface Request {
    apiKey?: ApiKey;
    requestId?: string;
  }
}

export type { ApiKey };
