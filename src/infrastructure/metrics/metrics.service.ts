import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  readonly eventsAcceptedTotal: Counter;
  readonly eventsRejectedTotal: Counter;
  readonly o2DeliveryFailedTotal: Counter;
  readonly o2RetriesTotal: Counter;
  readonly rateLimitedTotal: Counter;
  readonly redactedFieldsTotal: Counter;
  readonly contextTruncatedTotal: Counter;
  readonly queueDepth: Gauge;
  readonly requestDurationSeconds: Histogram;

  constructor() {
    this.registry = new Registry();

    this.eventsAcceptedTotal = new Counter({
      name: 'log_gateway_events_accepted_total',
      help: 'Total log events accepted and enqueued',
      labelNames: ['service'],
      registers: [this.registry],
    });

    this.eventsRejectedTotal = new Counter({
      name: 'log_gateway_events_rejected_total',
      help: 'Total log events rejected during ingestion',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.o2DeliveryFailedTotal = new Counter({
      name: 'log_gateway_o2_delivery_failed_total',
      help: 'Total batches that failed delivery to OpenObserve after all retries',
      labelNames: ['stream'],
      registers: [this.registry],
    });

    this.o2RetriesTotal = new Counter({
      name: 'log_gateway_o2_retries_total',
      help: 'Total delivery retry attempts to OpenObserve',
      labelNames: ['stream'],
      registers: [this.registry],
    });

    this.rateLimitedTotal = new Counter({
      name: 'log_gateway_rate_limited_total',
      help: 'Total requests rejected due to rate limiting or full queue',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.redactedFieldsTotal = new Counter({
      name: 'log_gateway_redacted_fields_total',
      help: 'Total fields redacted from log events',
      registers: [this.registry],
    });

    this.contextTruncatedTotal = new Counter({
      name: 'log_gateway_context_truncated_total',
      help: 'Total log events whose context was truncated',
      registers: [this.registry],
    });

    this.queueDepth = new Gauge({
      name: 'log_gateway_queue_depth',
      help: 'Current number of events in the delivery queue',
      registers: [this.registry],
    });

    this.requestDurationSeconds = new Histogram({
      name: 'log_gateway_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
