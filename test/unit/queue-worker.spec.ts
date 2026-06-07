import { InMemoryQueue } from '../../src/infrastructure/queue/queue';
import type { NormalizedLogEvent } from '../../src/domain/schemas/log-event.schema';

function makeGaugeMock() {
  let val = 0;
  return {
    set: jest.fn((v: number) => {
      val = v;
    }),
    get value() {
      return val;
    },
  };
}

function makeEvent(service: string, i: number): NormalizedLogEvent {
  return {
    _timestamp: 1748000000000000 + i,
    service,
    env: 'test',
    level: 'info',
    message: `msg ${i}`,
    source: 'backend',
  };
}

describe('InMemoryQueue (FR-007, FR-008)', () => {
  it('enqueues events and updates gauge', () => {
    const gauge = makeGaugeMock();
    const queue = new InMemoryQueue(100, gauge as never);
    const events = [makeEvent('svc', 0), makeEvent('svc', 1)];
    const enqueued = queue.enqueue(events);
    expect(enqueued).toBe(2);
    expect(queue.size).toBe(2);
    expect(gauge.set).toHaveBeenCalledWith(2);
  });

  it('drops events that exceed QUEUE_MAX_ITEMS', () => {
    const gauge = makeGaugeMock();
    const queue = new InMemoryQueue(3, gauge as never);
    const enqueued = queue.enqueue([
      makeEvent('a', 0),
      makeEvent('a', 1),
      makeEvent('a', 2),
      makeEvent('a', 3), // should be dropped
    ]);
    expect(enqueued).toBe(3);
    expect(queue.size).toBe(3);
    expect(queue.remaining).toBe(0);
  });

  it('dequeues up to maxCount and updates gauge', () => {
    const gauge = makeGaugeMock();
    const queue = new InMemoryQueue(10, gauge as never);
    queue.enqueue([makeEvent('a', 0), makeEvent('b', 1), makeEvent('c', 2)]);
    const batch = queue.dequeue(2);
    expect(batch).toHaveLength(2);
    expect(queue.size).toBe(1);
    expect(gauge.set).toHaveBeenLastCalledWith(1);
  });

  it('returns empty array when queue is empty', () => {
    const gauge = makeGaugeMock();
    const queue = new InMemoryQueue(10, gauge as never);
    expect(queue.dequeue(5)).toEqual([]);
  });

  it('correctly reports remaining capacity', () => {
    const gauge = makeGaugeMock();
    const queue = new InMemoryQueue(5, gauge as never);
    queue.enqueue([makeEvent('a', 0), makeEvent('a', 1)]);
    expect(queue.remaining).toBe(3);
  });
});

describe('normalizeLevel (FR-011)', () => {
  // Import here to test level normalization in the same file context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { normalizeLevel } = require('../../src/domain/normalization/normalize-level') as {
    normalizeLevel: (raw: string) => string;
  };

  it.each([
    ['info', 'info'],
    ['INFO', 'info'],
    ['warn', 'warn'],
    ['warning', 'warn'],
    ['WARNING', 'warn'],
    ['error', 'error'],
    ['err', 'error'],
    ['ERR', 'error'],
    ['fatal', 'fatal'],
    ['critical', 'fatal'],
    ['CRITICAL', 'fatal'],
    ['debug', 'debug'],
    ['trace', 'trace'],
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeLevel(input)).toBe(expected);
  });

  it('returns "invalid_level" for unknown values', () => {
    expect(normalizeLevel('verbose')).toBe('invalid_level');
    expect(normalizeLevel('log')).toBe('invalid_level');
    expect(normalizeLevel('')).toBe('invalid_level');
  });
});
