import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { LoggingModule } from '../logging/logging.module';
import { MetricsModule } from '../metrics/metrics.module';
import { MetricsService } from '../metrics/metrics.service';
import { OpenObserveModule } from '../openobserve/openobserve.module';
import { InMemoryQueue } from './queue';
import { DeliveryWorker } from './delivery.worker';

export const QUEUE_TOKEN = Symbol('QUEUE_TOKEN');

@Module({
  imports: [AppConfigModule, LoggingModule, MetricsModule, OpenObserveModule],
  providers: [
    {
      provide: QUEUE_TOKEN,
      inject: [AppConfigService, MetricsService],
      useFactory: (cfg: AppConfigService, metrics: MetricsService): InMemoryQueue =>
        new InMemoryQueue(cfg.env.QUEUE_MAX_ITEMS, metrics.queueDepth),
    },
    {
      provide: InMemoryQueue,
      inject: [QUEUE_TOKEN],
      useFactory: (q: InMemoryQueue): InMemoryQueue => q,
    },
    DeliveryWorker,
  ],
  exports: [InMemoryQueue, DeliveryWorker],
})
export class QueueModule {}
