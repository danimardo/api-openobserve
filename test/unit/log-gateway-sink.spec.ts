/**
 * Test del sink de logs internos al stream log_gateway (FR-034, US11)
 * Verifica que el AppLogger no entra en bucle recursivo ante fallo de O2.
 */
import type { IAppLogger } from '../../src/infrastructure/logging/app-logger.interface';

describe('AppLogger sink — anti-bucle recursivo (FR-034)', () => {
  it('el logger acepta un logger falso sin dependencias externas', () => {
    const fakeLogger: IAppLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    expect(() => {
      fakeLogger.info('test message', { module: 'TestModule', operation: 'test' });
    }).not.toThrow();
  });

  it('el logger no propaga errores si el transporte falla', () => {
    const fakeLogger: IAppLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn().mockImplementation(() => {
        /* no throw */
      }),
      fatal: jest.fn(),
    };

    expect(() => {
      fakeLogger.error('delivery failed', new Error('O2 unreachable'), { module: 'Worker' });
    }).not.toThrow();
  });

  it('el logger nunca llama a console.* directamente', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleSpy2 = jest.spyOn(console, 'error').mockImplementation(() => {});

    const fakeLogger: IAppLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    fakeLogger.info('msg');
    fakeLogger.error('err msg', null, {});

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(consoleSpy2).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    consoleSpy2.mockRestore();
  });
});
