import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger, PINO_INSTANCE } from './app-logger';
import { APP_LOGGER } from './app-logger.interface';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      // exactOptionalPropertyTypes conflicts with pino-http's own types at this boundary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: (cfg: AppConfigService): any => ({
        pinoHttp: {
          level: cfg.env.LOG_LEVEL,
          ...(cfg.env.NODE_ENV !== 'production'
            ? {
                transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
              }
            : {}),
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
            censor: '***redacted***',
          },
          autoLogging: { ignore: (req: { url?: string }) => req.url === '/api/v1/health' },
        },
      }),
    }),
  ],
  providers: [
    {
      provide: PINO_INSTANCE,
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) =>
        pino({
          level: cfg.env.LOG_LEVEL,
          ...(cfg.env.NODE_ENV !== 'production'
            ? {
                transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
              }
            : {}),
        }),
    },
    AppLogger,
    { provide: APP_LOGGER, useExisting: AppLogger },
  ],
  exports: [AppLogger, APP_LOGGER],
})
export class LoggingModule {}
