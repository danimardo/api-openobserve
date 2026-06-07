/**
 * Integration test: GET /api/v1/logs — contrato HTTP (FR-015, FR-016, CA9)
 *
 * Monta AppModule completo con:
 *   - API_KEYS_MAP_TOKEN → mapa de keys de prueba
 *   - O2SearchClient     → stub que devuelve hits ficticios
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { API_KEYS_MAP_TOKEN } from '../../src/common/guards/api-key-auth.guard';
import { O2SearchClient } from '../../src/infrastructure/openobserve/search';
import { O2IngestClient } from '../../src/infrastructure/openobserve/ingest';

const READ_SECRET = 'query-read-secret-1234567890abcd';
const READ_KEY_ID = 'qry-read-001';
const READ_HASH = createHash('sha256').update(READ_SECRET).digest('hex');
const READ_BEARER = `${READ_KEY_ID}.${READ_SECRET}`;

const WRITE_ONLY_SECRET = 'query-write-secret-xxxxxxxxxxxx12';
const WRITE_ONLY_ID = 'qry-write-001';
const WRITE_ONLY_HASH = createHash('sha256').update(WRITE_ONLY_SECRET).digest('hex');
const WRITE_ONLY_BEARER = `${WRITE_ONLY_ID}.${WRITE_ONLY_SECRET}`;

const KEY_MAP = new Map([
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
  [
    WRITE_ONLY_ID,
    {
      id: WRITE_ONLY_ID,
      secret_hash: WRITE_ONLY_HASH,
      services: ['payments_api'],
      scopes: ['write' as const],
      client_type: 'backend' as const,
      allowed_origins: [],
    },
  ],
]);

const MOCK_HITS = [
  {
    _timestamp: 1748000010000000,
    service: 'payments_api',
    level: 'info',
    message: 'hit 1',
    env: 'test',
    source: 'backend',
  },
  {
    _timestamp: 1748000000000000,
    service: 'payments_api',
    level: 'warn',
    message: 'hit 2',
    env: 'test',
    source: 'backend',
  },
];

let mockSearchFn: jest.Mock;

async function buildApp(): Promise<INestApplication> {
  process.env['NODE_ENV'] = 'test';
  process.env['O2_URL'] = 'http://o2.invalid:5080';
  process.env['O2_ORG'] = 'test-org';
  process.env['O2_AUTH_USER'] = 'test-user';
  process.env['O2_AUTH_PASSWORD'] = 'test-pass';
  process.env['API_KEYS_JSON'] = '[]';
  process.env['LOG_LEVEL'] = 'silent';

  mockSearchFn = jest.fn().mockResolvedValue({ hits: MOCK_HITS, total: 2 });

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(API_KEYS_MAP_TOKEN)
    .useValue(KEY_MAP)
    .overrideProvider(O2SearchClient)
    .useValue({ searchStream: mockSearchFn })
    .overrideProvider(O2IngestClient)
    .useValue({ ingestStream: jest.fn().mockResolvedValue(undefined) })
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('GET /api/v1/logs — contrato HTTP (FR-015, CA9)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(() => app?.close());

  it('responde 200 con items y next_cursor para key read válida (CA9)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=payments_api')
      .set('Authorization', `Bearer ${READ_BEARER}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('request_id');
  });

  it('genera next_cursor cuando hits == limit (FR-017)', async () => {
    // Con limit=2 y el mock devolviendo 2 hits, se genera next_cursor
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=payments_api&limit=2')
      .set('Authorization', `Bearer ${READ_BEARER}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('next_cursor');
    expect(typeof res.body.next_cursor).toBe('string');
  });

  it('responde 400 cuando falta service (FR-015)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs')
      .set('Authorization', `Bearer ${READ_BEARER}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('responde 401 sin Authorization', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/logs?service=payments_api');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  it('responde 403 cuando la key solo tiene scope write (FR-021)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=payments_api')
      .set('Authorization', `Bearer ${WRITE_ONLY_BEARER}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('responde 403 cuando la key no tiene acceso al service solicitado (FR-022)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=orders_api')
      .set('Authorization', `Bearer ${READ_BEARER}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('acepta parámetros de filtro opcionales sin error (FR-015)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=payments_api&level=info&limit=10&sort=asc')
      .set('Authorization', `Bearer ${READ_BEARER}`);

    expect(res.status).toBe(200);
    expect(mockSearchFn).toHaveBeenCalled();
  });

  it('acepta cursor de paginación sin error (FR-017)', async () => {
    // limit=2 para que hits(2) == limit → next_cursor generado
    const first = await request(app.getHttpServer())
      .get('/api/v1/logs?service=payments_api&limit=2')
      .set('Authorization', `Bearer ${READ_BEARER}`);

    const cursor = first.body.next_cursor;
    expect(cursor).toBeTruthy();

    // Segundo request con cursor
    mockSearchFn.mockResolvedValueOnce({ hits: [], total: 0 });
    const second = await request(app.getHttpServer())
      .get(`/api/v1/logs?service=payments_api&cursor=${cursor}`)
      .set('Authorization', `Bearer ${READ_BEARER}`);

    expect(second.status).toBe(200);
    expect(second.body.next_cursor).toBeNull();
  });
});
