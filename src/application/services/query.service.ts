import { Inject, Injectable } from '@nestjs/common';
import type { ApiKey } from '../../domain/schemas/api-key.schema';
import { type QueryParams, type QueryResponse } from '../../domain/schemas/query.schema';
import { DomainError } from '../../domain/errors/domain-errors';
import { AuthorizationService } from '../../domain/authorization/authorization.service';
import { buildQuery } from '../../domain/query/sql-builder';
import { encodeCursor, decodeCursor } from '../../domain/query/cursor';
import { applyFrontendReducedProfile } from '../../domain/query/response-profile';
import { O2SearchClient } from '../../infrastructure/openobserve/search';
import { APP_LOGGER, type IAppLogger } from '../../infrastructure/logging/app-logger.interface';

const MAX_WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
const FRONTEND_MAX_LIMIT = 500;

@Injectable()
export class QueryService {
  constructor(
    private readonly auth: AuthorizationService,
    private readonly o2: O2SearchClient,
    @Inject(APP_LOGGER) private readonly logger: IAppLogger,
  ) {}

  async query(params: QueryParams, apiKey: ApiKey, requestId: string): Promise<QueryResponse> {
    if (!this.auth.canRead(apiKey, params.service)) {
      throw new DomainError(
        'forbidden',
        `Key "${apiKey.id}" is not authorized to read from service "${params.service}"`,
      );
    }

    const isFrontend = this.auth.isFrontend(apiKey);
    const readPolicy = apiKey.read_policy;

    // FR-018: frontend no puede usar q
    if (isFrontend && params.q !== undefined) {
      throw new DomainError('forbidden', 'Frontend keys cannot use the q parameter');
    }

    let effectiveLimit = params.limit;
    let limitTruncated = false;

    // FR-018: recortar limit para frontend
    if (isFrontend) {
      const maxLimit = readPolicy?.max_limit ?? FRONTEND_MAX_LIMIT;
      if (params.limit > maxLimit) {
        effectiveLimit = maxLimit;
        limitTruncated = true;
      }
    }

    // FR-018: recortar ventana temporal para frontend (> 7 días)
    let rangeTruncated = false;
    let effectiveFrom = params.from;
    if (isFrontend && params.from !== undefined) {
      const fromMs = Date.parse(params.from);
      if (!Number.isNaN(fromMs) && Date.now() - fromMs > MAX_WINDOW_7D_MS) {
        const sevenDaysAgo = new Date(Date.now() - MAX_WINDOW_7D_MS).toISOString();
        effectiveFrom = sevenDaysAgo;
        rangeTruncated = true;
      }
    } else if (isFrontend && params.from === undefined) {
      // default from=now-1h está dentro de 7d, no truncar
    }

    let cursorTs: number | undefined;
    if (params.cursor) {
      const decoded = decodeCursor(params.cursor);
      if (decoded) {
        cursorTs = decoded.ts;
      }
    }

    const built = buildQuery({
      stream: params.service,
      limit: effectiveLimit,
      sort: params.sort,
      ...(effectiveFrom !== undefined ? { from: effectiveFrom } : {}),
      ...(params.to !== undefined ? { to: params.to } : {}),
      ...(params.level !== undefined ? { level: params.level } : {}),
      ...(params.env !== undefined ? { env: params.env } : {}),
      ...(params.q !== undefined ? { q: params.q } : {}),
      ...(params.trace_id !== undefined ? { trace_id: params.trace_id } : {}),
      ...(params.request_id !== undefined ? { request_id: params.request_id } : {}),
      ...(cursorTs !== undefined ? { cursor_ts: cursorTs } : {}),
    });

    const result = await this.o2.searchStream(params.service, built);

    let items: Record<string, unknown>[] = result.hits;

    // FR-018: aplicar perfil de respuesta reducida para frontend
    if (isFrontend && readPolicy?.response_profile === 'frontend_reduced') {
      items = items.map(applyFrontendReducedProfile);
    }

    const lastItem = items[items.length - 1];
    const lastTs =
      lastItem && typeof lastItem['_timestamp'] === 'number' ? lastItem['_timestamp'] : undefined;

    const nextCursor =
      items.length === effectiveLimit && lastTs !== undefined
        ? encodeCursor({ ts: lastTs, sort: params.sort })
        : null;

    this.logger.debug('Query executed', {
      module: 'QueryService',
      operation: 'query',
      service: params.service,
      items: items.length,
      request_id: requestId,
    });

    return {
      items,
      next_cursor: nextCursor,
      request_id: requestId,
      ...(rangeTruncated ? { range_truncated: true } : {}),
      ...(limitTruncated ? { limit_truncated: true } : {}),
    };
  }
}
