import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NormalizedLogEvent } from '../../domain/schemas/log-event.schema';
import type { IAppLogger } from '../logging/app-logger.interface';
import { APP_LOGGER } from '../logging/app-logger.interface';
import { AppConfigService } from '../config/app-config.service';
import { MetricsService } from '../metrics/metrics.service';
import { O2IngestClient } from '../openobserve/ingest';
import { InMemoryQueue } from './queue';

@Injectable()
export class DeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    private readonly queue: InMemoryQueue,
    private readonly o2: O2IngestClient,
    private readonly config: AppConfigService,
    private readonly metrics: MetricsService,
    @Inject(APP_LOGGER) private readonly logger: IAppLogger,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.flushOnce();
    }, this.config.env.DELIVERY_FLUSH_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flushAll();
  }

  private async flushOnce(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const batch = this.queue.dequeue(this.config.env.DELIVERY_BATCH_MAX);
      if (batch.length > 0) {
        await this.deliverBatch(batch);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async flushAll(): Promise<void> {
    let batch: NormalizedLogEvent[];
    while ((batch = this.queue.dequeue(this.config.env.DELIVERY_BATCH_MAX)).length > 0) {
      await this.deliverBatch(batch);
    }
  }

  private async deliverBatch(batch: NormalizedLogEvent[]): Promise<void> {
    const byStream = new Map<string, NormalizedLogEvent[]>();
    for (const event of batch) {
      const existing = byStream.get(event.service);
      if (existing) {
        existing.push(event);
      } else {
        byStream.set(event.service, [event]);
      }
    }

    for (const [stream, events] of byStream) {
      await this.deliverWithRetry(stream, events);
    }
  }

  private async deliverWithRetry(stream: string, events: NormalizedLogEvent[]): Promise<void> {
    const maxAttempts = this.config.env.RETRY_ATTEMPTS;
    const backoffMs = this.config.env.RETRY_BACKOFF_MS;

    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
      try {
        await this.o2.ingestStream(stream, events);
        return;
      } catch (err) {
        if (attempt < maxAttempts) {
          this.metrics.o2RetriesTotal.inc({ stream });
          this.logger.warn(
            `O2 delivery retry ${attempt + 1}/${maxAttempts} for stream "${stream}"`,
            {
              module: 'DeliveryWorker',
              operation: 'deliverWithRetry',
              stream,
              attempt: attempt + 1,
            },
          );
          await new Promise<void>((resolve) =>
            setTimeout(resolve, backoffMs * Math.pow(2, attempt)),
          );
        } else {
          this.metrics.o2DeliveryFailedTotal.inc({ stream });
          this.logger.error(
            `O2 delivery permanently failed for stream "${stream}" after ${maxAttempts} retries`,
            err instanceof Error ? err : new Error(String(err)),
            { module: 'DeliveryWorker', operation: 'deliverWithRetry', stream },
          );
        }
      }
    }
  }
}
