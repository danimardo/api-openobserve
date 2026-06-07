/**
 * Test del snippet backend simulando error/timeout (US4 AC1, AC3).
 * Verifica que no propaga errores y aplica buffer/flush.
 */
import { BackendLogClient } from '../../docs/snippets/backend/log-client';

const VALID_RECORD = {
  service: 'payments_api',
  env: 'test',
  level: 'info' as const,
  message: 'ok',
};

describe('BackendLogClient — best-effort (US4 AC1, AC3)', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('no propaga error de red al llamar log() (AC1)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const client = new BackendLogClient({
      baseUrl: 'http://gateway.invalid',
      apiKey: 'key-001.secret',
    });

    expect(() => {
      client.log(VALID_RECORD);
    }).not.toThrow();
    await client.flush();
    client.destroy();
  });

  it('no propaga timeout al hacer flush() (AC1)', async () => {
    fetchMock.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('AbortError')), 10)),
    );

    const client = new BackendLogClient({
      baseUrl: 'http://gateway.invalid',
      apiKey: 'key-001.secret',
      timeoutMs: 5,
    });
    client.log(VALID_RECORD);

    await expect(client.flush()).resolves.toBeUndefined();
    client.destroy();
  });

  it('no propaga respuesta 5xx del servidor', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const client = new BackendLogClient({
      baseUrl: 'http://gateway.test',
      apiKey: 'key-001.secret',
    });
    client.log(VALID_RECORD);

    await expect(client.flush()).resolves.toBeUndefined();
    client.destroy();
  });

  it('agrupa registros en buffer y hace flush por tamaño (AC3)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });

    const client = new BackendLogClient({
      baseUrl: 'http://gateway.test',
      apiKey: 'key-001.secret',
      batchSize: 3,
    });

    client.log(VALID_RECORD);
    client.log(VALID_RECORD);
    // Al añadir el tercero, debería disparar flush automático
    client.log(VALID_RECORD);

    // Dejamos tiempo para que el flush asíncrono se ejecute
    await new Promise((r) => setTimeout(r, 50));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const callBody = JSON.parse(init.body as string) as unknown[];
    expect(callBody).toHaveLength(3);
    client.destroy();
  });

  it('envía Authorization Bearer en el header', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 202 });

    const client = new BackendLogClient({
      baseUrl: 'http://gateway.test',
      apiKey: 'key-abc.mysecret',
    });
    client.log(VALID_RECORD);
    await client.flush();
    client.destroy();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer key-abc.mysecret');
  });

  it('flush() no hace llamadas si el buffer está vacío', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const client = new BackendLogClient({
      baseUrl: 'http://gateway.test',
      apiKey: 'key-001.secret',
    });
    await client.flush();
    client.destroy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
