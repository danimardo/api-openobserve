/**
 * Integration test: GET /api/v1/services — capacidades de la API key (FR-027, CA19)
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

const BACKEND_SECRET = 'backend-secret-abcdef1234567890abcd';
const BACKEND_KEY_ID = 'services-backend-001';
const BACKEND_HASH = createHash('sha256').update(BACKEND_SECRET).digest('hex');
const BACKEND_BEARER = `${BACKEND_KEY_ID}.${BACKEND_SECRET}`;

const FRONTEND_SECRET = 'frontend-secret-abcdef1234567890ab';
const FRONTEND_KEY_ID = 'services-frontend-001';
const FRONTEND_HASH = createHash('sha256').update(FRONTEND_SECRET).digest('hex');
const FRONTEND_BEARER = `${FRONTEND_KEY_ID}.${FRONTEND_SECRET}`;

const KEY_MAP = new Map([
  [
    BACKEND_KEY_ID,
    {
      id: BACKEND_KEY_ID,
      secret_hash: BACKEND_HASH,
      services: ['payments_api', 'orders_api'],
      scopes: ['write' as const],
      client_type: 'backend' as const,
      allowed_origins: [],
      envs: ['production', 'staging'],
    },
  ],
  [
    FRONTEND_KEY_ID,
    {
      id: FRONTEND_KEY_ID,
      secret_hash: FRONTEND_HASH,
      services: ['frontend_app'],
      scopes: ['write' as const, 'read' as const],
      client_type: 'frontend' as const,
      allowed_origins: ['https://app.example.com'],
      read_policy: {
        response_profile: 'frontend_reduced' as const,
        allow_q: false,
        max_query_window: '7d',
        max_limit: 200,
      },
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

describe('GET /api/v1/services (FR-027, CA19)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(() => app?.close());

  it('responde 401 sin Authorization', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/services');
    expect(res.status).toBe(401);
  });

  it('devuelve capacidades de key backend sin secret_hash (CA19)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${BACKEND_BEARER}`);
    expect(res.status).toBe(200);
    expect(res.body.services).toEqual(['payments_api', 'orders_api']);
    expect(res.body.scopes).toContain('write');
    expect(res.body.client_type).toBe('backend');
    expect(res.body.envs).toEqual(['production', 'staging']);
    expect(res.body).not.toHaveProperty('secret_hash');
    expect(res.body).not.toHaveProperty('id');
  });

  it('devuelve capacidades de key frontend incluyendo read_policy sin secret_hash', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${FRONTEND_BEARER}`);
    expect(res.status).toBe(200);
    expect(res.body.services).toEqual(['frontend_app']);
    expect(res.body.client_type).toBe('frontend');
    expect(res.body.allowed_origins).toContain('https://app.example.com');
    expect(res.body.read_policy).toBeDefined();
    expect(res.body.read_policy.max_limit).toBe(200);
    expect(res.body.read_policy.allow_q).toBe(false);
    expect(res.body).not.toHaveProperty('secret_hash');
  });

  it('key backend sin read_policy no la incluye en la respuesta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', `Bearer ${BACKEND_BEARER}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('read_policy');
  });

  it('responde 401 con Bearer malformado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/services')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
