import { Injectable } from '@nestjs/common';
import type { NormalizedLogEvent } from '../../domain/schemas/log-event.schema';
import { OpenObserveClient } from './openobserve-client';

@Injectable()
export class O2IngestClient {
  constructor(private readonly client: OpenObserveClient) {}

  async ingestStream(stream: string, events: NormalizedLogEvent[]): Promise<void> {
    await this.client.http.post(`/${stream}/_json`, events);
  }
}
