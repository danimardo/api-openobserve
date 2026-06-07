/**
 * E2E test: paginación estable contra OpenObserve real (CA9, CA10)
 * Requiere O2 corriendo. Omitido si O2_URL no está configurado.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { API_KEYS_MAP_TOKEN } from '../../src/common/guards/api-key-auth.guard';

const SECRET = 'e2e-query-secret-32bytes-xxxxxxxxxx';
const KEY_ID = 'e2e-read-key';
const SECRET_HASH = createHash('sha256').update(SECRET).digest('hex');
const BEARER = `${KEY_ID}.${SECRET}`;

const SKIP_E2E = !process.env['O2_URL'] || process.env['O2_URL']?.includes('localhost:5080');

describe('E2E: GET /api/v1/logs — paginación cursor (CA9, CA10)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['O2_URL'] ??= 'http://localhost:5080';
    process.env['O2_ORG'] ??= 'default';
    process.env['O2_AUTH_USER'] ??= 'root@example.com';
    process.env['O2_AUTH_PASSWORD'] ??= 'Complexpass#123';
    process.env['API_KEYS_JSON'] = '[]';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(API_KEYS_MAP_TOKEN)
      .useValue(
        new Map([
          [
            KEY_ID,
            {
              id: KEY_ID,
              secret_hash: SECRET_HASH,
              services: ['e2e_test_stream'],
              scopes: ['read', 'write'],
              client_type: 'backend',
              allowed_origins: [],
            },
          ],
        ]),
      )
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(() => app?.close());

  it('devuelve 200 con cursor opaco (CA10)', async () => {
    if (SKIP_E2E) return;

    const res = await request(app.getHttpServer())
      .get('/api/v1/logs?service=e2e_test_stream&limit=5')
      .set('Authorization', `Bearer ${BEARER}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('request_id');
  });
});
