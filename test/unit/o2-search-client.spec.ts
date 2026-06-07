/**
 * Test unitario del O2SearchClient (cobertura de branches de search.ts).
 */
import { O2SearchClient } from '../../src/infrastructure/openobserve/search';
import { DomainError } from '../../src/domain/errors/domain-errors';

const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() };

function makeClient(postFn: jest.Mock) {
  const http = { post: postFn };
  return new O2SearchClient({ http } as never, mockLogger as never);
}

const BASE_QUERY = { sql: 'SELECT * FROM s', size: 10, start_time: 0, end_time: 1 };

describe('O2SearchClient (search.ts branches)', () => {
  it('devuelve hits cuando O2 responde correctamente', async () => {
    const hit = { _timestamp: 1, message: 'ok' };
    const post = jest.fn().mockResolvedValue({ data: { hits: [hit], total: 1 } });
    const client = makeClient(post);
    const result = await client.searchStream('my_stream', BASE_QUERY);
    expect(result.hits).toEqual([hit]);
    expect(result.total).toBe(1);
  });

  it('devuelve hits vacíos cuando la respuesta no pasa el schema de Zod', async () => {
    const post = jest.fn().mockResolvedValue({ data: { unexpected: true } });
    const client = makeClient(post);
    const result = await client.searchStream('my_stream', BASE_QUERY);
    expect(result.hits).toEqual([]);
  });

  it('lanza DomainError openobserve_error cuando el HTTP falla', async () => {
    const post = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = makeClient(post);
    await expect(client.searchStream('my_stream', BASE_QUERY)).rejects.toBeInstanceOf(DomainError);
  });

  it('devuelve total undefined cuando O2 no lo incluye', async () => {
    const post = jest.fn().mockResolvedValue({ data: { hits: [] } });
    const client = makeClient(post);
    const result = await client.searchStream('my_stream', BASE_QUERY);
    expect(result.total).toBeUndefined();
  });
});
