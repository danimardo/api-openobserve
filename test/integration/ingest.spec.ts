/**
 * Integration test: contrato HTTP de POST /api/v1/logs (FR-001, FR-003, CA1)
 *
 * Levanta el módulo completo con AppModule pero sustituye:
 *   - API_KEYS_MAP_TOKEN → mapa de keys de prueba
 *   - O2IngestClient     → stub sin red (entrega asíncrona silenciosa)
 */
// supertest exports a CJS function; use require to avoid SWC namespace wrapping
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { API_KEYS_MAP_TOKEN } from '../../src/common/guards/api-key-auth.guard';
import { O2IngestClient } from '../../src/infrastructure/openobserve/ingest';

const WRITE_SECRET = 'integ-write-secret-1234567890abc';
const WRITE_KEY_ID = 'int-write-001';
const WRITE_HASH = createHash('sha256').update(WRITE_SECRET).digest('hex');
const WRITE_BEARER = `${WRITE_KEY_ID}.${WRITE_SECRET}`;

const READ_SECRET = 'integ-read-secret-xxxxxxxxxxxx12';
const READ_KEY_ID = 'int-read-001';
const READ_HASH = createHash('sha256').update(READ_SECRET).digest('hex');
const READ_BEARER = `${READ_KEY_ID}.${READ_SECRET}`;

const TEST_KEY_MAP = new Map([
  [
    WRITE_KEY_ID,
    {
      id: WRITE_KEY_ID,
      secret_hash: WRITE_HASH,
      services: ['payments_api', 'orders_api'],
      scopes: ['write' as const, 'read' as const],
      client_type: 'backend' as const,
      allowed_origins: [],
    },
  ],
  [
    READ_KEY_ID,
    {
      id: READ_KEY_ID,
      secret_hash: READ_HASH,
      services: ['payments_api'],
      scopes: ['read' as const],
      client_type: 'backend' as const,
      allowed_origins: [],
    },
  ],
]);

const VALID_EVENT = {
  service: 'payments_api',
  env: 'test',
  level: 'info',
  message: 'Payment processed successfully',
  trace_id: 'trace-test-001',
};

function setupEnv(): void {
  process.env['NODE_ENV'] = 'test';
  process.env['O2_URL'] = 'http://o2.invalid:5080';
  process.env['O2_ORG'] = 'test-org';
  process.env['O2_AUTH_USER'] = 'test-user';
  process.env['O2_AUTH_PASSWORD'] = 'test-pass';
  process.env['API_KEYS_JSON'] = '[]';
  process.env['LOG_LEVEL'] = 'silent';
}

async function buildApp(keyMap = TEST_KEY_MAP): Promise<INestApplication> {
  setupEnv();
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(API_KEYS_MAP_TOKEN)
    .useValue(keyMap)
    .overrideProvider(O2IngestClient)
    .useValue({ ingestStream: jest.fn().mockResolvedValue(undefined) })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('POST /api/v1/logs — contrato HTTP (FR-001, FR-003)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(() => app?.close());

  it('responde 202 con accepted:1 para un evento válido (CA1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send(VALID_EVENT);

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(0);
    expect(res.body.errors).toBeUndefined();
  });

  it('responde 202 para un array de eventos (FR-001)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send([VALID_EVENT, { ...VALID_EVENT, service: 'orders_api', level: 'warn' }]);

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(2);
    expect(res.body.rejected).toBe(0);
  });

  it('responde 401 sin header Authorization', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/logs').send(VALID_EVENT);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('responde 403 con key sin scope write (FR-021)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${READ_BEARER}`)
      .send(VALID_EVENT);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('responde 400 para un array vacío', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send([]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('responde 202 con aceptación parcial para lote mixto válido/inválido (FR-003)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send([
        VALID_EVENT,
        { service: 'payments_api', env: 'test', level: 'info' }, // missing message
      ]);

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(1);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({ index: 1, code: 'validation_error' });
  });

  it('rechaza registros de services no autorizados para la key (FR-022)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send([VALID_EVENT, { ...VALID_EVENT, service: 'unauthorized_service' }]);

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(1);
    expect(res.body.errors[0].code).toBe('forbidden');
  });

  it('normaliza alias de level (warning → warn) (FR-011)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send({ ...VALID_EVENT, level: 'warning' });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
  });

  it('rechaza eventos con nivel desconocido (FR-011)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${WRITE_BEARER}`)
      .send({ ...VALID_EVENT, level: 'verbose' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});
