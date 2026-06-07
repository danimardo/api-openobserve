/**
 * Test unitario del GlobalExceptionFilter (FR-002, CA10).
 * Cubre DomainError, HttpException e error genérico.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { DomainError } from '../../src/domain/errors/domain-errors';

function makeHostMock(requestId?: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status } as unknown as import('express').Response;
  const req = { requestId, headers: {} } as unknown as import('express').Request;
  return {
    json,
    status,
    host: {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => req,
      }),
    } as unknown as import('@nestjs/common').ArgumentsHost,
  };
}

describe('GlobalExceptionFilter (CA10)', () => {
  const filter = new GlobalExceptionFilter();

  it('mapea DomainError a su código HTTP y estructura de error', () => {
    const { host, status, json } = makeHostMock('req-abc');
    filter.catch(new DomainError('validation_error', 'Bad input'), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'validation_error' }),
        request_id: 'req-abc',
      }),
    );
  });

  it('incluye details cuando el DomainError los tiene', () => {
    const { host, json } = makeHostMock('req-001');
    filter.catch(new DomainError('validation_error', 'Bad', [{ field: 'x' }]), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ details: [{ field: 'x' }] }),
      }),
    );
  });

  it('mapea HttpException a su código de estado', () => {
    const { host, status, json } = makeHostMock('req-002');
    filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'http_error' }),
        request_id: 'req-002',
      }),
    );
  });

  it('mapea error genérico a 500 internal_error', () => {
    const { host, status, json } = makeHostMock('req-003');
    filter.catch(new Error('unexpected'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'internal_error' }),
      }),
    );
  });

  it('usa "unknown" como request_id cuando req.requestId es undefined', () => {
    const { host, json } = makeHostMock(undefined);
    filter.catch(new DomainError('validation_error', 'err'), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ request_id: 'unknown' }));
  });
});
