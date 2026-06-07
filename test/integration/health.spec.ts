/**
 * Integration test: GET /api/v1/health y /api/v1/health/ready (FR-028, CA13)
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { API_KEYS_MAP_TOKEN } from '../../src/common/guards/api-key-auth.guard';
import { O2IngestClient } from '../../src/infrastructure/openobserve/ingest';
import { O2SearchClient } from '../../src/infrastructure/openobserve/search';
import { HealthService } from '../../src/application/services/health.service';

async function buildApp(healthReadyResult: {
  status: 'ok' | 'error';
  openobserve?: string;
}): Promise<INestApplication> {
  process.env['NODE_ENV'] = 'test';
  process.env['O2_URL'] = 'http://o2.invalid:5080';
  process.env['O2_ORG'] = 'test-org';
  process.env['O2_AUTH_USER'] = 'test-user';
  process.env['O2_AUTH_PASSWORD'] = 'test-pass';
  process.env['API_KEYS_JSON'] = '[]';
  process.env['LOG_LEVEL'] = 'silent';

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(API_KEYS_MAP_TOKEN)
    .useValue(new Map())
    .overrideProvider(O2IngestClient)
    .useValue({ ingestStream: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider(O2SearchClient)
    .useValue({ searchStream: jest.fn().mockResolvedValue({ hits: [], total: 0 }) })
    .overrideProvider(HealthService)
    .useValue({
      liveness: () => ({ status: 'ok' }),
      readiness: jest.fn().mockResolvedValue(healthReadyResult),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('GET /api/v1/health — liveness (FR-028, CA13)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp({ status: 'ok', openobserve: 'reachable' });
  });
  afterAll(() => app?.close());

  it('responde 200 sin requerir Authorization (público)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/v1/health/ready — readiness O2 ok (FR-028)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp({ status: 'ok', openobserve: 'reachable' });
  });
  afterAll(() => app?.close());

  it('responde 200 cuando O2 es accesible', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/v1/health/ready — readiness O2 ko (FR-028, CA13)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp({ status: 'error', openobserve: 'unreachable' });
  });
  afterAll(() => app?.close());

  it('responde 503 cuando O2 es inaccesible', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
  });
});
