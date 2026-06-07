import './common/types/request.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfigService } from './infrastructure/config/app-config.service';

function initLogFiles(): void {
  if (process.env.NODE_ENV === 'production') return;
  const logsDir = join(process.cwd(), '.logs');
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(logsDir, 'app.jsonl'), '');
  writeFileSync(join(logsDir, 'app.log'), '');
}

async function bootstrap(): Promise<void> {
  initLogFiles();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Log Gateway API')
    .setDescription(
      'API intermedia sobre OpenObserve. Recibe logs de aplicaciones propias ' +
        '(backend/frontend) mediante API keys y los reenvía a OpenObserve sin exponer ' +
        'credenciales internas. Documentación completa en docs/manual-de-integracion.md.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'key_id.secret',
        description: 'Bearer <key_id>.<secret> — generado con npm run keygen',
      },
      'apiKey',
    )
    .addServer('/api/v1', 'Base de la API')
    .addTag('Ingesta', 'Envío de eventos de log')
    .addTag('Consulta', 'Lectura y filtrado de logs')
    .addTag('Descubrimiento', 'Capacidades de la API key')
    .addTag('Operación', 'Salud, readiness y métricas')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: { persistAuthorization: true },
  });

  // Helmet con CSP permisivo en scripts/estilos para que funcione Swagger UI
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:'],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
        },
      },
    }),
  );

  const config = app.get(AppConfigService);

  // En Windows, el hot reload de nest start --watch puede dejar el puerto en
  // TIME_WAIT brevemente. Reintentamos hasta 5 veces con 500 ms de espera.
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 500;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await app.listen(config.env.PORT);
      break;
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EADDRINUSE' && attempt < MAX_RETRIES) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        throw err;
      }
    }
  }
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[FATAL] Bootstrap failed:', err);
  process.exit(1);
});
