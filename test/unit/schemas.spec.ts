/**
 * Test de cobertura de los schemas Zod (query.schema.ts, domain-errors.ts).
 */
import { QueryParamsSchema } from '../../src/domain/schemas/query.schema';
import { DomainError, ERROR_HTTP_STATUS } from '../../src/domain/errors/domain-errors';

describe('QueryParamsSchema — transform include_total', () => {
  it('parsea include_total=true (booleano) como true', () => {
    const result = QueryParamsSchema.parse({ service: 'svc', include_total: true });
    expect(result.include_total).toBe(true);
  });

  it('parsea include_total="true" (string) como true', () => {
    const result = QueryParamsSchema.parse({ service: 'svc', include_total: 'true' });
    expect(result.include_total).toBe(true);
  });

  it('parsea include_total=false (booleano) como false', () => {
    const result = QueryParamsSchema.parse({ service: 'svc', include_total: false });
    expect(result.include_total).toBe(false);
  });

  it('parsea include_total="false" (string) como false', () => {
    const result = QueryParamsSchema.parse({ service: 'svc', include_total: 'false' });
    expect(result.include_total).toBe(false);
  });

  it('sort por defecto es "desc"', () => {
    const result = QueryParamsSchema.parse({ service: 'svc' });
    expect(result.sort).toBe('desc');
  });

  it('limit por defecto es 100', () => {
    const result = QueryParamsSchema.parse({ service: 'svc' });
    expect(result.limit).toBe(100);
  });
});

describe('DomainError y ERROR_HTTP_STATUS', () => {
  it('DomainError almacena code, message y details', () => {
    const err = new DomainError('validation_error', 'bad', [{ field: 'x' }]);
    expect(err.code).toBe('validation_error');
    expect(err.message).toBe('bad');
    expect(err.details).toEqual([{ field: 'x' }]);
  });

  it('ERROR_HTTP_STATUS mapea todos los códigos conocidos', () => {
    expect(ERROR_HTTP_STATUS['validation_error']).toBe(400);
    expect(ERROR_HTTP_STATUS['unauthorized']).toBe(401);
    expect(ERROR_HTTP_STATUS['forbidden']).toBe(403);
    expect(ERROR_HTTP_STATUS['payload_too_large']).toBe(413);
    expect(ERROR_HTTP_STATUS['rate_limited']).toBe(429);
    expect(ERROR_HTTP_STATUS['openobserve_error']).toBe(502);
  });
});
