import type { Gauge } from 'prom-client';
import type { NormalizedLogEvent } from '../../domain/schemas/log-event.schema';

export class InMemoryQueue {
  private readonly items: NormalizedLogEvent[] = [];

  constructor(
    private readonly maxItems: number,
    private readonly gauge: Gauge,
  ) {}

  enqueue(events: NormalizedLogEvent[]): number {
    const available = this.maxItems - this.items.length;
    const toAdd = events.slice(0, available);
    this.items.push(...toAdd);
    this.gauge.set(this.items.length);
    return toAdd.length;
  }

  dequeue(maxCount: number): NormalizedLogEvent[] {
    const batch = this.items.splice(0, maxCount);
    this.gauge.set(this.items.length);
    return batch;
  }

  get size(): number {
    return this.items.length;
  }

  get remaining(): number {
    return this.maxItems - this.items.length;
  }
}
