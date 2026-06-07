/**
 * Test unitario del HealthService (FR-028).
 */
import axios from 'axios';
import { HealthService } from '../../src/application/services/health.service';

const mockConfig = { env: { O2_URL: 'https://o2.example.com' } };
const mockLogger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() };

jest.mock('axios');
const axiosGet = axios.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('HealthService (FR-028)', () => {
  it('liveness() siempre devuelve status ok', () => {
    const svc = new HealthService(mockConfig as never, mockLogger as never);
    expect(svc.liveness()).toEqual({ status: 'ok' });
  });

  it('readiness() devuelve ok cuando /healthz responde', async () => {
    axiosGet.mockResolvedValue({ status: 200 });
    const svc = new HealthService(mockConfig as never, mockLogger as never);
    const result = await svc.readiness();
    expect(result.status).toBe('ok');
    expect(result.openobserve).toBe('reachable');
    expect(axiosGet).toHaveBeenCalledWith('https://o2.example.com/healthz', expect.any(Object));
  });

  it('readiness() devuelve error cuando /healthz no es alcanzable', async () => {
    axiosGet.mockRejectedValue(new Error('ECONNREFUSED'));
    const svc = new HealthService(mockConfig as never, mockLogger as never);
    const result = await svc.readiness();
    expect(result.status).toBe('error');
    expect(result.openobserve).toBe('unreachable');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'OpenObserve readiness check failed',
      expect.objectContaining({ module: 'HealthService' }),
    );
  });
});
