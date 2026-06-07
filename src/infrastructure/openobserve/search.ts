import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from '../../domain/errors/domain-errors';
import type { BuiltQuery } from '../../domain/query/sql-builder';
import { OpenObserveClient } from './openobserve-client';

const O2SearchResponseSchema = z.object({
  hits: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  total: z.number().optional(),
});

export interface O2SearchResult {
  hits: Record<string, unknown>[];
  total: number | undefined;
}

@Injectable()
export class O2SearchClient {
  constructor(private readonly client: OpenObserveClient) {}

  async searchStream(stream: string, query: BuiltQuery): Promise<O2SearchResult> {
    try {
      const response = await this.client.http.post(`/${stream}/_search`, {
        query: {
          sql: query.sql,
          from: 0,
          size: query.size,
          start_time: query.start_time,
          end_time: query.end_time,
        },
      });
      const parsed = O2SearchResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        return { hits: [], total: 0 };
      }
      return { hits: parsed.data.hits, total: parsed.data.total };
    } catch {
      throw new DomainError('openobserve_error', 'OpenObserve query failed');
    }
  }
}
