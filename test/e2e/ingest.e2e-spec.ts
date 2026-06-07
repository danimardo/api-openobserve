/**
 * E2E test: ingesta → aparición en stream OpenObserve (CA1, CA8)
 *
 * Requires a running OpenObserve instance.
 * Configure via env vars: O2_URL, O2_ORG, O2_AUTH_USER, O2_AUTH_PASSWORD, API_KEYS_JSON.
 *
 * Skipped when O2_URL is not set or points to a non-responsive server.
 */
// supertest exports a CJS function; use require to avoid SWC namespace wrapping
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as typeof import('supertest');
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { AppModule } from '../../src/app.module';
import { API_KEYS_MAP_TOKEN } from '../../src/common/guards/api-key-auth.guard';

const SECRET = 'e2e-test-secret-32bytes-xxxxxxxxxxx';
const KEY_ID = 'e2e-write-key';
const SECRET_HASH = createHash('sha256').update(SECRET).digest('hex');
const BEARER = `${KEY_ID}.${SECRET}`;

describe('E2E: POST /api/v1/logs → OpenObserve (CA1, CA8)', () => {
  let app: INestApplication;
  const skipE2E = !process.env['O2_URL'] || process.env['O2_URL']?.includes('localhost:5080');

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
              scopes: ['write', 'read'],
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

  it('accepts a valid event and returns 202 (CA1)', async () => {
    if (skipE2E) return;

    const res = await request(app.getHttpServer())
      .post('/api/v1/logs')
      .set('Authorization', `Bearer ${BEARER}`)
      .send({
        service: 'e2e_test_stream',
        env: 'test',
        level: 'info',
        message: 'E2E ingestion test',
        trace_id: 'e2e-trace-001',
      });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(0);
  });
});
