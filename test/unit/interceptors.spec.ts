/**
 * Tests unitarios de RequestIdInterceptor y DurationInterceptor.
 */
import { of } from 'rxjs';
import { RequestIdInterceptor } from '../../src/common/interceptors/request-id.interceptor';

function makeExecutionContext(headers: Record<string, string | string[]> = {}) {
  const req = {
    headers,
    requestId: undefined as string | undefined,
  } as unknown as import('express').Request;
  return {
    req,
    context: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    } as unknown as import('@nestjs/common').ExecutionContext,
  };
}

const NEXT = { handle: () => of(null) } as unknown as import('@nestjs/common').CallHandler;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('RequestIdInterceptor', () => {
  const interceptor = new RequestIdInterceptor();

  it('asigna un UUID generado cuando no hay x-request-id', (done) => {
    const { req, context } = makeExecutionContext();
    interceptor.intercept(context, NEXT).subscribe(() => {
      expect(req.requestId).toMatch(UUID_REGEX);
      done();
    });
  });

  it('usa el x-request-id del header si es un UUID válido', (done) => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const { req, context } = makeExecutionContext({ 'x-request-id': validUuid });
    interceptor.intercept(context, NEXT).subscribe(() => {
      expect(req.requestId).toBe(validUuid);
      done();
    });
  });

  it('genera UUID propio si el x-request-id no es un UUID válido', (done) => {
    const { req, context } = makeExecutionContext({ 'x-request-id': 'not-a-uuid' });
    interceptor.intercept(context, NEXT).subscribe(() => {
      expect(req.requestId).toMatch(UUID_REGEX);
      expect(req.requestId).not.toBe('not-a-uuid');
      done();
    });
  });

  it('maneja x-request-id como array (toma el primer elemento válido)', (done) => {
    const validUuid = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff';
    const { req, context } = makeExecutionContext({ 'x-request-id': [validUuid, 'other'] });
    interceptor.intercept(context, NEXT).subscribe(() => {
      expect(req.requestId).toBe(validUuid);
      done();
    });
  });
});
