import { Inject, Injectable } from '@nestjs/common';
import type { ApiKey } from '../../domain/schemas/api-key.schema';
import {
  LogEventInputSchema,
  type NormalizedLogEvent,
} from '../../domain/schemas/log-event.schema';
import { DomainError } from '../../domain/errors/domain-errors';
import { AuthorizationService } from '../../domain/authorization/authorization.service';
import { normalizeTimestamp } from '../../domain/normalization/normalize-timestamp';
import { normalizeLevel } from '../../domain/normalization/normalize-level';
import { normalizeSource } from '../../domain/normalization/normalize-source';
import { normalizeContext } from '../../domain/normalization/normalize-context';
import { AppConfigService } from '../../infrastructure/config/app-config.service';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { InMemoryQueue } from '../../infrastructure/queue/queue';
import { APP_LOGGER } from '../../infrastructure/logging/app-logger.interface';
import type { IAppLogger } from '../../infrastructure/logging/app-logger.interface';

export interface IngestErrorItem {
  index: number;
  code: string;
  message: string;
}

export interface IngestResult {
  accepted: number;
  rejected: number;
  errors?: IngestErrorItem[];
}

// FR-012: campos raíz conocidos del LogEvent; el resto va a context.extra
const KNOWN_EVENT_FIELDS = new Set([
  '_timestamp',
  'service',
  'env',
  'level',
  'message',
  'version',
  'event_id',
  'trace_id',
  'span_id',
  'request_id',
  'hostname',
  'source',
  'context',
]);

@Injectable()
export class IngestService {
  constructor(
    private readonly config: AppConfigService,
    private readonly auth: AuthorizationService,
    private readonly queue: InMemoryQueue,
    private readonly metrics: MetricsService,
    @Inject(APP_LOGGER) private readonly logger: IAppLogger,
  ) {}

  async ingest(
    body: unknown,
    apiKey: ApiKey,
    requestId: string,
    requireArray = false,
  ): Promise<IngestResult> {
    if (!apiKey.scopes.includes('write')) {
      throw new DomainError('forbidden', 'Key does not have write scope');
    }

    if (requireArray && !Array.isArray(body)) {
      throw new DomainError('validation_error', 'Batch endpoint requires an array body');
    }

    const rawArray = Array.isArray(body) ? body : [body];

    if (rawArray.length === 0) {
      throw new DomainError('validation_error', 'Empty batch');
    }

    if (rawArray.length > this.config.env.INGEST_MAX_BATCH) {
      throw new DomainError(
        'payload_too_large',
        `Batch size ${rawArray.length} exceeds max ${this.config.env.INGEST_MAX_BATCH}`,
      );
    }

    const accepted: NormalizedLogEvent[] = [];
    const errors: IngestErrorItem[] = [];

    for (let i = 0; i < rawArray.length; i++) {
      const raw = rawArray[i];
      const parsed = LogEventInputSchema.safeParse(raw);

      if (!parsed.success) {
        errors.push({ index: i, code: 'validation_error', message: 'Invalid event structure' });
        this.metrics.eventsRejectedTotal.inc({ reason: 'validation_error' });
        continue;
      }

      const event = parsed.data;

      if (!this.config.env.ALLOWED_ENVS.includes(event.env)) {
        errors.push({
          index: i,
          code: 'validation_error',
          message: `Env "${event.env}" is not allowed`,
        });
        this.metrics.eventsRejectedTotal.inc({ reason: 'validation_error' });
        continue;
      }

      if (event.message.length > this.config.env.LOG_MESSAGE_MAX_CHARS) {
        errors.push({ index: i, code: 'validation_error', message: 'Message exceeds max length' });
        this.metrics.eventsRejectedTotal.inc({ reason: 'validation_error' });
        continue;
      }

      if (!this.auth.canWrite(apiKey, event.service)) {
        errors.push({
          index: i,
          code: 'forbidden',
          message: `Not authorized to write to service "${event.service}"`,
        });
        this.metrics.eventsRejectedTotal.inc({ reason: 'forbidden' });
        continue;
      }

      const level = normalizeLevel(event.level);
      if (level === 'invalid_level') {
        errors.push({
          index: i,
          code: 'validation_error',
          message: `Invalid log level "${event.level}"`,
        });
        this.metrics.eventsRejectedTotal.inc({ reason: 'validation_error' });
        continue;
      }

      const _timestamp = normalizeTimestamp(event._timestamp);
      const source = normalizeSource(event.source);

      // FR-012: recoger campos raíz no reconocidos → context.extra
      const rawRecord = event as Record<string, unknown>;
      const extraFields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rawRecord)) {
        if (!KNOWN_EVENT_FIELDS.has(k)) extraFields[k] = v;
      }

      const baseCtx: Record<string, unknown> = event.context ?? {};
      const ctxWithExtra =
        Object.keys(extraFields).length > 0
          ? {
              ...baseCtx,
              extra: { ...((baseCtx['extra'] as Record<string, unknown>) ?? {}), ...extraFields },
            }
          : baseCtx;

      let normalized: NormalizedLogEvent = {
        _timestamp,
        service: event.service,
        env: event.env,
        level,
        message: event.message,
        source,
        ...(event.version !== undefined ? { version: event.version } : {}),
        ...(event.event_id !== undefined ? { event_id: event.event_id } : {}),
        ...(event.trace_id !== undefined ? { trace_id: event.trace_id } : {}),
        ...(event.span_id !== undefined ? { span_id: event.span_id } : {}),
        ...(event.request_id !== undefined ? { request_id: event.request_id } : {}),
        ...(event.hostname !== undefined ? { hostname: event.hostname } : {}),
      };

      if (Object.keys(ctxWithExtra).length > 0) {
        const { context, truncated, redactedCount } = normalizeContext(
          ctxWithExtra,
          this.config.env.CONTEXT_MAX_DEPTH,
          this.config.env.CONTEXT_VALUE_MAX_CHARS,
          this.config.env.MAX_FIELDS_PER_RECORD,
        );
        normalized = { ...normalized, context };
        if (truncated) {
          normalized = { ...normalized, context_truncated: true };
          this.metrics.contextTruncatedTotal.inc();
        }
        if (redactedCount > 0) {
          this.metrics.redactedFieldsTotal.inc(redactedCount);
        }
      }

      accepted.push(normalized);
    }

    if (accepted.length === 0) {
      throw new DomainError('validation_error', 'No valid events in batch', errors);
    }

    if (this.queue.remaining < accepted.length) {
      this.metrics.rateLimitedTotal.inc({ reason: 'queue_full' });
      throw new DomainError('rate_limited', 'Queue is full — try again later');
    }

    const enqueued = this.queue.enqueue(accepted);

    for (const event of accepted.slice(0, enqueued)) {
      this.metrics.eventsAcceptedTotal.inc({ service: event.service });
    }

    this.logger.debug('Batch ingested', {
      module: 'IngestService',
      operation: 'ingest',
      accepted: enqueued,
      rejected: errors.length,
      request_id: requestId,
    });

    return {
      accepted: enqueued,
      rejected: errors.length,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }
}
