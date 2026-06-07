/**
 * Integration test: restricciones de lectura frontend (FR-018, CA20)
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

const FE_SECRET = 'frontend-secret-1234567890abcde';
const FE_ID = 'fe-key-001';
const FE_HASH = createHash('sha256').update(FE_SECRET).digest('hex');
const FE_BEARER = `${FE_ID}.${FE_SECRET}`;

const KEY_MAP = new Map([
  [
    FE_ID,
    {
      id: FE_ID,
      secret_hash: FE_HASH,
      services: ['web_shop'],
      scopes: ['read' as const],
      client_type: 'frontend' as const,
      allowed_origins: [],
      read_policy: {
        response_profile: 'frontend_reduced' as const,
        allow_q: false,
        max_query_window: '7d',
        max_limit: 500,
      },
    },
  ],
]);

const MOCK_HIT = {
  _timestamp: 1748000010000000,
  service: 'web_shop',
  level: 'info',
  message: 'page loaded',
  env: 'test',
  request_id: 'req-001',
  trace_id: 'trace-001',
  context: { password: 'secret123', user_id: 'u123' },
};

let mockSearchFn: jest.Mock;

async function buildApp(): Promise<INestApplication> {
  process.env['NODE_ENV'] = 'test';
  process.env['O2_URL'] = 'http://o2.invalid:5080';
  process.env['O2_ORG'] = 'test-org';
  process.env['O2_AUTH_USER'] = 'test-user';
  process.env['O2_AUTH_PASSWORD'] = 'test-pass';
  process.env['API_KEYS_JSON'] = '[]';
  process.env['LOG_LEVEL'] = 'silent';

  mockSearchFn = jest.fn().mockResolvedValue({ hits: [MOCK_HIT], total: 1 });

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(API_KEYS_MAP_TOKEN)
    .useValue(KEY_MAP)
    .overrideProvider(O2IngestClient)
    .useValue({ ingestStream: jest.fn().mockResolvedValue(undefined) })
    .overrideProvider(O2SearchClient)
    .useValue({ searchStream: mockSearchFn })
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

describe('GET /api/v1/logs — restricciones frontend (FR-018, CA20)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(() => app?.close());

  it('responde 200 con respuesta reducida — sin campos sensibles en context (CA20)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=web_shop')
      .set('Authorization', `Bearer ${FE_BEARER}`);
    expect(res.status).toBe(200);
    const item = res.body.items[0] as Record<string, unknown>;
    // Campos permitidos presentes
    expect(item['_timestamp']).toBeDefined();
    expect(item['level']).toBeDefined();
    expect(item['message']).toBeDefined();
    // context no debe contener password
    const ctx = item['context'] as Record<string, unknown> | undefined;
    if (ctx) {
      expect(ctx['password']).toBeUndefined();
    }
  });

  it('responde 403 cuando usa el parámetro q (FR-018)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=web_shop&q=searchterm')
      .set('Authorization', `Bearer ${FE_BEARER}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('responde 403 cuando consulta un service no autorizado (CA20)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=other_service')
      .set('Authorization', `Bearer ${FE_BEARER}`);
    expect(res.status).toBe(403);
  });

  it('trunca limit > 500 y devuelve limit_truncated: true', async () => {
    mockSearchFn.mockResolvedValueOnce({ hits: [MOCK_HIT], total: 1 });
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=web_shop&limit=1000')
      .set('Authorization', `Bearer ${FE_BEARER}`);
    expect(res.status).toBe(200);
    expect(res.body.limit_truncated).toBe(true);
  });

  it('trunca ventana > 7d y devuelve range_truncated: true', async () => {
    mockSearchFn.mockResolvedValueOnce({ hits: [MOCK_HIT], total: 1 });
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/logs?service=web_shop&from=${encodeURIComponent(oldDate)}`)
      .set('Authorization', `Bearer ${FE_BEARER}`);
    expect(res.status).toBe(200);
    expect(res.body.range_truncated).toBe(true);
  });
});
