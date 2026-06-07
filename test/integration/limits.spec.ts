/**
 * Integration test: límites de payload y rate (FR-030, FR-031, FR-032, CA12)
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { API_KEYS_MAP_TOKEN } from '../../src/common/guards/api-key-auth.guard';
import { O2IngestClient } from '../../src/infrastructure/openobserve/ingest';
import { O2SearchClient } from '../../src/infrastructure/openobserve/search';
import { HealthService } from '../../src/application/services/health.service';

const SECRET = 'limits-secret-1234567890abcdefg';
const KEY_ID = 'limits-key-001';
const HASH = createHash('sha256').update(SECRET).digest('hex');
const BEARER = `${KEY_ID}.${SECRET}`;

const KEY_MAP = new Map([
  [
    KEY_ID,
    {
      id: KEY_ID,
      secret_hash: HASH,
      services: ['payments_api'],
      scopes: ['write' as const],
      client_type: 'backend' as const,
      allowed_origins: [],
    },
  ],
]);

const VALID_EVENT = { service: 'payments_api', env: 'test', level: 'info', message: 'ok' };

async function buildApp(): Promise<INestApplication> {
  process.env['NODE_ENV'] = 'test';
  process.env['O2_URL'] = 'http://o2.invalid:5080';
  process.env['O2_ORG'] = 'test-org';
  process.env['O2_AUTH_USER'] = 'test-user';
  process.env['O2_AUTH_PASSWORD'] = 'test-pass';
  process.env['API_KEYS_JSON'] = '[]';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['INGEST_MAX_BATCH'] = '5';

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(API_KEYS_MAP_TOKEN)
    .useValue(KEY_MAP)
    .overrideProvider(O2IngestClient)
    .useValue({ ingestStream: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider(O2SearchClient)
    .useValue({ searchStream: jest.fn().mockResolvedValue({ hits: [], total: 0 }) })
    .overrideProvider(HealthService)
    .useValue({
      liveness: () => ({ status: 'ok' }),
      readiness: jest.fn().mockResolvedValue({ status: 'ok' }),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('Límites de ingesta (FR-031, CA12)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app?.close();
    // Restaurar valor por defecto para otros tests
    delete process.env['INGEST_MAX_BATCH'];
  });

  it('responde 413 cuando el batch supera INGEST_MAX_BATCH (FR-031)', async () => {
    const big = Array.from({ length: 6 }, () => VALID_EVENT);
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send(big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('responde 400 cuando el mensaje supera LOG_MESSAGE_MAX_CHARS', async () => {
    const longMsg = { ...VALID_EVENT, message: 'x'.repeat(10000) };
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send(longMsg);
    // El registro se rechaza pero si hay solo 1, devuelve 400
    expect(res.status).toBe(400);
  });

  it('responde 202 con el batch dentro del límite', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send(Array.from({ length: 5 }, () => VALID_EVENT));
    expect(res.status).toBe(202);
  });
});
