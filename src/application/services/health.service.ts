import { Injectable } from '@nestjs/common';
import { OpenObserveClient } from '../../infrastructure/openobserve/openobserve-client';

export interface HealthStatus {
  status: 'ok' | 'error';
  openobserve?: 'reachable' | 'unreachable';
}

@Injectable()
export class HealthService {
  constructor(private readonly o2Client: OpenObserveClient) {}

  liveness(): HealthStatus {
    return { status: 'ok' };
  }

  async readiness(): Promise<HealthStatus> {
    try {
      // Verificar conectividad con OpenObserve mediante una llamada leve
      await this.o2Client.http.get('/_cluster/health');
      return { status: 'ok', openobserve: 'reachable' };
    } catch {
      try {
        // Fallback: intentar listar streams como comprobación alternativa
        await this.o2Client.http.get('/streams');
        return { status: 'ok', openobserve: 'reachable' };
      } catch {
        return { status: 'error', openobserve: 'unreachable' };
      }
    }
  }
}
