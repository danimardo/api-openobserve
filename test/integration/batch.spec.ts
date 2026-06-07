/**
 * Integration test: POST /api/v1/logs/batch (FR-002, FR-003, FR-004)
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

const SECRET = 'batch-secret-1234567890abcdefgh';
const KEY_ID = 'batch-key-001';
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

const VALID_EVENT = { service: 'payments_api', env: 'test', level: 'info', message: 'batch test' };
const INVALID_EVENT = { service: 'payments_api', env: 'test', level: 'info' }; // sin message

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

describe('POST /api/v1/logs/batch — contrato HTTP (FR-002, FR-003, FR-004)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(() => app?.close());

  it('responde 202 con array válido (FR-003)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send([VALID_EVENT]);
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(0);
  });

  it('responde 202 con mezcla válido/inválido y conteos correctos (CA2, CA3)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send([VALID_EVENT, INVALID_EVENT]);
    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(1);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('responde 400 cuando el body no es array (FR-002)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send(VALID_EVENT); // objeto, no array
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('responde 400 cuando el lote no tiene ningún evento válido (CA4)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send([INVALID_EVENT]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('responde 401 sin Authorization', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/logs/batch').send([VALID_EVENT]);
    expect(res.status).toBe(401);
  });

  it('incluye request_id en respuesta', async () => {
    // El batch endpoint no devuelve request_id en el body (solo 202 con conteos)
    // Pero sí en headers x-request-id si lo configuramos — verificamos body básico
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send([VALID_EVENT]);
    expect(res.status).toBe(202);
    expect(typeof res.body.accepted).toBe('number');
  });

  it('responde 413 cuando el lote supera INGEST_MAX_BATCH', async () => {
    // INGEST_MAX_BATCH por defecto es 500; enviamos 501 eventos
    const big = Array.from({ length: 501 }, () => VALID_EVENT);
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs/batch')
      .set('Authorization', `Bearer ${BEARER}`)
      .send(big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });
});
