/**
 * Test unitario del DeliveryWorker (FR-007, FR-008).
 * Cubre flush, reintentos, backoff y error permanente.
 */
import { DeliveryWorker } from '../../src/infrastructure/queue/delivery.worker';
import { InMemoryQueue } from '../../src/infrastructure/queue/queue';
import type { NormalizedLogEvent } from '../../src/domain/schemas/log-event.schema';

function makeEvent(service = 'svc'): NormalizedLogEvent {
  return {
    _timestamp: Date.now() * 1000,
    service,
    env: 'test',
    level: 'info',
    message: 'msg',
    source: 'backend',
  };
}

function makeWorker(ingestFn: jest.Mock, queueMax = 100, retryAttempts = 1, backoffMs = 10) {
  const gauge = { set: jest.fn() };
  const queue = new InMemoryQueue(queueMax, gauge as never);
  const o2 = { ingestStream: ingestFn };
  const config = {
    env: {
      DELIVERY_BATCH_MAX: 50,
      DELIVERY_FLUSH_MS: 1000,
      RETRY_ATTEMPTS: retryAttempts,
      RETRY_BACKOFF_MS: backoffMs,
    },
  };
  const metrics = {
    o2RetriesTotal: { inc: jest.fn() },
    o2DeliveryFailedTotal: { inc: jest.fn() },
  };
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  };
  return {
    worker: new DeliveryWorker(
      queue,
      o2 as never,
      config as never,
      metrics as never,
      logger as never,
    ),
    queue,
    metrics,
    logger,
  };
}

describe('DeliveryWorker — flush y reintentos (FR-007, FR-008)', () => {
  afterEach(() => jest.useRealTimers());

  it('flushOnce no hace nada si la cola está vacía', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const { worker } = makeWorker(ingest);
    // Acceder al método privado vía cast
    await (worker as unknown as { flushOnce(): Promise<void> }).flushOnce();
    expect(ingest).not.toHaveBeenCalled();
  });

  it('flushOnce entrega un lote cuando hay eventos en cola', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const { worker, queue } = makeWorker(ingest);
    queue.enqueue([makeEvent('svc1'), makeEvent('svc1')]);
    await (worker as unknown as { flushOnce(): Promise<void> }).flushOnce();
    expect(ingest).toHaveBeenCalledWith(
      'svc1',
      expect.arrayContaining([expect.objectContaining({ service: 'svc1' })]),
    );
  });

  it('flushOnce no re-entra si ya está flusheando (flushing=true)', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const { worker, queue } = makeWorker(ingest);
    queue.enqueue([makeEvent()]);

    // Forzar flushing=true
    (worker as unknown as { flushing: boolean }).flushing = true;
    await (worker as unknown as { flushOnce(): Promise<void> }).flushOnce();
    expect(ingest).not.toHaveBeenCalled();
  });

  it('deliverBatch agrupa eventos por servicio y llama ingestStream por stream', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const { worker, queue } = makeWorker(ingest);
    queue.enqueue([makeEvent('svc1'), makeEvent('svc2'), makeEvent('svc1')]);
    await (worker as unknown as { flushOnce(): Promise<void> }).flushOnce();
    expect(ingest).toHaveBeenCalledTimes(2);
  });

  it('reintenta cuando O2 falla (attempt < maxAttempts)', async () => {
    jest.useFakeTimers();
    const ingest = jest
      .fn()
      .mockRejectedValueOnce(new Error('O2 temp error'))
      .mockResolvedValue(undefined);
    const { worker, queue, metrics } = makeWorker(ingest, 100, 1, 1);
    queue.enqueue([makeEvent()]);

    const flushPromise = (worker as unknown as { flushOnce(): Promise<void> }).flushOnce();
    await jest.runAllTimersAsync();
    await flushPromise;

    expect(ingest).toHaveBeenCalledTimes(2);
    expect(metrics.o2RetriesTotal.inc).toHaveBeenCalled();
  }, 10000);

  it('registra error permanente cuando todos los reintentos fallan', async () => {
    jest.useFakeTimers();
    const ingest = jest.fn().mockRejectedValue(new Error('O2 down'));
    const { worker, queue, metrics, logger } = makeWorker(ingest, 100, 1, 1);
    queue.enqueue([makeEvent()]);

    const flushPromise = (worker as unknown as { flushOnce(): Promise<void> }).flushOnce();
    await jest.runAllTimersAsync();
    await flushPromise;

    expect(metrics.o2DeliveryFailedTotal.inc).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  }, 10000);

  it('onModuleDestroy hace flush y limpia el timer', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const { worker, queue } = makeWorker(ingest);
    queue.enqueue([makeEvent()]);
    worker.onModuleInit();
    await worker.onModuleDestroy();
    expect(ingest).toHaveBeenCalled();
  });
});
