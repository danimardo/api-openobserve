import path from 'path';
import { Module } from '@nestjs/common';
import { LoggerModule, Logger as PinoLogger } from 'nestjs-pino';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { AppLogger, PINO_INSTANCE } from './app-logger';
import { APP_LOGGER } from './app-logger.interface';

type TransportTarget = { target: string; options?: Record<string, unknown>; level: string };

function buildForwarderTarget(cfg: AppConfigService, level: string): TransportTarget | null {
  const { OO_FORWARDER_URL, OO_FORWARDER_KEY, OO_FORWARDER_SERVICE, NODE_ENV } = cfg.env;
  if (!OO_FORWARDER_URL || !OO_FORWARDER_KEY || !OO_FORWARDER_SERVICE) return null;
  return {
    target: path.join(__dirname, 'openobserve.transport'),
    options: {
      url: OO_FORWARDER_URL,
      apiKey: OO_FORWARDER_KEY,
      service: OO_FORWARDER_SERVICE,
      env: NODE_ENV,
    },
    level,
  };
}

function buildTransport(cfg: AppConfigService, level: string): { targets: TransportTarget[] } | undefined {
  const isProd = cfg.env.NODE_ENV === 'production';
  const forwarder = buildForwarderTarget(cfg, level);

  if (isProd) {
    if (!forwarder) return undefined;
    return {
      targets: [
        { target: 'pino/file', options: { destination: 1 }, level },
        forwarder,
      ],
    };
  }

  const targets: TransportTarget[] = [
    { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level },
    { target: 'pino/file', options: { destination: '.logs/app.jsonl' }, level },
    { target: 'pino-pretty', options: { colorize: false, singleLine: false, destination: '.logs/app.log' }, level },
  ];
  if (forwarder) targets.push(forwarder);
  return { targets };
}

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
          ...(() => { const t = buildTransport(cfg, cfg.env.LOG_LEVEL); return t ? { transport: t } : {}; })(),
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
      inject: [PinoLogger],
      // Reutiliza la instancia pino que ya gestiona LoggerModule para evitar
      // tener dos transportes de fichero abiertos sobre los mismos ficheros.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useFactory: (pinoLogger: PinoLogger) => (pinoLogger as any).logger,
    },
    AppLogger,
    { provide: APP_LOGGER, useExisting: AppLogger },
  ],
  exports: [AppLogger, APP_LOGGER],
})
export class LoggingModule {}
