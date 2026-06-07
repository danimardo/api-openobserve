import { Inject, Injectable } from '@nestjs/common';
import { OpenObserveClient } from '../../infrastructure/openobserve/openobserve-client';
import { APP_LOGGER, type IAppLogger } from '../../infrastructure/logging/app-logger.interface';

export interface HealthStatus {
  status: 'ok' | 'error';
  openobserve?: 'reachable' | 'unreachable';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly o2Client: OpenObserveClient,
    @Inject(APP_LOGGER) private readonly logger: IAppLogger,
  ) {}

  liveness(): HealthStatus {
    return { status: 'ok' };
  }

  async readiness(): Promise<HealthStatus> {
    try {
      // GET /api/{org}/streams — endpoint estándar de OpenObserve, requiere auth válida
      await this.o2Client.http.get('streams');
      return { status: 'ok', openobserve: 'reachable' };
    } catch (err) {
      const error = err as Error & { response?: { status?: number; data?: unknown } };
      this.logger.warn('OpenObserve readiness check failed', {
        module: 'HealthService',
        operation: 'readiness',
        httpStatus: error.response?.status,
        errorMessage: error.message,
      });
      return { status: 'error', openobserve: 'unreachable' };
    }
  }
}
