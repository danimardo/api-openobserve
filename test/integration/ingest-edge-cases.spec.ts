/**
 * Tests de edge cases en IngestService — env no permitido, contexto con redacción,
 * cola llena (FR-005, FR-007, FR-014, CA12).
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
import { InMemoryQueue } from '../../src/infrastructure/queue/queue';

const SECRET = 'edge-case-secret-abcdef1234567890';
const KEY_ID = 'edge-key-001';
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

async function buildApp(): Promise<INestApplication> {
  process.env['NODE_ENV'] = 'test';
  process.env['O2_URL'] = 'http://o2.invalid:5080';
  process.env['O2_ORG'] = 'test-org';
  process.env['O2_AUTH_USER'] = 'test-user';
  process.env['O2_AUTH_PASSWORD'] = 'test-pass';
  process.env['API_KEYS_JSON'] = '[]';
  process.env['LOG_LEVEL'] = 'silent';
  process.env['ALLOWED_ENVS'] = 'production,staging,test';

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

describe('IngestService — edge cases (FR-005, FR-014)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await app?.close();
    delete process.env['ALLOWED_ENVS'];
  });

  it('rechaza evento con env no permitido (FR-005, líneas 91-97)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send({ service: 'payments_api', env: 'canary', level: 'info', message: 'env not allowed' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('acepta evento con contexto que contiene campos sensibles (redacción FR-014)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send({
        service: 'payments_api',
        env: 'test',
        level: 'info',
        message: 'payment processed',
        context: {
          amount: 9.99,
          password: 'should-be-redacted',
          api_key: 'my-key',
          nested: { email: 'user@example.com', other: 'ok' },
        },
      });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
  });

  it('acepta evento con contexto con valores largos que serán truncados', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send({
        service: 'payments_api',
        env: 'test',
        level: 'info',
        message: 'with long context value',
        context: {
          description: 'x'.repeat(5000),
        },
      });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
  });

  it('acepta evento con campos raíz extra que se mueven a context.extra', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send({
        service: 'payments_api',
        env: 'test',
        level: 'info',
        message: 'extra fields test',
        custom_field: 'extra_value',
        another_field: 42,
      });
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
  });
});

describe('IngestService — cola llena (FR-008)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['O2_URL'] = 'http://o2.invalid:5080';
    process.env['O2_ORG'] = 'test-org';
    process.env['O2_AUTH_USER'] = 'test-user';
    process.env['O2_AUTH_PASSWORD'] = 'test-pass';
    process.env['API_KEYS_JSON'] = '[]';
    process.env['LOG_LEVEL'] = 'silent';
    process.env['QUEUE_MAX_ITEMS'] = '1';

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

    const app_ = moduleRef.createNestApplication();
    app_.setGlobalPrefix('api/v1');
    await app_.init();

    // Llenar la cola manualmente
    const queue = moduleRef.get(InMemoryQueue);
    queue.enqueue([
      {
        _timestamp: Date.now() * 1000,
        service: 'payments_api',
        env: 'test',
        level: 'info',
        message: 'fill',
        source: 'backend',
      },
    ]);

    app = app_;
  });

  afterAll(async () => {
    await app?.close();
    delete process.env['QUEUE_MAX_ITEMS'];
  });

  it('responde 429 cuando la cola está llena (FR-008, líneas 182-184)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send({ service: 'payments_api', env: 'test', level: 'info', message: 'queue full test' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('rate_limited');
  });
});
