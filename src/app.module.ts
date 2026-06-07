import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './infrastructure/config/config.module';
import { AppConfigService } from './infrastructure/config/app-config.service';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { OpenObserveModule } from './infrastructure/openobserve/openobserve.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { DurationInterceptor } from './common/interceptors/duration.interceptor';
import { ApiKeyAuthGuard, API_KEYS_MAP_TOKEN } from './common/guards/api-key-auth.guard';
import { ThrottleByKeyGuard } from './common/guards/throttle-by-key.guard';
import { loadApiKeys } from './infrastructure/config/api-keys';
import { AuthorizationService } from './domain/authorization/authorization.service';
import { IngestService } from './application/services/ingest.service';
import { QueryService } from './application/services/query.service';
import { HealthService } from './application/services/health.service';
import { ListServicesService } from './application/services/list-services.service';
import { IngestController } from './controllers/ingest.controller';
import { QueryController } from './controllers/query.controller';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { ServicesController } from './controllers/services.controller';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    MetricsModule,
    OpenObserveModule,
    QueueModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        throttlers: [{ ttl: 1000, limit: cfg.env.RATE_LIMIT_RPS }],
      }),
    }),
  ],
  controllers: [
    IngestController,
    QueryController,
    HealthController,
    MetricsController,
    ServicesController,
  ],
  providers: [
    {
      provide: API_KEYS_MAP_TOKEN,
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => loadApiKeys(cfg.env),
    },
    Reflector,
    AuthorizationService,
    IngestService,
    QueryService,
    HealthService,
    ListServicesService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DurationInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottleByKeyGuard,
    },
  ],
  exports: [API_KEYS_MAP_TOKEN],
})
export class AppModule {}
