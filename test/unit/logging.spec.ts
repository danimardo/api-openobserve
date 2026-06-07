import { redactLogData } from '../../src/infrastructure/logging/redact';
import type { IAppLogger, LogContext } from '../../src/infrastructure/logging/app-logger.interface';
import { AppLogger } from '../../src/infrastructure/logging/app-logger';

describe('redactLogData', () => {
  it('redacts sensitive top-level keys', () => {
    const data = {
      request_id: 'abc',
      password: 'secret123',
      token: 'bearer-token',
    };
    const result = redactLogData(data);
    expect(result['password']).toBe('***redacted***');
    expect(result['token']).toBe('***redacted***');
    expect(result['request_id']).toBe('abc');
  });

  it('redacts nested sensitive keys', () => {
    const data = {
      user: {
        name: 'John',
        secret: 'hidden',
        credentials: { api_key: 'key123' },
      },
    };
    const result = redactLogData(data) as { user: Record<string, unknown> };
    expect((result.user as Record<string, unknown>)['secret']).toBe('***redacted***');
    const creds = (result.user as Record<string, unknown>)['credentials'] as Record<
      string,
      unknown
    >;
    expect(creds['api_key']).toBe('***redacted***');
    expect((result.user as Record<string, unknown>)['name']).toBe('John');
  });

  it('does not modify arrays', () => {
    const data = { tags: ['a', 'b', 'c'], count: 3 };
    const result = redactLogData(data);
    expect(result['tags']).toEqual(['a', 'b', 'c']);
    expect(result['count']).toBe(3);
  });

  it('is case-insensitive for key matching', () => {
    const data = { Authorization: 'Bearer token', PASSWORD: 'pass' };
    const result = redactLogData(data);
    expect(result['Authorization']).toBe('***redacted***');
    expect(result['PASSWORD']).toBe('***redacted***');
  });

  it('preserves non-sensitive keys unchanged', () => {
    const data = { service: 'payments', env: 'production', level: 'info' };
    const result = redactLogData(data);
    expect(result).toEqual(data);
  });

  it('handles empty object', () => {
    expect(redactLogData({})).toEqual({});
  });
});

describe('IAppLogger interface contract', () => {
  function makeFakeLogger(): IAppLogger & { calls: Array<{ method: string; args: unknown[] }> } {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    return {
      calls,
      trace(msg: string, ctx?: LogContext) {
        calls.push({ method: 'trace', args: [msg, ctx] });
      },
      debug(msg: string, ctx?: LogContext) {
        calls.push({ method: 'debug', args: [msg, ctx] });
      },
      info(msg: string, ctx?: LogContext) {
        calls.push({ method: 'info', args: [msg, ctx] });
      },
      warn(msg: string, ctx?: LogContext) {
        calls.push({ method: 'warn', args: [msg, ctx] });
      },
      error(msg: string, err?: Error | null, ctx?: LogContext) {
        calls.push({ method: 'error', args: [msg, err, ctx] });
      },
      fatal(msg: string, err?: Error | null, ctx?: LogContext) {
        calls.push({ method: 'fatal', args: [msg, err, ctx] });
      },
    };
  }

  it('supports all standard log levels', () => {
    const logger = makeFakeLogger();
    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    logger.fatal('f');
    expect(logger.calls.map((c) => c.method)).toEqual([
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('accepts context with request_id without secrets in message', () => {
    const logger = makeFakeLogger();
    const ctx: LogContext = { request_id: 'req-123', service: 'payments', module: 'ingest' };
    logger.info('log received', ctx);
    expect(logger.calls[0]?.args[0]).toBe('log received');
    const capturedCtx = logger.calls[0]?.args[1] as LogContext;
    expect(capturedCtx.request_id).toBe('req-123');
  });

  it('accepts error object in error/fatal calls', () => {
    const logger = makeFakeLogger();
    const err = new Error('something broke');
    logger.error('delivery failed', err, { operation: 'deliver' });
    expect(logger.calls[0]?.args[1]).toBe(err);
  });
});

describe('AppLogger — delegación a pino (cobertura de implementación)', () => {
  function makePinoMock() {
    return {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };
  }

  it('delega trace a pino con campos del contexto', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    logger.trace('msg trace', { module: 'M' });
    expect(pino.trace).toHaveBeenCalledWith(expect.objectContaining({ module: 'M' }), 'msg trace');
  });

  it('delega debug a pino', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    logger.debug('msg debug');
    expect(pino.debug).toHaveBeenCalledWith({}, 'msg debug');
  });

  it('delega info a pino con contexto vacío si no se pasa', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    logger.info('msg info');
    expect(pino.info).toHaveBeenCalledWith({}, 'msg info');
  });

  it('delega warn a pino con contexto', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    logger.warn('msg warn', { operation: 'op' });
    expect(pino.warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'op' }),
      'msg warn',
    );
  });

  it('delega error a pino con err serializado cuando se pasa Error', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    const err = new Error('boom');
    logger.error('msg error', err, { module: 'worker' });
    expect(pino.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ message: 'boom' }) }),
      'msg error',
    );
  });

  it('delega error a pino sin err cuando error es null', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    logger.error('msg error null', null);
    expect(pino.error).toHaveBeenCalledWith(
      expect.not.objectContaining({ err: expect.anything() }),
      'msg error null',
    );
  });

  it('delega fatal a pino con err serializado', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    const err = new Error('fatal err');
    logger.fatal('msg fatal', err);
    expect(pino.fatal).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ message: 'fatal err' }) }),
      'msg fatal',
    );
  });

  it('redacta campos sensibles del contexto antes de pasar a pino', () => {
    const pino = makePinoMock();
    const logger = new AppLogger(pino as never);
    logger.info('msg', { module: 'M', authorization: 'Bearer secret' } as LogContext);
    const fields = pino.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(fields['authorization']).toBe('***redacted***');
  });
});
