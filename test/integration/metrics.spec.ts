/**
 * Integration test: GET /api/v1/metrics — formato Prometheus (FR-029, CA18)
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

async function buildApp(): Promise<INestApplication> {
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
      readiness: jest.fn().mockResolvedValue({ status: 'ok' }),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('GET /api/v1/metrics — Prometheus (FR-029, CA18)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(() => app?.close());

  it('responde 200 sin Authorization (público)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.status).toBe(200);
  });

  it('devuelve Content-Type text/plain', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('incluye métrica log_gateway_events_accepted_total', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.text).toContain('log_gateway_events_accepted_total');
  });

  it('incluye métrica log_gateway_events_rejected_total', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.text).toContain('log_gateway_events_rejected_total');
  });

  it('incluye métrica log_gateway_queue_depth', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.text).toContain('log_gateway_queue_depth');
  });

  it('incluye métrica log_gateway_request_duration_seconds', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.text).toContain('log_gateway_request_duration_seconds');
  });

  it('incluye métrica log_gateway_redacted_fields_total', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.text).toContain('log_gateway_redacted_fields_total');
  });

  it('incluye métrica log_gateway_rate_limited_total', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/metrics');
    expect(res.text).toContain('log_gateway_rate_limited_total');
  });
});
