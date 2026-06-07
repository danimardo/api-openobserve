/**
 * Test unitario del HealthService (FR-028).
 */
import { HealthService } from '../../src/application/services/health.service';

function makeO2Client(clusterResult: 'ok' | 'fail', streamsResult: 'ok' | 'fail' = 'ok') {
  const get = jest
    .fn()
    .mockImplementationOnce(() => {
      if (clusterResult === 'fail') return Promise.reject(new Error('ECONNREFUSED'));
      return Promise.resolve({ data: { status: 'green' } });
    })
    .mockImplementationOnce(() => {
      if (streamsResult === 'fail') return Promise.reject(new Error('ECONNREFUSED'));
      return Promise.resolve({ data: { list: [] } });
    });
  return { http: { get } };
}

describe('HealthService (FR-028)', () => {
  it('liveness() siempre devuelve status ok', () => {
    const svc = new HealthService({ http: { get: jest.fn() } } as never);
    expect(svc.liveness()).toEqual({ status: 'ok' });
  });

  it('readiness() devuelve ok cuando /_cluster/health responde', async () => {
    const svc = new HealthService(makeO2Client('ok') as never);
    const result = await svc.readiness();
    expect(result.status).toBe('ok');
    expect(result.openobserve).toBe('reachable');
  });

  it('readiness() usa /streams como fallback cuando /_cluster/health falla', async () => {
    const svc = new HealthService(makeO2Client('fail', 'ok') as never);
    const result = await svc.readiness();
    expect(result.status).toBe('ok');
    expect(result.openobserve).toBe('reachable');
  });

  it('readiness() devuelve error cuando ambos endpoints fallan', async () => {
    const svc = new HealthService(makeO2Client('fail', 'fail') as never);
    const result = await svc.readiness();
    expect(result.status).toBe('error');
    expect(result.openobserve).toBe('unreachable');
  });
});
